import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../repositories/prisma';
import { googleAuthService } from '../integrations/google/google.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class AuthController {
  /**
   * Generates a signed JWT session token
   */
  private generateToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, env.JWT_SECRET, { expiresIn: '7d' });
  }

  /**
   * Sets secure HttpOnly cookie on the response
   */
  private setAuthCookie(res: Response, token: string): void {
    res.cookie('reachinbox_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }

  /**
   * GET /api/auth/google
   * Initiates Google OAuth 2.0 flow
   */
  public googleAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!googleAuthService.isConfigured()) {
        throw new AppError(
          'Google OAuth credentials are not configured in environment variables (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
          500
        );
      }

      // Generate random state for CSRF protection
      const state = Math.random().toString(36).substring(2, 15);
      res.cookie('oauth_state_google', state, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      const authUrl = googleAuthService.getAuthorizationUrl(state);
      return res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/auth/google/callback
   * Handles Google OAuth callback
   */
  public googleCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state } = req.query as { code: string; state: string };
      const savedState = req.cookies.oauth_state_google;

      if (!state || state !== savedState) {
        logger.warn('OAuth state mismatch during Google login');
        throw new AppError('Invalid or expired OAuth state parameter', 400);
      }
      res.clearCookie('oauth_state_google');

      const profile = await googleAuthService.getProfileFromCode(code);

      // Upsert user in PostgreSQL
      let user = await prisma.user.findFirst({
        where: {
          OR: [{ googleId: profile.googleId }, { email: profile.email }],
        },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            googleId: profile.googleId,
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.googleId,
            name: user.name || profile.name,
            avatarUrl: user.avatarUrl || profile.avatarUrl,
          },
        });
      }

      const token = this.generateToken(user.id, user.email);
      this.setAuthCookie(res, token);

      // Redirect to frontend dashboard
      return res.redirect(`${env.FRONTEND_URL}/dashboard`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/auth/me
   * Returns current authenticated user
   */
  public getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      return res.json({
        status: 'success',
        data: {
          user: req.user,
          googleConfigured: googleAuthService.isConfigured(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/logout
   * Clears session cookie
   */
  public logout = async (_req: Request, res: Response) => {
    res.clearCookie('reachinbox_token', {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    return res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  };

  /**
   * POST /api/auth/mock-login
   * Development login fallback for instant testing without configuring Google Cloud Console
   */
  public mockLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.body.email || 'demo@reachinbox.test';
      const name = req.body.name || 'ReachInbox Demo User';

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name,
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          },
        });
      }

      const token = this.generateToken(user.id, user.email);
      this.setAuthCookie(res, token);

      return res.json({
        status: 'success',
        message: 'Authenticated successfully with local development account',
        token,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            googleId: user.googleId,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
