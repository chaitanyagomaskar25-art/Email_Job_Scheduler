import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../repositories/prisma';
import { AppError } from './errorHandler';
import { AuthenticatedUser } from '../types/auth';

interface JwtPayload {
  userId: string;
  email: string;
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies.reachinbox_token) {
      token = req.cookies.reachinbox_token;
    }
    // 2. Check Authorization Bearer header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // 3. Optional dev user header in development mode
    if (!token && (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') && req.headers['x-dev-user-email']) {
      const devEmail = String(req.headers['x-dev-user-email']);
      let devUser = await prisma.user.findUnique({ where: { email: devEmail } });
      if (!devUser) {
        devUser = await prisma.user.create({
          data: {
            email: devEmail,
            name: 'Development User',
          },
        });
      }
      req.user = {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
        avatarUrl: devUser.avatarUrl,
        googleId: devUser.googleId,
      };
      return next();
    }

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!decoded || !decoded.userId) {
      throw new AppError('Invalid or expired authentication token', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        googleId: true,
      },
    });

    if (!user) {
      throw new AppError('User account not found', 401);
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Session expired or invalid. Please log in again.', 401));
    }
    next(error);
  }
};

