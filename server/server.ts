import express from 'express';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import helmet from 'helmet';

import http from 'http';
import {Server} from 'socket.io';
import _ from 'lodash';
import cors from 'cors';
import SocketManager from './SocketManager';
import apiRouter from './api/router';

const app = express();
const server = new http.Server(app);
app.use(
  helmet({
    contentSecurityPolicy: false, // disable CSP for now — MUI v4 uses inline styles
  })
);
app.use(bodyParser.json());
const port = process.env.PORT || 3000;
const io = new Server(server, {
  pingInterval: 2000,
  pingTimeout: 5000,
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
app.use(cors()); // allow CORS for all express routes
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('tiny'));
}

app.use('/api', apiRouter);

// ======== Error Handling Middleware ==========

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    } catch (e) {
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
