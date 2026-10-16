import { Request, Response, NextFunction } from 'express';
import { prisma } from '../repositories/prisma';
import { logger } from '../utils/logger';

export const handleIdempotency = async (req: Request, res: Response, next: NextFunction) => {
  const idempotencyKey =
    (req.headers['idempotency-key'] as string) || (req.body && req.body.idempotencyKey);

  if (!idempotencyKey || !req.user) {
    return next();
  }

  try {
    const existing = await prisma.idempotencyRecord.findUnique({
      where: {
        userId_key: {
          userId: req.user.id,
          key: idempotencyKey,
        },
      },
    });

    if (existing) {
      logger.info(
        { userId: req.user.id, idempotencyKey },
        'Idempotent request detected. Serving cached response.'
      );
      return res.status(existing.responseStatus).json(existing.responseBody);
    }

    // Intercept res.json to cache response atomically
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Restore original method
      res.json = originalJson;

      // Only cache successful or client-side responses (status < 500)
      if (res.statusCode < 500) {
        prisma.idempotencyRecord
          .create({
            data: {
              userId: req.user!.id,
              key: idempotencyKey,
              responseStatus: res.statusCode,
              responseBody: body,
            },
          })
          .catch((err) => {
            logger.warn({ err, idempotencyKey }, 'Failed to persist idempotency record');
          });
      }

      return originalJson(body);
    };

    next();
  } catch (error) {
    logger.error({ error, idempotencyKey }, 'Error evaluating idempotency key');
    next();
  }
};
