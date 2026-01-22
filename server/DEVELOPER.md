# Server Developer Guide

This guide provides in-depth technical documentation for developers working on the Cross with Friends backend. For basic setup and API reference, see [README.md](./README.md).

## Table of Contents

- [Architecture Deep Dive](#architecture-deep-dive)
- [Event Sourcing System](#event-sourcing-system)
- [Socket.io Implementation](#socketio-implementation)
- [Database Patterns](#database-patterns)
- [Authentication System](#authentication-system)
- [Validation Layer](#validation-layer)
- [Configuration Management](#configuration-management)
- [Error Handling](#error-handling)
- [Testing Patterns](#testing-patterns)
- [Adding New Features](#adding-new-features)
- [Performance Considerations](#performance-considerations)

---

## Architecture Deep Dive

### Directory Structure

```
server/
├── api/                      # HTTP API layer
│   ├── handlers.ts          # All handlers (mapped by operationId)
│   ├── router.ts            # Fastify route registration
│   ├── errors.ts            # Error creation utilities
│   ├── schemas.ts           # Request/response schemas
│   └── generated/           # Auto-generated types from OpenAPI
│
├── model/                    # Database query layer
│   ├── pool.ts              # PostgreSQL connection pool
│   ├── game.ts              # Game event queries
│   ├── room.ts              # Room event queries
│   ├── puzzle.ts            # Puzzle queries
│   ├── puzzle_solve.ts      # Solve tracking queries
│   └── counters.ts          # ID counter queries
│
├── repositories/            # Data access abstraction
│   ├── GameRepository.ts    # Game data operations
│   ├── PuzzleRepository.ts  # Puzzle data operations
│   ├── RoomRepository.ts    # Room data operations
│   └── interfaces/          # Repository interfaces
│
├── services/                # Business logic layer
│   ├── PuzzleService.ts     # Puzzle operations
│   └── PuzzleFormatConverter.ts
│
├── validation/              # Zod validation schemas
│   ├── gameEvents.ts        # Game event validation
│   ├── roomEvents.ts        # Room event validation
│   └── puzzleSchema.ts      # Puzzle validation
│
├── utils/                   # Utility functions
│   ├── auth.ts              # JWT utilities
│   ├── userAuth.ts          # Request authentication
│   ├── firebaseAdmin.ts     # Firebase Admin SDK
│   ├── websocketRateLimit.ts # Rate limiting
│   ├── logger.ts            # Pino logger
│   └── errorSanitizer.ts    # Production error handling
│
├── config/                  # Configuration
│   └── index.ts             # Zod-validated config
│
├── plugins/                 # Fastify plugins
│   ├── database.ts          # DB lifecycle management
│   └── config.ts            # Config plugin
│
├── migrations/              # Database migrations
├── server.ts               # Entry point
├── SocketManager.ts        # WebSocket handler
└── openapi.json            # API specification (source of truth)
```

### Request Flow

```
HTTP Request
    │
    ▼
┌─────────────────┐
│  Fastify Server │
│  (rate limiting,│
│   CORS, auth)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  OpenAPI Router │
│  (validation,   │
│   operationId)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Handler      │
│  (api/handlers) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │
│  (data access)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Model       │
│  (SQL queries)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘
```

### WebSocket Flow

```
Socket Connection
    │
    ▼
┌─────────────────┐
│  Socket.io      │
│  (handshake,    │
│   auth header)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SocketManager   │
│  (validation,   │
│   rate limit)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│ Model │ │Broadcast│
│ Write │ │ to Room │
└───────┘ └───────┘
```

---

## Event Sourcing System

The server uses event sourcing for game state, providing complete history and replay capability.

### Event Structure

```typescript
interface GameEvent {
  gid: string;        // Game ID
  uid: string;        // User ID who triggered event
  ts: number;         // Timestamp (milliseconds)
  type: string;       // Event type
  params: object;     // Event-specific data
}
```

### Event Types

| Type | Params | Description |
|------|--------|-------------|
| `create` | `{ pid }` | Game created |
| `updateCell` | `{ cell: {r, c}, value, pencil? }` | Cell value changed |
| `updateCursor` | `{ cell: {r, c}, timestamp }` | Cursor moved |
| `check` | `{ scope, cells? }` | Check operation |
| `reveal` | `{ scope, cells? }` | Reveal operation |
| `reset` | `{ scope }` | Reset operation |
| `updateClock` | `{ action, timestamp }` | Clock start/stop |
| `chat` | `{ text, senderId }` | Chat message |

### Event Storage

Events are stored in `game_events` table:

```sql
CREATE TABLE game_events (
  gid text,
  uid text,
  ts timestamp without time zone,
  event_type text,
  event_payload json
);

CREATE INDEX idx_game_events_gid_ts ON game_events(gid, ts);
```

### Querying Events

```typescript
// model/game.ts
export async function getGameEvents(gid: string): Promise<GameEvent[]> {
  const result = await pool.query(
    'SELECT * FROM game_events WHERE gid = $1 ORDER BY ts ASC',
    [gid]
  );
  return result.rows.map(rowToEvent);
}

export async function addGameEvent(event: GameEvent): Promise<void> {
  await pool.query(
    'INSERT INTO game_events (gid, uid, ts, event_type, event_payload) VALUES ($1, $2, $3, $4, $5)',
    [event.gid, event.uid, event.ts, event.type, event.params]
  );
}
```

### Reconstructing Game State

To get current game state, replay all events:

```typescript
function reconstructGameState(events: GameEvent[]): GameState {
  const state = createEmptyState();

  for (const event of events) {
    applyEvent(state, event);
  }

  return state;
}

function applyEvent(state: GameState, event: GameEvent): void {
  switch (event.type) {
    case 'updateCell':
      state.cells[event.params.cell.r][event.params.cell.c] = event.params.value;
      break;
    case 'check':
      // Mark cells as checked
      break;
    // ... other event types
  }
}
```

---

## Socket.io Implementation

### SocketManager Class

The `SocketManager` (`SocketManager.ts`) handles all WebSocket communication:

```typescript
export class SocketManager {
  private io: Server;
  private rateLimiter: WebSocketRateLimiter;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: config.corsOrigins },
      path: '/ws',
    });

    this.io.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(socket: Socket) {
    // Extract user from auth header
    const user = this.authenticateSocket(socket);
    if (!user && config.requireAuth) {
      socket.disconnect();
      return;
    }

    // Register event handlers
    socket.on('join_game', (data) => this.handleJoinGame(socket, data));
    socket.on('game_event', (data) => this.handleGameEvent(socket, data));
    // ...
  }
}
```

### Room Management

Socket.io rooms are used for broadcasting:

```typescript
// Join game room
socket.join(`game-${gid}`);

// Broadcast to all in game (except sender)
socket.to(`game-${gid}`).emit('game_event', event);

// Broadcast to all in game (including sender)
this.io.to(`game-${gid}`).emit('game_event', event);
```

### Event Validation

All incoming events are validated with Zod:

```typescript
// validation/gameEvents.ts
export const gameEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('updateCell'),
    params: z.object({
      cell: z.object({ r: z.number(), c: z.number() }),
      value: z.string().max(1),
      pencil: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal('updateCursor'),
    params: z.object({
      cell: z.object({ r: z.number(), c: z.number() }),
      timestamp: z.number(),
    }),
  }),
  // ... other event types
]);

// In SocketManager
private handleGameEvent(socket: Socket, rawEvent: unknown) {
  const result = gameEventSchema.safeParse(rawEvent);
  if (!result.success) {
    socket.emit('error', { message: 'Invalid event format' });
    return;
  }

  const event = result.data;
  // Process validated event
}
```

### Timestamp Handling

Server assigns authoritative timestamps:

```typescript
private normalizeTimestamp(event: GameEvent): GameEvent {
  // Handle Firebase server timestamp format
  if (event.ts && typeof event.ts === 'object' && '.sv' in event.ts) {
    return { ...event, ts: Date.now() };
  }

  // Always use server time for consistency
  return { ...event, ts: Date.now() };
}
```

### Rate Limiting

Per-socket rate limiting prevents abuse:

```typescript
// utils/websocketRateLimit.ts
export class WebSocketRateLimiter {
  private counts: Map<string, { count: number; resetAt: number }>;

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000
  ) {}

  isRateLimited(socketId: string): boolean {
    const now = Date.now();
    const entry = this.counts.get(socketId);

    if (!entry || now > entry.resetAt) {
      this.counts.set(socketId, { count: 1, resetAt: now + this.windowMs });
      return false;
    }

    entry.count++;
    return entry.count > this.maxRequests;
  }
}
```

---

## Database Patterns

### Connection Pooling

```typescript
// model/pool.ts
import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,        // Default: 20
  min: config.dbPoolMin,        // Default: 5
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: config.isProduction ? { rejectUnauthorized: true } : false,
});

// Health check
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
```

### Query Patterns

**Parameterized Queries** (prevents SQL injection):

```typescript
// Good
await pool.query('SELECT * FROM puzzles WHERE pid = $1', [pid]);

// Never do this
await pool.query(`SELECT * FROM puzzles WHERE pid = '${pid}'`);
```

**Transactions**:

```typescript
export async function createGameWithPuzzle(gid: string, puzzle: Puzzle) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'INSERT INTO puzzles (pid, content) VALUES ($1, $2)',
      [puzzle.pid, puzzle.content]
    );

    await client.query(
      'INSERT INTO game_events (gid, event_type, event_payload) VALUES ($1, $2, $3)',
      [gid, 'create', { pid: puzzle.pid }]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

### Migration System

Migrations are in `migrations/` directory:

```
migrations/
├── 001_create_game_events.sql
├── 002_create_puzzles.sql
├── 003_create_room_events.sql
├── 004_create_puzzle_solves.sql
├── 005_create_id_counters.sql
├── 006_add_puzzle_performance_indexes.sql
└── ...
```

**Running migrations**:

```bash
yarn migrate           # Apply pending migrations
yarn check-migrations  # Show migration status
```

**Migration tracking**:

```sql
CREATE TABLE schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamp DEFAULT NOW(),
  checksum text
);
```

---

## Authentication System

### JWT Token Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Authentication Flow                    │
└─────────────────────────────────────────────────────────┘

1. Firebase Auth (Client)
   ┌───────────┐
   │  Client   │ ──── Firebase signIn() ──▶ Firebase ID Token
   └───────────┘

2. Token Exchange (Backend)
   ┌───────────┐     POST /api/auth/firebase      ┌───────────┐
   │  Client   │ ──────────────────────────────▶ │  Server   │
   │           │ ◀─── Backend JWT ─────────────── │           │
   └───────────┘                                   └───────────┘

3. Authenticated Requests
   ┌───────────┐     Authorization: Bearer <JWT>  ┌───────────┐
   │  Client   │ ──────────────────────────────▶ │  Server   │
   └───────────┘                                   └───────────┘
```

### Token Generation

```typescript
// utils/auth.ts
import jwt from '@fastify/jwt';

export const TOKEN_EXPIRY_SECONDS = 86400; // 24 hours

export function generateToken(fastify: FastifyInstance, userId: string): string {
  return fastify.jwt.sign(
    { userId },
    { expiresIn: TOKEN_EXPIRY_SECONDS }
  );
}

export function verifyToken(fastify: FastifyInstance, token: string): { userId: string } {
  return fastify.jwt.verify(token);
}
```

### Request Authentication

```typescript
// utils/userAuth.ts
export function extractUserFromRequest(request: FastifyRequest): User | null {
  // Check Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = request.server.jwt.verify(token);
      return { id: decoded.userId };
    } catch {
      return null;
    }
  }

  // Fallback for development
  if (!config.requireAuth) {
    return { id: generateSecureUserId() };
  }

  return null;
}
```

### Firebase Admin Integration

```typescript
// utils/firebaseAdmin.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let firebaseApp: FirebaseApp | null = null;

export function initializeFirebase(): void {
  if (firebaseApp) return;

  const credentials = config.firebaseCredentials;
  if (!credentials) {
    logger.warn('Firebase credentials not configured');
    return;
  }

  firebaseApp = initializeApp({
    credential: cert(JSON.parse(credentials)),
  });
}

export async function verifyFirebaseToken(idToken: string): Promise<DecodedIdToken> {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }

  return getAuth().verifyIdToken(idToken);
}
```

---

## Validation Layer

### Zod Schemas

All request validation uses Zod:

```typescript
// validation/puzzleSchema.ts
import { z } from 'zod';

export const puzzleContentSchema = z.object({
  grid: z.array(z.array(z.string())),
  solution: z.array(z.array(z.string())),
  info: z.object({
    title: z.string().min(1).max(200),
    author: z.string().max(100),
    copyright: z.string().optional(),
    description: z.string().optional(),
  }),
  clues: z.object({
    across: z.array(z.string()),
    down: z.array(z.string()),
  }),
  circles: z.array(z.string()).optional(),
  shades: z.array(z.string()).optional(),
});

export const createPuzzleSchema = z.object({
  puzzle: puzzleContentSchema,
  pid: z.string().optional(),
  isPublic: z.boolean(),
});
```

### Request Validation

```typescript
// In handler
async function createPuzzle(request: FastifyRequest, reply: FastifyReply) {
  const result = createPuzzleSchema.safeParse(request.body);
  if (!result.success) {
    return reply.status(400).send({
      error: 'Validation failed',
      details: result.error.issues,
    });
  }

  const { puzzle, pid, isPublic } = result.data;
  // Process validated data
}
```

### Input Sanitization

```typescript
// utils/inputValidation.ts
export function isValidGameId(gid: string): boolean {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(gid);
}

export function isValidPuzzleId(pid: string): boolean {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(pid);
}

// utils/htmlEscape.ts
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

---

## Configuration Management

### Centralized Config

All configuration in `config/index.ts`:

```typescript
import { z } from 'zod';

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  databaseUrl: z.string().optional(),
  pgHost: z.string().default('localhost'),
  pgPort: z.coerce.number().default(5432),
  pgUser: z.string(),
  pgPassword: z.string(),
  pgDatabase: z.string(),
  pgSslMode: z.string().optional(),
  dbPoolMin: z.coerce.number().default(5),
  dbPoolMax: z.coerce.number().default(20),

  // Auth
  authTokenSecret: z.string(),
  requireAuth: z.coerce.boolean().default(true),
  tokenExpiryMs: z.coerce.number().default(86400000),

  // Firebase
  firebaseCredentials: z.string().optional(),

  // Rate Limiting
  rateLimitMax: z.coerce.number().default(100),
  rateLimitWindowMs: z.coerce.number().default(60000),

  // CORS
  corsEnabled: z.coerce.boolean().default(true),
  corsOrigins: z.string().default('*'),

  // Features
  enableSwaggerUi: z.coerce.boolean().default(false),
});

export const config = configSchema.parse({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  pgHost: process.env.PGHOST,
  pgPort: process.env.PGPORT,
  pgUser: process.env.PGUSER,
  pgPassword: process.env.PGPASSWORD,
  pgDatabase: process.env.PGDATABASE,
  // ...
});

export const isProduction = config.nodeEnv === 'production';
export const isDevelopment = config.nodeEnv === 'development';
```

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `NODE_ENV` | Environment | `development` | No |
| `DATABASE_URL` | Full DB connection string | - | Either this or PG* vars |
| `PGHOST` | PostgreSQL host | `localhost` | No |
| `PGPORT` | PostgreSQL port | `5432` | No |
| `PGUSER` | PostgreSQL user | - | Yes |
| `PGPASSWORD` | PostgreSQL password | - | Yes |
| `PGDATABASE` | PostgreSQL database | - | Yes |
| `AUTH_TOKEN_SECRET` | JWT signing secret | - | Yes (prod) |
| `REQUIRE_AUTH` | Enforce authentication | `true` | No |
| `FIREBASE_CREDENTIALS_JSON` | Firebase service account | - | No |
| `CORS_ORIGINS` | Allowed CORS origins | `*` | No |
| `RATE_LIMIT_MAX` | Max requests per window | `100` | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` | No |

---

## Error Handling

### Error Creation

```typescript
// api/errors.ts
export function createNotFoundError(resource: string, id: string) {
  return {
    statusCode: 404,
    error: 'Not Found',
    message: `${resource} with id '${id}' not found`,
  };
}

export function createValidationError(details: unknown) {
  return {
    statusCode: 400,
    error: 'Validation Error',
    message: 'Request validation failed',
    details,
  };
}

export function createUnauthorizedError(message = 'Unauthorized') {
  return {
    statusCode: 401,
    error: 'Unauthorized',
    message,
  };
}
```

### Error Handler

```typescript
// server.ts
fastify.setErrorHandler((error, request, reply) => {
  const correlationId = request.correlationId;

  // Log error with context
  request.log.error({
    correlationId,
    error: error.message,
    stack: isDevelopment ? error.stack : undefined,
  });

  // Sanitize error for production
  const response = isProduction
    ? sanitizeError(error)
    : { ...error, stack: error.stack };

  reply.status(error.statusCode || 500).send(response);
});
```

### Error Sanitization

```typescript
// utils/errorSanitizer.ts
export function sanitizeError(error: Error): SafeError {
  // Never expose internal details in production
  return {
    statusCode: error.statusCode || 500,
    error: error.statusCode ? error.name : 'Internal Server Error',
    message: error.statusCode
      ? error.message
      : 'An unexpected error occurred',
  };
}
```

---

## Testing Patterns

### Test Setup

```typescript
// __tests__/setup.ts
import { vi } from 'vitest';

// Mock database
vi.mock('../model/pool', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

// Mock config
vi.mock('../config', () => ({
  config: {
    port: 3000,
    nodeEnv: 'test',
    requireAuth: false,
    // ...
  },
}));
```

### Test Utilities

```typescript
// __tests__/helpers.ts
import Fastify from 'fastify';

export async function buildTestApp() {
  const app = Fastify({ logger: false });

  // Register plugins
  await app.register(cors);
  await app.register(jwt, { secret: 'test-secret' });
  await app.register(routes);

  await app.ready();
  return app;
}

export async function closeApp(app: FastifyInstance) {
  await app.close();
}
```

### Handler Tests

```typescript
// __tests__/api/puzzle.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTestApp, closeApp } from '../helpers';
import * as puzzleModel from '../../model/puzzle';

vi.mock('../../model/puzzle');

describe('POST /api/puzzle', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await closeApp(app);
  });

  it('should create a puzzle', async () => {
    vi.mocked(puzzleModel.createPuzzle).mockResolvedValue({ pid: '123' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/puzzle',
      payload: {
        puzzle: { /* valid puzzle data */ },
        isPublic: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ pid: '123' });
  });

  it('should return 400 for invalid puzzle', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/puzzle',
      payload: { puzzle: {} },
    });

    expect(response.statusCode).toBe(400);
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/server.test.ts
describe('Server Integration', () => {
  it('should handle CORS correctly', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: { origin: 'http://localhost:3020' },
    });

    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should return 404 for unknown routes', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/unknown',
    });

    expect(response.statusCode).toBe(404);
  });
});
```

### Running Tests

```bash
yarn test:backend              # All tests
yarn test:backend:watch        # Watch mode
yarn test:backend:coverage     # With coverage
yarn test:backend -- <file>    # Specific file
```

---

## Adding New Features

### Adding a New Endpoint

1. **Update OpenAPI spec** (`openapi.json`):

```json
{
  "paths": {
    "/api/new-endpoint": {
      "get": {
        "operationId": "getNewEndpoint",
        "summary": "Description",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/NewResponse"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "NewResponse": {
        "type": "object",
        "properties": {
          "data": { "type": "string" }
        }
      }
    }
  }
}
```

2. **Generate types**:

```bash
yarn api:generate
```

3. **Add handler** (`api/handlers.ts`):

```typescript
export function createHandlers(fastify: AppInstance) {
  return {
    // ... existing handlers

    getNewEndpoint: async (request, reply) => {
      // Implementation
      return { data: 'result' };
    },
  };
}
```

4. **Add model** (if needed):

```typescript
// model/newFeature.ts
export async function getData(): Promise<Data> {
  const result = await pool.query('SELECT * FROM table');
  return result.rows;
}
```

5. **Add tests**:

```typescript
// __tests__/api/newEndpoint.test.ts
describe('GET /api/new-endpoint', () => {
  it('should return data', async () => {
    // Test implementation
  });
});
```

### Adding a Socket Event

1. **Define validation schema**:

```typescript
// validation/gameEvents.ts
export const newEventSchema = z.object({
  type: z.literal('newEvent'),
  params: z.object({
    // Event params
  }),
});
```

2. **Handle in SocketManager**:

```typescript
// SocketManager.ts
private handleGameEvent(socket: Socket, rawEvent: unknown) {
  const event = gameEventSchema.parse(rawEvent);

  switch (event.type) {
    case 'newEvent':
      this.handleNewEvent(socket, event);
      break;
    // ...
  }
}

private async handleNewEvent(socket: Socket, event: NewEvent) {
  // Persist to database
  await gameModel.addGameEvent({
    gid: socket.gameId,
    uid: socket.userId,
    ts: Date.now(),
    ...event,
  });

  // Broadcast to room
  socket.to(`game-${socket.gameId}`).emit('game_event', event);
}
```

3. **Add migration** (if schema changes):

```sql
-- migrations/XXX_add_new_feature.sql
ALTER TABLE game_events ADD COLUMN new_field text;
```

---

## Performance Considerations

### Database Optimization

- **Indexes**: Create indexes for frequently queried columns
- **Connection pooling**: Adjust `DB_POOL_MIN`/`DB_POOL_MAX` based on load
- **Query optimization**: Use `EXPLAIN ANALYZE` to profile slow queries

```sql
-- Example: Add index for puzzle searches
CREATE INDEX idx_puzzles_title_gin ON puzzles
  USING gin(to_tsvector('english', content->>'title'));
```

### Socket.io Optimization

- **Rate limiting**: Adjust `RATE_LIMIT_*` vars for your traffic
- **Room size**: Large rooms may need Redis adapter for scaling
- **Event batching**: Batch rapid events (e.g., cursor movements)

```typescript
// Debounce cursor updates
const debouncedCursorUpdate = debounce((socket, data) => {
  socket.to(room).emit('cursor_update', data);
}, 50);
```

### Caching Strategies

For high-traffic puzzles:

```typescript
import { LRUCache } from 'lru-cache';

const puzzleCache = new LRUCache<string, Puzzle>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

export async function getPuzzle(pid: string): Promise<Puzzle> {
  const cached = puzzleCache.get(pid);
  if (cached) return cached;

  const puzzle = await fetchFromDb(pid);
  puzzleCache.set(pid, puzzle);
  return puzzle;
}
```

### Monitoring

- **Health endpoint**: `/api/health` for Docker/K8s probes
- **Logging**: Structured JSON logs in production (Pino)
- **Correlation IDs**: Track requests across services

```typescript
// Add correlation ID to all requests
fastify.addHook('onRequest', (request, reply, done) => {
  request.correlationId = request.headers['x-correlation-id'] || uuid();
  done();
});
```
