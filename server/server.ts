import './instrument';
import * as Sentry from '@sentry/node';
import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import path from 'path';
import http from 'http';
import {Server} from 'socket.io';
import _ from 'lodash';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import SocketManager from './SocketManager';
import apiRouter from './api/router';
import {swaggerSpec} from './swagger';
import passport from './auth/passport';
import {optionalAuth} from './auth/middleware';
import {cleanupExpiredTokens} from './model/refresh_token';
import {cleanupExpiredEmailTokens, cleanupExpiredResetTokens} from './model/email_token';

const app = express();
app.set('trust proxy', 1); // trust first proxy (Render) so req.ip reflects the real client
app.set('query parser', 'extended');
const server = new http.Server(app);
app.use(
  helmet({
    contentSecurityPolicy: false, // disable CSP for now — MUI v4 uses inline styles
  })
);
app.use(express.json({limit: '1mb'}));
app.use(cookieParser());
app.use(passport.initialize());
const port = process.env.PORT || 3000;

function getCorsOrigins() {
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3020', 'http://localhost:3021'];
  }
  if (!process.env.FRONTEND_URL) return true;
  const url = process.env.FRONTEND_URL;
  // Allow both www and non-www variants
  const origins = [url];
  if (url.includes('://www.')) {
    origins.push(url.replace('://www.', '://'));
  } else {
    origins.push(url.replace('://', '://www.'));
  }
  return origins;
}
const corsOrigins = getCorsOrigins();
const io = new Server(server, {
  pingInterval: 2000,
  pingTimeout: 5000,
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
app.use(cors({origin: corsOrigins, credentials: true}));
app.use(optionalAuth);
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('tiny'));
}

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api', apiRouter);

// Optionally serve the built frontend (used in Docker / self-hosted setups)
if (process.env.SERVE_STATIC) {
  const buildPath = path.join(__dirname, '..', 'build');
  app.use(express.static(buildPath));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// ======== Error Handling Middleware ==========

Sentry.setupExpressErrorHandler(app);

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.statusCode || 500;
  console.error(`[API Error] ${req.method} ${req.path}:`, err.message || err);
  res.status(status).json({error: err.message || 'Internal server error'});
});

// ================== Logging ================

function logAllEvents(log: typeof console.log) {
  io.on('*', (event: any, ...args: any) => {
    try {
      log(`[${event}]`, _.truncate(JSON.stringify(args), {length: 100}));
    } catch (_e) {
      log(`[${event}]`, args);
    }
  });
}

// ================== Main Entrypoint ================

async function runServer() {
  const socketManager = new SocketManager(io);
  socketManager.listen();
  logAllEvents(console.log);
  console.log('--------------------------------------------------------------------------------');
  console.log('Database Connection Details:');
  console.log(`  Host: ${process.env.PGHOST || 'localhost'}`);
  console.log(`  Database: ${process.env.PGDATABASE}`);
  console.log(`  User: ${process.env.PGUSER || process.env.USER}`);
  console.log(`  Port: ${process.env.PGPORT || 5432}`);
  console.log('--------------------------------------------------------------------------------');
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
    console.warn(
      'WARNING: FRONTEND_URL is not set. CORS will allow all origins — set FRONTEND_URL for security.'
    );
  }
  // Clean up expired/revoked tokens every hour
  setInterval(
    async () => {
      try {
        const deleted = await cleanupExpiredTokens();
        if (deleted > 0) console.log(`Cleaned up ${deleted} expired refresh tokens`);
        const deletedEmail = await cleanupExpiredEmailTokens();
        if (deletedEmail > 0) console.log(`Cleaned up ${deletedEmail} expired email verification tokens`);
        const deletedReset = await cleanupExpiredResetTokens();
        if (deletedReset > 0) console.log(`Cleaned up ${deletedReset} expired password reset tokens`);
      } catch (err) {
        Sentry.captureException(err);
        console.error('Token cleanup error:', err);
      }
    },
    60 * 60 * 1000
  );

  server.listen(port, () => console.log(`Listening on port ${port}`));
  process.once('SIGUSR2', () => {
    server.close(() => {
      console.log('exiting...');
      process.kill(process.pid, 'SIGUSR2');
      console.log('exited');
    });
  });
}

runServer();
