import { z } from 'zod';

export const googleCallbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'OAuth state is required'),
});

export const mockLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').optional(),
});

