import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validate';
import { googleCallbackQuerySchema, mockLoginSchema } from '../schemas/auth.schema';

const router = Router();

router.get('/google', authController.googleAuth);
router.get('/google/callback', validateQuery(googleCallbackQuerySchema), authController.googleCallback);
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', authController.logout);
router.post('/mock-login', validateBody(mockLoginSchema), authController.mockLogin);

export const authRoutes = router;
