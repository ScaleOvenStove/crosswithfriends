# Backend Server

Fastify-based HTTP and WebSocket server for the crosswithfriends application. This server provides RESTful API endpoints for managing crossword puzzles, games, and statistics, along with real-time WebSocket support for collaborative gameplay.

## Technologies

- **Framework**: [Fastify](https://www.fastify.io/) v5 - High-performance web framework
- **WebSocket**: [Socket.IO](https://socket.io/) v4 - Real-time bidirectional communication
- **Database**: PostgreSQL (via `pg` v8) - Event storage and game state
- **Validation**: [Joi](https://joi.dev/) v18 - Request validation
- **Runtime**: Node.js 20+ with TypeScript
- **Testing**: [Vitest](https://vitest.dev/) v4 - Unit and integration testing
- **Build**: TypeScript with `tsc` and `tsc-alias`

## Configuration

All configuration is provided via environment variables (12-factor). `.env` files are only loaded in development/test.
See `server/docs/environment.md` for the full list and defaults.

## Architecture

### Deployment Environments

#### Main Website

- **Production**: [https://www.crosswithfriends.com/](https://www.crosswithfriends.com/) (statically hosted via `serve`)
- **Staging/Alternative**: [https://downforacross-com.onrender.com](https://downforacross-com.onrender.com) (Render deployment)
- **Development**: `localhost:3020`

#### HTTP Server

- **Production**: `api.crosswithfriends.com` or `https://www.crosswithfriends.com/api`
- **Staging**: [https://crosswithfriendsbackend-staging.onrender.com](https://crosswithfriendsbackend-staging.onrender.com) or `api-staging.crosswithfriends.com`
- **Local Development**: `localhost:3021` (when running `yarn devbackend`)

#### WebSocket Server

- **Production**: `https://www.crosswithfriends.com/ws` or `wss://www.crosswithfriends.com/ws`
- **Staging**: `wss://crosswithfriendsbackend-staging.onrender.com/ws` or `https://crosswithfriendsbackend-staging.onrender.com/ws`
- **Development**: `localhost:3020` (using [CRA proxy](https://create-react-app.dev/docs/proxying-api-requests-in-development/))
- **Responsibilities**:
  - Handle pub/sub for game events
  - Real-time synchronization for collaborative solving

### Client Configuration

- **Production build** (`yarn build`): `SERVER_URL = "https://www.crosswithfriends.com"` or `"https://api.crosswithfriends.com"`
- **Staging build** (`yarn start`): `SERVER_URL = "https://crosswithfriendsbackend-staging.onrender.com"` or `"https://api-staging.crosswithfriends.com"`
- **Local development** (`yarn devfrontend`): `SERVER_URL = "localhost:3021"` (requires `process.env.REACT_APP_USE_LOCAL_SERVER=1`)

## API Schema

All endpoints are prefixed with `/api`.

### Health Check

#### `GET /api/health`

Health check endpoint for Docker and monitoring.

**Response:**

```typescript
{
  status: 'ok';
  timestamp: string; // ISO 8601 format
  uptime: number; // Process uptime in seconds
}
```

### Game Endpoints

#### `POST /api/game`

Create a new game.

**Request Body:**

```typescript
{
  gid: string; // Game ID
  pid: string; // Puzzle ID
}
```

**Response:**

```typescript
{
  gid: string;
}
```

#### `GET /api/game/:gid`

Get game information by game ID.

**Parameters:**

- `gid` (path): Game ID

**Response:**

```typescript
{
  gid: string;
  title: string;
  author: string;
  duration: number; // Time taken to solve (in seconds)
  size: string; // Puzzle size (e.g., "Mini", "Standard")
}
```

**Errors:**

- `404`: Game not found

### Puzzle Endpoints

#### `POST /api/puzzle`

Add a new puzzle.

**Request Body:**

```typescript
{
  puzzle: PuzzleJson;  // Puzzle data (see types below)
  pid?: string;        // Optional puzzle ID (if not provided, backend generates one)
  isPublic: boolean;
}
```

**Response:**

```typescript
{
  pid: string; // Puzzle ID
}
```

#### `GET /api/puzzle_list`

List puzzles with pagination and filtering.

**Query Parameters:**

- `page` (string): Page number (0-indexed)
- `pageSize` (string): Number of puzzles per page
- `filter` (object): Filter object with:
  - `sizeFilter.Mini` (string): "true" or "false"
  - `sizeFilter.Standard` (string): "true" or "false"
  - `nameOrTitleFilter` (string): Search term

**Response:**

```typescript
{
  puzzles: Array<{
    pid: string;
    content: PuzzleJson;
    stats: {
      numSolves: number;
    };
  }>;
}
```

**Errors:**

- `400`: Invalid page or pageSize parameters

### Record Solve Endpoints

#### `POST /api/record_solve/:pid`

Record a puzzle solve.

**Parameters:**

- `pid` (path): Puzzle ID

**Request Body:**

```typescript
{
  gid: string;
  time_to_solve: number; // Time in seconds
}
```

**Response:**

```typescript
{
}
```

### Stats Endpoints

#### `POST /api/stats`

Get statistics for multiple games.

**Request Body:**

```typescript
{
  gids: string[];  // Array of game IDs
}
```

**Response:**

```typescript
{
  stats: Array<{
    size: string;
    nPuzzlesSolved: number;
    avgSolveTime: number;
    bestSolveTime: number;
    bestSolveTimeGameId: string;
    avgCheckedSquareCount: number;
    avgRevealedSquareCount: number;
  }>;
  history: Array<{
    puzzleId: string;
    gameId: string;
    title: string;
    size: string;
    dateSolved: string; // Format: "YYYY-MM-DD"
    solveTime: number;
    checkedSquareCount: number;
    revealedSquareCount: number;
  }>;
}
```

**Errors:**

- `400`: Invalid gids array

### Counter Endpoints

#### `POST /api/counters/gid`

Increment and get a new game ID.

**Request Body:**

```typescript
{
}
```

**Response:**

```typescript
{
  gid: string;
}
```

#### `POST /api/counters/pid`

Increment and get a new puzzle ID.

**Request Body:**

```typescript
{
}
```

**Response:**

```typescript
{
  pid: string;
}
```

### Link Preview Endpoints

#### `GET /api/link_preview`

Generate Open Graph metadata for game or puzzle links.

**Query Parameters:**

- `url` (string): URL to generate preview for (must be a game or puzzle URL)

**Response:**

- HTML with Open Graph meta tags
- Redirects if not a link expander bot

**Errors:**

- `400`: Invalid URL or URL path
- `404`: Game or puzzle not found

#### `GET /api/oembed`

OEmbed endpoint for link previews.

**Query Parameters:**

- `author` (string): Author name

**Response:**

```typescript
{
  type: 'link';
  version: '1.0';
  author_name: string;
}
```

### Type Definitions

#### `PuzzleJson`

```typescript
{
  grid: string[][];
  solution: string[][];
  info: InfoJson;
  circles: string[];
  shades: string[];
  clues: CluesJson;
  private?: boolean;
}
```

#### `InfoJson`

```typescript
{
  type?: string;
  title: string;
  author: string;
  copyright: string;
  description: string;
}
```

#### `CluesJson`

```typescript
{
  across: string[];
  down: string[];
}
```

## WebSocket API

The server uses Socket.IO for real-time communication. Clients can connect to rooms and receive game/room events.

**For comprehensive documentation of all Socket.IO events, see [SOCKET_API.md](SOCKET_API.md).**

### Quick Overview

#### Client → Server Events

- `latency_ping` - Measure round-trip latency
- `join_game` - Join a game room
- `leave_game` - Leave a game room
- `sync_all_game_events` - Retrieve all historical game events
- `game_event` - Emit a new game event
- `join_room` - Join a room (lobby)
- `leave_room` - Leave a room
- `sync_all_room_events` - Retrieve all historical room events
- `room_event` - Emit a new room event

#### Server → Client Events

- `latency_pong` - Latency measurement response
- `game_event` - Broadcast to all clients in `game-{gid}` room
- `room_event` - Broadcast to all clients in `room-{rid}` room

### SocketManager

The `SocketManager` class handles:

- Adding game events to the database and broadcasting to connected clients
- Adding room events to the database and broadcasting to connected clients
- Retrieving historical game/room events for new connections
- Timestamp validation and assignment for all events
- Event validation using Zod schemas

## Database

All game events are stored in PostgreSQL.

### Schema

```sql
CREATE DATABASE dfac;

\c dfac;

CREATE TABLE game_events(
  gid text,
  uid text,
  ts timestamp without time zone,
  event_type text,
  event_payload json
);
```

### Connection

The server uses PostgreSQL connection pooling via the `pg` library. Connection parameters are configured via environment variables (see [Environment Variables](#environment-variables)).

## Getting Started

> **Note**: If you aren't making changes to `server/server.ts`, you don't need to run the backend locally. In this case, just run `yarn start` from the root directory.

### Prerequisites

1. **Node.js**: Version 20.0.0 or higher
2. **PostgreSQL**: Install and start PostgreSQL
   - **macOS**: `brew install postgresql && brew services start postgresql`
   - **Linux**: `sudo apt-get install postgresql postgresql-contrib && sudo systemctl start postgresql`
   - **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
3. **Yarn**: Version 4.11.0 (managed via Corepack)
4. **DirEnv** (optional but recommended): For automatic environment variable loading

### Setup

1. **Create the database:**

   ```bash
   psql -c 'create database dfac'
   ```

   (Use `createdb dfac` if the above fails)

2. **Initialize the database schema:**

   You can use the migration system (recommended):

   ```bash
   yarn migrate
   ```

   Or use the legacy script:

   ```bash
   ./create_fresh_dbs.sh dfac
   ```

   Or manually:

   ```bash
   psql dfac < sql/create_game_events.sql
   ```

3. **Configure environment variables:**

   Copy `.envrc.template` to `.envrc` in the root directory and set the following variables:

   ```bash
   export PGDATABASE=dfac
   export PGUSER=postgres
   export PGPASSWORD=password
   ```

   Make sure you have [DirEnv](https://direnv.net/) installed to automatically load these variables, or manually source them:

   ```bash
   source .envrc
   ```

### Database Migrations

The project uses a migration system to track and apply database schema changes. Migrations are stored in the `server/migrations/` directory.

#### Check Migration Status

To check if your database is up to date with all migrations:

```bash
yarn check-migrations
```

This will show:

- Which migrations have been applied
- Which migrations are missing
- When each migration was applied

#### Apply Missing Migrations

To automatically apply any missing migrations:

```bash
yarn migrate
```

This will:

- Check for missing migrations
- Apply them in order
- Record them in the `schema_migrations` table

#### Migration System Details

- Migrations are tracked in the `schema_migrations` table
- Each migration file is checksummed to detect modifications
- Migrations are applied in alphabetical order (by filename)
- The migration system automatically creates the tracking table if it doesn't exist

### Environment Variables

The following environment variables are used by the server:

| Variable     | Description                                    | Default       | Required |
| ------------ | ---------------------------------------------- | ------------- | -------- |
| `PGDATABASE` | PostgreSQL database name                       | -             | Yes      |
| `PGUSER`     | PostgreSQL username                            | -             | Yes      |
| `PGPASSWORD` | PostgreSQL password                            | -             | Yes      |
| `PGHOST`     | PostgreSQL host                                | `localhost`   | No       |
| `PGPORT`     | PostgreSQL port                                | `5432`        | No       |
| `PORT`       | HTTP server port                               | `3000`        | No       |
| `NODE_ENV`   | Environment mode (`production`, `development`) | `development` | No       |

### Running the Server

#### Development Mode

**Backend Server Only:**

```bash
yarn devbackend
```

This runs the backend server on `localhost:3021` with hot-reload enabled. The server expects PostgreSQL environment variables to be set.

**Frontend + Backend:**

```bash
yarn dev
```

This runs both frontend and backend concurrently. The frontend runs on `localhost:3020` and communicates with the backend on `localhost:3021`.

**Frontend Only:**

```bash
yarn devfrontend
```

This runs the frontend server on `localhost:3020`, which communicates with the backend server on `localhost:3021` (or staging/production if configured).

#### Production Mode

**Build:**

```bash
yarn build:backend
```

**Start:**

```bash
yarn start:backend
```

Or use the production serve script:

```bash
yarn servebackendprod  # Production
yarn servebackendstaging  # Staging
```

### Testing

The backend uses Vitest for testing. See [`__tests__/README.md`](__tests__/README.md) for detailed testing documentation.

**Run all tests:**

```bash
yarn test:backend
```

**Run tests in watch mode:**

```bash
yarn test:backend:watch
```

**Run tests with coverage:**

```bash
yarn test:backend:coverage
```

**Run a specific test file:**

```bash
yarn test:backend -- path/to/test.test.ts
```

### Manual Testing

1. Start the backend server: `yarn devbackend`
2. Create a game by clicking a puzzle on the homepage at `localhost:3020/`
3. Check the backend process logs for a stream of events
4. Inspect the database manually using `psql` or pgAdmin:

   ```bash
   psql dfac
   SELECT * FROM game_events ORDER BY ts DESC LIMIT 10;
   ```

## Docker Deployment

The server includes a production-ready Dockerfile with multi-stage builds.

### Building the Docker Image

```bash
docker build -t crosswithfriends-server -f server/Dockerfile .
```

### Running the Container

```bash
docker run -p 3021:3000 \
  -e PGDATABASE=dfac \
  -e PGUSER=postgres \
  -e PGPASSWORD=password \
  -e PGHOST=host.docker.internal \
  crosswithfriends-server
```

The Dockerfile includes:

- Multi-stage build for optimized image size
- Health check endpoint at `/api/health`
- Non-root user for security
- Proper signal handling with `dumb-init`

## Project Structure

```
server/
├── api/              # API route handlers
│   ├── counters.ts   # ID counter endpoints
│   ├── game.ts       # Game management endpoints
│   ├── health.ts     # Health check endpoint
│   ├── link_preview.ts  # Link preview generation
│   ├── oembed.ts     # OEmbed endpoint
│   ├── puzzle.ts     # Puzzle CRUD endpoints
│   ├── puzzle_list.ts # Puzzle listing endpoint
│   ├── record_solve.ts # Solve recording endpoint
│   ├── router.ts     # Main API router
│   └── stats.ts      # Statistics endpoints
├── __tests__/        # Test files
├── model/            # Database models and queries
├── sql/              # SQL schema files
├── utils/            # Utility functions
├── validation/       # Request validation schemas
├── server.ts         # Main server entry point
├── SocketManager.ts  # WebSocket event management
├── Dockerfile        # Docker configuration
└── package.json      # Dependencies and scripts
```

## OpenAPI Spec-First Development

The backend uses a **spec-first** approach where `openapi.json` is the single source of truth for the API contract. Routes are automatically generated from the spec, and TypeScript types are derived from it.

### How It Works

1. **OpenAPI Spec**: The `openapi.json` file defines all API endpoints, request/response schemas, and validation rules
2. **Route Generation**: `fastify-openapi-glue` automatically creates Fastify routes from the spec
3. **Handler Implementation**: Business logic is implemented in `api/handlers.ts`, mapped by `operationId`
4. **Type Generation**: `openapi-typescript` generates TypeScript types from the spec

### Architecture

```
openapi.json          (Source of Truth)
    │
    ├──► api/generated/types.ts     (Generated types for backend)
    ├──► api/generated/index.ts     (Convenience type exports)
    ├──► fastify-openapi-glue       (Auto-generates routes)
    └──► frontend/src/api/generated (Generated API client)
```

### Key Files

| File                     | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `openapi.json`           | OpenAPI 3.0 specification - the source of truth |
| `api/handlers.ts`        | Handler implementations mapped by operationId   |
| `api/generated/types.ts` | Auto-generated TypeScript types                 |
| `api/generated/index.ts` | Convenience type exports                        |

### Generating Types

After modifying `openapi.json`:

```bash
# From server directory
yarn api:generate

# Or from root directory
yarn api:generate:server    # Server types only
yarn api:generate:frontend  # Frontend client only
yarn api:generate           # Both
```

### Available Scripts

| Script              | Description                                 |
| ------------------- | ------------------------------------------- |
| `yarn api:generate` | Generate TypeScript types from openapi.json |

### Adding a New Endpoint

1. **Add to `openapi.json`**: Define the path, method, operationId, request/response schemas
2. **Generate types**: Run `yarn api:generate`
3. **Implement handler**: Add handler function in `api/handlers.ts` with the operationId name
4. **Update frontend**: Run `yarn api:generate:frontend` from root

### Example: Adding a New Endpoint

**1. Add to `openapi.json`:**

```json
{
  "paths": {
    "/new-endpoint": {
      "get": {
        "operationId": "getNewEndpoint",
        "summary": "Description of endpoint",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "data": {"type": "string"}
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**2. Add handler in `api/handlers.ts`:**

```typescript
export function createHandlers(fastify: AppInstance) {
  return {
    // ... existing handlers ...

    getNewEndpoint: async (request: any, reply: any) => {
      return {data: 'Hello World'};
    },
  };
}
```

### Type Import Pattern

```typescript
// Import from generated types
import type {CreateGameRequest, CreateGameResponse, GetGameResponse} from './generated/index.js';
```

## Development Workflow

1. **Make changes** to `openapi.json` for API changes
2. **Regenerate types**: `yarn api:generate`
3. **Run tests** to ensure nothing breaks: `yarn test:backend`
4. **Lint code**: `yarn lint:backend`
5. **Format code**: `yarn format`
6. **Test locally**: `yarn devbackend`
7. **Commit changes** (lint-staged will run automatically)

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready` or `psql -l`
- Check environment variables are set: `echo $PGDATABASE`
- Test connection: `psql -d dfac -U $PGUSER`

### Port Already in Use

- Change the port: `PORT=3022 yarn devbackend`
- Find and kill the process: `lsof -ti:3021 | xargs kill`

### TypeScript Errors

- Clean build: `rm -rf server/dist && yarn build:backend`
- Check TypeScript config: `tsc --noEmit -p server/tsconfig.json`

## License

See the root [LICENSE](../LICENSE) file for license information.
