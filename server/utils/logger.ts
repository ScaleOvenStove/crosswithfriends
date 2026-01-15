/**
 * Logger utility for model files that don't have access to Fastify's request.log
 * Uses Pino for structured logging with pretty printing in development
 */

import pino from 'pino';

import {config} from '../config/index.js';

const isDevelopment = config.server.isDevelopment;
const logLevel = isDevelopment ? 'debug' : 'info';

// Create Pino logger instance
// In development, use pino-pretty for human-readable output
// In production, use JSON output for log aggregation
const logger = pino({
  level: logLevel,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export {logger};
