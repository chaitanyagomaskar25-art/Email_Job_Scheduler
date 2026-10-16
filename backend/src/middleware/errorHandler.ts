import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const message = err.message || 'Internal Server Error';

  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      statusCode,
    },
    `HTTP Error: ${message}`
  );

  return res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

