import crypto from 'crypto';

import { and, eq, sql } from 'drizzle-orm';

import { db, users, projects, projectMembers, activityLog } from '@review-engine/database';
import { UserRole } from '@review-engine/shared';

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { redis } from '../../lib/redis.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function inviteKey(token: string) {
  return `invite:${token}`;
}

async function getAdminCount(projectId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'admin')));
  return row?.count ?? 0;
}

// ── Service Functions ─────────────────────────────────────────────────────────

export async function listMembers(projectId: string) {
  const rows = await db
    .select({
      id: projectMembers.id,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(projectMembers.createdAt);

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    created_at: row.createdAt,
    user: {
      id: row.userId,
      email: row.email,
      name: row.name,
      avatar_url: row.avatarUrl,
    },
  }));
}

export async function inviteMember(
  projectId: string,
  inviterId: string,
  data: { email: string; role: UserRole }
) {
  // Look up user by email
  const [existingUser] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

  if (existingUser) {
    // Check if already a member
    const [alreadyMember] = await db
      .select()
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, existingUser.id))
      )
      .limit(1);

    if (alreadyMember) {
      throw new ConflictError('User is already a member of this project');
    }

    // Insert membership directly
    const [newMembership] = await db
      .insert(projectMembers)
      .values({ projectId, userId: existingUser.id, role: data.role })
      .returning();

    await db.insert(activityLog).values({
      userId: inviterId,
      projectId,
      action: 'member.invited',
      entityType: 'project_member',
      entityId: newMembership!.id,
      details: { invited_email: data.email, role: data.role },
    });

    return {
      membership: { id: newMembership!.id, user_id: existingUser.id, role: data.role },
      user_exists: true,
    };
  }

  // User doesn't exist — generate invite token
  const token = crypto.randomBytes(32).toString('hex');
  const payload = JSON.stringify({ projectId, email: data.email, role: data.role });
  await redis.set(inviteKey(token), payload, 'EX', 7 * 24 * 60 * 60);

  await db.insert(activityLog).values({
    userId: inviterId,
    projectId,
    action: 'member.invite_sent',
    details: { invited_email: data.email, role: data.role },
  });

  // eslint-disable-next-line no-console
  console.info(
    `Invite token generated for ${data.email} in project ${projectId} (stored in Redis, expires in 7 days)`
  );

  return { membership: null, user_exists: false, invite_sent: true, token };
}

export async function getInviteByToken(token: string) {
  const raw = await redis.get(inviteKey(token));
  if (!raw) {
    throw new ValidationError('Invalid or expired invitation');
  }

  const { projectId, email, role } = JSON.parse(raw) as {
    projectId: string;
    email: string;
    role: UserRole;
  };

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  return {
    project_name: project?.name ?? null,
    email,
    role,
  };
}

export async function acceptInvite(token: string, userId: string) {
  const raw = await redis.get(inviteKey(token));
  if (!raw) {
    throw new ValidationError('Invalid or expired invitation');
  }

  const { projectId, email, role } = JSON.parse(raw) as {
    projectId: string;
    email: string;
    role: UserRole;
  };

  // Verify accepting user's email matches invite
  const [acceptingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!acceptingUser || acceptingUser.email !== email) {
    throw new ForbiddenError('This invitation was sent to a different email address');
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  if (existing) {
    await redis.del(inviteKey(token));
    return { id: existing.id, project_id: projectId, user_id: userId, role: existing.role };
  }

  const [newMembership] = await db
    .insert(projectMembers)
    .values({ projectId, userId, role })
    .returning();

  await redis.del(inviteKey(token));

  await db.insert(activityLog).values({
    userId,
    projectId,
    action: 'member.invite_accepted',
    entityType: 'project_member',
    entityId: newMembership!.id,
  });

  return {
    id: newMembership!.id,
    project_id: projectId,
    user_id: userId,
    role: newMembership!.role,
  };
}

export async function updateMemberRole(
  projectId: string,
  updaterId: string,
  memberId: string,
  newRole: UserRole
) {
  // Verify updater is an admin
  const [updaterMembership] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, updaterId)))
    .limit(1);

  if (!updaterMembership || updaterMembership.role !== 'admin') {
    throw new ForbiddenError('Insufficient permissions for this project');
  }

  // Look up target membership by memberId (the project_members row id)
  const [targetMembership] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  if (!targetMembership) {
    throw new NotFoundError('Member not found');
  }

  // Cannot change your own role
  if (targetMembership.userId === updaterId) {
    throw new ForbiddenError('Cannot change your own role');
  }

  // Check if target is the project owner
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (project && project.ownerId === targetMembership.userId) {
    throw new ForbiddenError("Cannot change the owner's role");
  }

  // If demoting from admin, ensure at least one admin remains after change
  if (targetMembership.role === 'admin' && newRole !== 'admin') {
    const adminCount = await getAdminCount(projectId);
    if (adminCount <= 1) {
      throw new ForbiddenError('Cannot remove the last admin');
    }
  }

  const oldRole = targetMembership.role;

  await db.update(projectMembers).set({ role: newRole }).where(eq(projectMembers.id, memberId));

  await db.insert(activityLog).values({
    userId: updaterId,
    projectId,
    action: 'member.role_changed',
    entityType: 'project_member',
    entityId: memberId,
    details: { old_role: oldRole, new_role: newRole },
  });

  return { id: memberId, project_id: projectId, user_id: targetMembership.userId, role: newRole };
}

export async function removeMember(projectId: string, removerId: string, memberId: string) {
  // Verify remover is an admin
  const [removerMembership] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, removerId)))
    .limit(1);

  if (!removerMembership || removerMembership.role !== 'admin') {
    throw new ForbiddenError('Insufficient permissions for this project');
  }

  // Look up target membership by memberId (the project_members row id)
  const [targetMembership] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  if (!targetMembership) {
    throw new NotFoundError('Member not found');
  }

  // Cannot remove yourself
  if (targetMembership.userId === removerId) {
    throw new ForbiddenError('Cannot remove yourself. Use delete project instead.');
  }

  // Cannot remove the project owner
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (project && project.ownerId === targetMembership.userId) {
    throw new ForbiddenError('Cannot remove the project owner');
  }

  // Cannot remove the last admin
  if (targetMembership.role === 'admin') {
    const adminCount = await getAdminCount(projectId);
    if (adminCount <= 1) {
      throw new ForbiddenError('Cannot remove the last admin');
    }
  }

  await db.delete(projectMembers).where(eq(projectMembers.id, memberId));

  await db.insert(activityLog).values({
    userId: removerId,
    projectId,
    action: 'member.removed',
    entityType: 'project_member',
    entityId: memberId,
  });
}
