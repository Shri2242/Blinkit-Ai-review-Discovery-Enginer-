import crypto from 'crypto';

import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

import { db, users, activityLog } from '@review-engine/database';
import { env } from '@review-engine/shared';

import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../lib/errors.js';
import { redis } from '../../lib/redis.js';

// Helper to validate password rules in service
function validatePasswordRules(password: string) {
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    throw new ValidationError('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    throw new ValidationError('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new ValidationError('Password must contain at least one special character');
  }
}

export async function register(data: { email: string; name: string; password: string }) {
  const lowercaseEmail = data.email.toLowerCase();

  // Validate email is not empty
  if (!lowercaseEmail || !lowercaseEmail.includes('@')) {
    throw new ValidationError('Invalid email format');
  }

  // Check uniqueness
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, lowercaseEmail))
    .limit(1);

  if (existingUser) {
    // Use generic message to prevent user enumeration
    // Don't reveal whether the email exists
    throw new ConflictError('Registration could not be completed. Please try again later.');
  }

  // Validate password
  validatePasswordRules(data.password);

  // Hash password
  const rounds = env.NODE_ENV === 'test' ? 1 : 12;
  const passwordHash = await bcrypt.hash(data.password, rounds);

  // Insert user
  const [newUser] = await db
    .insert(users)
    .values({
      email: lowercaseEmail,
      name: data.name,
      passwordHash,
      role: 'viewer',
    })
    .returning();

  if (!newUser) {
    throw new Error('Failed to create user');
  }

  // Generate JWT access token
  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email, role: newUser.role },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' }
  );

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Generate refresh token
  const rawRefreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // Store refresh token in Redis
  const tokenKey = `refresh_token:${tokenHash}`;
  const userTokensKey = `user:refresh_tokens:${newUser.id}`;
  const TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  await redis.set(tokenKey, newUser.id, 'EX', TTL);
  await redis.sadd(userTokensKey, tokenHash);
  await redis.expire(userTokensKey, TTL);

  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      created_at: newUser.createdAt,
    },
    token,
    refreshToken: rawRefreshToken,
    expiresAt,
  };
}

export async function login(data: { email: string; password: string }, ip?: string) {
  const lowercaseEmail = data.email.toLowerCase();

  // Find user by email
  const [user] = await db.select().from(users).where(eq(users.email, lowercaseEmail)).limit(1);

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Compare password with bcrypt
  const isMatch = await bcrypt.compare(data.password, user.passwordHash || '');
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Update last_login_at
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  // Generate JWT access token
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Generate refresh token
  const rawRefreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // Store refresh token in Redis
  const tokenKey = `refresh_token:${tokenHash}`;
  const userTokensKey = `user:refresh_tokens:${user.id}`;
  const TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  await redis.set(tokenKey, user.id, 'EX', TTL);
  await redis.sadd(userTokensKey, tokenHash);
  await redis.expire(userTokensKey, TTL);

  // Log to activity_log
  await db.insert(activityLog).values({
    userId: user.id,
    action: 'user.login',
    details: ip ? { ip } : null,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token,
    refreshToken: rawRefreshToken,
    expiresAt,
  };
}

export async function firebaseLogin(idToken: string, ip?: string) {
  // Lazy-load to avoid initialization errors if config is missing but route isn't hit
  const { firebaseAuth } = await import('../../config/firebase.js');

  if (!firebaseAuth) {
    throw new Error('Firebase Auth is not properly initialized on the server.');
  }

  let decodedToken;
  try {
    decodedToken = await firebaseAuth.verifyIdToken(idToken);
  } catch (_error) {
    throw new UnauthorizedError('Invalid Firebase ID token');
  }

  const { email, phone_number, name, picture, uid } = decodedToken;

  // Use email or generate a placeholder for phone-only or anonymous auth
  let userEmail: string;
  if (email) {
    userEmail = email.toLowerCase();
  } else if (phone_number) {
    userEmail = `${phone_number}@phone.reviewpulse.local`;
  } else if (uid) {
    userEmail = `${uid}@anonymous.reviewpulse.local`;
  } else {
    throw new UnauthorizedError('Unable to resolve user email, phone, or UID from Firebase token');
  }

  // Find user by email
  let [user] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);

  if (!user) {
    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        email: userEmail,
        name: name || phone_number || 'New User',
        avatarUrl: picture,
        role: 'viewer',
        // No password hash, as they login via Firebase
        passwordHash: null,
      })
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user from Firebase');
    }
    user = newUser;
  } else {
    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  }

  // Generate JWT access token
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Generate refresh token
  const rawRefreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // Store refresh token in Redis
  const tokenKey = `refresh_token:${tokenHash}`;
  const userTokensKey = `user:refresh_tokens:${user.id}`;
  const TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  await redis.set(tokenKey, user.id, 'EX', TTL);
  await redis.sadd(userTokensKey, tokenHash);
  await redis.expire(userTokensKey, TTL);

  // Log to activity_log
  await db.insert(activityLog).values({
    userId: user.id,
    action: 'user.firebase_login',
    details: ip
      ? { ip, provider: decodedToken.firebase.sign_in_provider }
      : { provider: decodedToken.firebase.sign_in_provider },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token,
    refreshToken: rawRefreshToken,
    expiresAt,
  };
}

