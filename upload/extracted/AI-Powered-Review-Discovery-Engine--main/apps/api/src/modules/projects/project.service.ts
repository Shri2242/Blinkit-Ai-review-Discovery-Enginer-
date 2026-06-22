import { and, eq, sql, desc } from 'drizzle-orm';

import { db, projects, projectMembers, activityLog } from '@review-engine/database';

import { NotFoundError, ForbiddenError } from '../../lib/errors.js';

export async function createProject(
  userId: string,
  data: { name: string; description?: string; app_store_url?: string; google_play_url?: string }
) {
  // Insert project
  const [newProject] = await db
    .insert(projects)
    .values({
      ownerId: userId,
      name: data.name,
      description: data.description || null,
      appStoreUrl: data.app_store_url || null,
      googlePlayUrl: data.google_play_url || null,
      settings: {},
    })
    .returning();

  if (!newProject) {
    throw new Error('Failed to create project');
  }

  // Insert into project_members as admin
  await db.insert(projectMembers).values({
    projectId: newProject.id,
    userId,
    role: 'admin',
  });

  // Log to activity_log
  await db.insert(activityLog).values({
    userId,
    projectId: newProject.id,
    action: 'project.created',
    entityType: 'project',
    entityId: newProject.id,
  });

  return {
    id: newProject.id,
    owner_id: newProject.ownerId,
    name: newProject.name,
    description: newProject.description,
    app_store_url: newProject.appStoreUrl,
    google_play_url: newProject.googlePlayUrl,
    settings: newProject.settings,
    created_at: newProject.createdAt,
    updated_at: newProject.updatedAt,
    member_count: 1,
  };
}

export async function listProjects(userId: string) {
  const userProjects = await db
    .select({
      id: projects.id,
      ownerId: projects.ownerId,
      name: projects.name,
      description: projects.description,
      appStoreUrl: projects.appStoreUrl,
      googlePlayUrl: projects.googlePlayUrl,
      settings: projects.settings,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      userRole: projectMembers.role,
      memberCount: sql<number>`(SELECT count(*)::int FROM project_members WHERE project_members.project_id = projects.id)`,
      reviewCount: sql<number>`(SELECT count(*)::int FROM reviews WHERE reviews.project_id = projects.id)`,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, userId))
    .orderBy(desc(projects.createdAt));

  return userProjects.map((row) => ({
    id: row.id,
    owner_id: row.ownerId,
    name: row.name,
    description: row.description,
    app_store_url: row.appStoreUrl,
    google_play_url: row.googlePlayUrl,
    settings: row.settings,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    member_count: row.memberCount,
    review_count: row.reviewCount,
    user_role: row.userRole,
  }));
}

export async function getProject(projectId: string, userId: string) {
  const [row] = await db
    .select({
      id: projects.id,
      ownerId: projects.ownerId,
      name: projects.name,
      description: projects.description,
      appStoreUrl: projects.appStoreUrl,
      googlePlayUrl: projects.googlePlayUrl,
      settings: projects.settings,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      userRole: projectMembers.role,
      memberCount: sql<number>`(SELECT count(*)::int FROM project_members WHERE project_members.project_id = projects.id)`,
      reviewCount: sql<number>`(SELECT count(*)::int FROM reviews WHERE reviews.project_id = projects.id)`,
      lastUploadAt: sql<
        string | null
      >`(SELECT max(created_at) FROM upload_batches WHERE upload_batches.project_id = projects.id)`,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(and(eq(projects.id, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  if (!row) {
    throw new NotFoundError('Project not found');
  }

  return {
    id: row.id,
    owner_id: row.ownerId,
    name: row.name,
    description: row.description,
    app_store_url: row.appStoreUrl,
    google_play_url: row.googlePlayUrl,
    settings: row.settings,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    member_count: row.memberCount,
    review_count: row.reviewCount,
    user_role: row.userRole,
    last_upload_at: row.lastUploadAt,
  };
}

export async function updateProject(
  projectId: string,
  userId: string,
  data: Partial<{
    name: string;
    description: string;
    app_store_url: string;
    google_play_url: string;
  }>
) {
  // Verify user has admin role in this project
  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  if (!membership || membership.role !== 'admin') {
    throw new ForbiddenError('Insufficient permissions for this project');
  }

  // Update only provided fields
  const updateFields: {
    name?: string;
    description?: string | null;
    appStoreUrl?: string | null;
    googlePlayUrl?: string | null;
    updatedAt?: Date;
  } = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.description !== undefined) updateFields.description = data.description;
  if (data.app_store_url !== undefined) updateFields.appStoreUrl = data.app_store_url;
  if (data.google_play_url !== undefined) updateFields.googlePlayUrl = data.google_play_url;
  updateFields.updatedAt = new Date();

  await db.update(projects).set(updateFields).where(eq(projects.id, projectId));

  // Log to activity_log
  await db.insert(activityLog).values({
    userId,
    projectId,
    action: 'project.updated',
    entityType: 'project',
    entityId: projectId,
  });

  return getProject(projectId, userId);
}

export async function deleteProject(projectId: string, userId: string) {
  // Verify user is owner of the project
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  if (project.ownerId !== userId) {
    throw new ForbiddenError('Only the project owner can delete this project');
  }

  // Delete project (cascading deletes projectMembers, reviews, etc.)
  await db.delete(projects).where(eq(projects.id, projectId));

  // Log to activity_log
  await db.insert(activityLog).values({
    userId,
    action: 'project.deleted',
    entityType: 'project',
    entityId: projectId,
  });
}
