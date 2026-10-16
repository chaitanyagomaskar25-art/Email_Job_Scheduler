import { Router } from 'express';
import { integrationController } from '../controllers/integration.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validate';
import { slackCallbackQuerySchema } from '../schemas/integration.schema';

const router = Router();

// Callback does not require session bearer directly because Slack redirects the user's browser
router.get('/slack/callback', validateQuery(slackCallbackQuerySchema), integrationController.slackCallback);

// Protected routes
router.get('/slack/status', requireAuth, integrationController.getSlackStatus);
router.get('/slack/authorize', requireAuth, integrationController.authorizeSlack);
router.post('/slack/disconnect', requireAuth, integrationController.disconnectSlack);
router.post('/slack/test', requireAuth, integrationController.testSlackAlert);

export const integrationRoutes = router;

