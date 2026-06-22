import { Request, Response, NextFunction } from 'express';

import {
  registerSchema,
  loginSchema,
  firebaseLoginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema.js';
import * as authService from './auth.service.js';
import { sendSuccess } from '../../lib/response.js';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = registerSchema.parse(req.body);
    const result = await authService.register(validatedData);
    return sendSuccess(res, result, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = loginSchema.parse(req.body);
    const ip = req.ip;
    const result = await authService.login(validatedData, ip);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function firebaseLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = firebaseLoginSchema.parse(req.body);
    const ip = req.ip;
    const result = await authService.firebaseLogin(validatedData.idToken, ip);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = refreshTokenSchema.parse(req.body);
    const result = await authService.refreshToken(validatedData.refreshToken);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    // requireAuth must have run before this, so req.user is guaranteed to exist
    const userId = req.user!.userId;

    // Extract access token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    await authService.logout(userId, token);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    // requireAuth must have run, req.user is guaranteed
    const userId = req.user!.userId;
    const user = await authService.getCurrentUser(userId);
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(validatedData.email);
    return sendSuccess(res, {
      message: 'If an account exists with this email, a reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const validatedData = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(validatedData.token, validatedData.newPassword);
    return sendSuccess(res, {
      message: 'Password has been reset. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}
