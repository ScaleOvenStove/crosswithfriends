/**
 * Logger utility for model files that don't have access to Fastify's request.log
 * In production, this could be replaced with a proper logging library like winston or pino
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

const logLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

const shouldLog = (level: LogLevel): boolean => {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return levels.indexOf(level) >= levels.indexOf(logLevel);
};

const createLogger = (): Logger => ({
  debug: (message: string, ...args: unknown[]): void => {
    if (shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]): void => {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]): void => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: unknown[]): void => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
});

export const logger = createLogger();