export async function refreshToken(refreshTokenStr: string) {
  const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');
  const tokenKey = `refresh_token:${tokenHash}`;

  // Look up user ID in Redis
  const userId = await redis.get(tokenKey);
  if (!userId) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Find user in database
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Delete old refresh token (rotation)
  await redis.del(tokenKey);
  await redis.srem(`user:refresh_tokens:${user.id}`, tokenHash);

  // Generate new access and refresh tokens
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const newRawRefreshToken = crypto.randomBytes(64).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

  // Store new refresh token
  const newTokenKey = `refresh_token:${newTokenHash}`;
  const userTokensKey = `user:refresh_tokens:${user.id}`;
  const TTL = 7 * 24 * 60 * 60;

  await redis.set(newTokenKey, user.id, 'EX', TTL);
  await redis.sadd(userTokensKey, newTokenHash);
  await redis.expire(userTokensKey, TTL);

  return {
    token,
    refreshToken: newRawRefreshToken,
    expiresAt,
  };
}

export async function logout(userId: string, accessToken: string) {
  // Delete refresh tokens for this user
  const userTokensKey = `user:refresh_tokens:${userId}`;
  const tokenHashes = await redis.smembers(userTokensKey);
  if (tokenHashes.length > 0) {
    const keysToDelete = tokenHashes.map((hash) => `refresh_token:${hash}`);
    await redis.del(...keysToDelete);
  }
  await redis.del(userTokensKey);

  // Blacklist the current access token
  try {
    const decoded = jwt.decode(accessToken) as jwt.JwtPayload | null;
    const exp = decoded?.exp;
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp ? exp - now : 15 * 60; // default to 15m if no exp field

    if (ttl > 0) {
      await redis.set(`blacklist:${accessToken}`, 'true', 'EX', ttl);
    }
  } catch {
    // Fail gracefully, blacklist for standard 15 minutes
    await redis.set(`blacklist:${accessToken}`, 'true', 'EX', 15 * 60);
  }

  // Log activity
  await db.insert(activityLog).values({
    userId,
    action: 'user.logout',
  });
}

export async function getCurrentUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const { passwordHash: _passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function forgotPassword(email: string) {
  const lowercaseEmail = email.toLowerCase();

  // Find user by email
  const [user] = await db.select().from(users).where(eq(users.email, lowercaseEmail)).limit(1);

  // Return silently if user not found (security best practice)
  if (!user) {
    return;
  }

  // Generate secure reset token (32 bytes)
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Store in Redis with 1 hour TTL
  await redis.set(`password_reset:${resetToken}`, user.id, 'EX', 3600);

  // Log to console (warn used to avoid production console.log restrictions while fulfilling spec)
  // eslint-disable-next-line no-console
  console.info(`Password reset email queued for user ${user.id}`);
}

export async function resetPassword(token: string, newPassword: string) {
  const resetKey = `password_reset:${token}`;

  // Look up token in Redis
  const userId = await redis.get(resetKey);
  if (!userId) {
    throw new ValidationError('Invalid or expired reset token');
  }

  // Validate password rules
  validatePasswordRules(newPassword);

  // Hash new password
  const rounds = env.NODE_ENV === 'test' ? 1 : 12;
  const passwordHash = await bcrypt.hash(newPassword, rounds);

  // Update user password
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  // Delete the reset token
  await redis.del(resetKey);

  // Delete all refresh tokens for this user (force re-login everywhere)
  const userTokensKey = `user:refresh_tokens:${userId}`;
  const tokenHashes = await redis.smembers(userTokensKey);
  if (tokenHashes.length > 0) {
    const keysToDelete = tokenHashes.map((hash) => `refresh_token:${hash}`);
    await redis.del(...keysToDelete);
  }
  await redis.del(userTokensKey);

  // Log activity
  await db.insert(activityLog).values({
    userId,
    action: 'user.password_reset',
  });
}
