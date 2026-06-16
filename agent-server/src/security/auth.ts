import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { HttpError } from '../utils/errors.js';

function isLocalhost(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || '';
  const host = req.hostname || '';
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1'
  );
}

export function requireClientAuth(req: Request, _res: Response, next: NextFunction) {
  if (!config.clientToken) {
    if (isLocalhost(req)) {
      next();
      return;
    }
    next(new HttpError(401, 'auth_required', 'Agent Server 未设置 client token 时只允许 localhost 请求'));
    return;
  }

  const auth = req.header('authorization') || '';
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (token && token === config.clientToken) {
    next();
    return;
  }

  next(new HttpError(401, 'invalid_token', 'Agent Server client token 无效'));
}
