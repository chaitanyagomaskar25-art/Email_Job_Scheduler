import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validateBody =
  (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };

export const validateQuery =
  (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = (await schema.parseAsync(req.query)) as Record<string, string>;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid query parameters',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };

