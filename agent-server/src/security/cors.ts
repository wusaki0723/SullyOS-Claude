import cors from 'cors';
import { config } from '../config.js';

const defaultOrigins = new Set([
  'http://localhost',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'capacitor://localhost',
]);

const configuredOrigins = config.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (configuredOrigins.includes('*')) {
      callback(null, true);
      return;
    }
    if (configuredOrigins.includes(origin) || defaultOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
});
