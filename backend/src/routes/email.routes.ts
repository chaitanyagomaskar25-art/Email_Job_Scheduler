import { Router } from 'express';
import { emailController } from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validate';
import { handleIdempotency } from '../middleware/idempotency';
import {
  scheduleEmailSchema,
  scheduleBatchEmailSchema,
  emailQuerySchema,
  searchEmailQuerySchema,
  createSenderSchema,
} from '../schemas/email.schema';

const router = Router();

// Apply auth middleware to all email routes
router.use(requireAuth);

router.post(
  '/schedule',
  validateBody(scheduleEmailSchema),
  handleIdempotency,
  emailController.scheduleEmail
);

router.post(
  '/batch',
  validateBody(scheduleBatchEmailSchema),
  handleIdempotency,
  emailController.scheduleBatch
);

router.get('/', validateQuery(emailQuerySchema), emailController.getEmails);
router.get('/search', validateQuery(searchEmailQuerySchema), emailController.searchEmails);
router.get('/senders', emailController.getSenders);
router.post('/senders', validateBody(createSenderSchema), emailController.createSender);

router.get('/:id', emailController.getEmailById);
router.post('/:id/cancel', emailController.cancelEmail);
router.post('/:id/retry', emailController.retryEmail);

export const emailRoutes = router;

