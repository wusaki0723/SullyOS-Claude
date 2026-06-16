import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public detail?: string,
  ) {
    super(message);
  }
}

export function asyncRoute<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'invalid_request',
        message: '请求结构不正确',
        detail: err.message,
      },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        detail: err.detail,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err }, 'Unhandled request error');
  res.status(500).json({
    ok: false,
    error: {
      code: 'internal_error',
      message: 'Agent Server 内部错误',
      detail: message,
    },
  });
}
