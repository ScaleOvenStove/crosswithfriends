# API Client

Type-safe API client for CrossWithFriends backend, generated from the OpenAPI specification.

## Usage

```typescript
import { apiClient } from '@api/client';

// Health check
const health = await apiClient.health.get();

// Create a game
const game = await apiClient.games.create({
  gid: 'game123',
  pid: 'puzzle456',
});

// List puzzles
const puzzles = await apiClient.puzzles.list(0, 20);

// List puzzles with filters
const miniPuzzles = await apiClient.puzzles.list(0, 20, {
  sizeFilter: { Mini: true },
});

// Add a puzzle
const result = await apiClient.puzzles.add({
  puzzle: {
    version: 'http://ipuz.org/v1',
    kind: ['http://ipuz.org/crossword#1'],
    dimensions: { width: 15, height: 15 },
    title: 'My Puzzle',
    author: 'Author Name',
    solution: [...],
    puzzle: [...],
    clues: { Across: [...], Down: [...] },
  },
  isPublic: true,
});

// Record a solve
await apiClient.puzzles.recordSolve('puzzle456', {
  gid: 'game123',
  time_to_solve: 300,
});

// Get stats
const stats = await apiClient.stats.get({
  gids: ['game1', 'game2'],
});

// Get new IDs
const { gid } = await apiClient.counters.incrementGid();
const { pid } = await apiClient.counters.incrementPid();
```

## Error Handling

```typescript
import { ApiError } from '@api/client';

try {
  const result = await apiClient.puzzles.add({...});
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.statusCode, error.message);
    if (error.retryAfter) {
      console.log('Retry after', error.retryAfter, 'seconds');
    }
  }
}
```

## Types

All request and response types are available from `@api/types`:

```typescript
import type {
  PuzzleJson,
  CreateGameRequest,
  ListPuzzleResponse,
  PuzzleStatsJson,
} from '@api/types';
```

## File Upload

For file uploads (puzzle files), use the upload utility:

```typescript
import { uploadPuzzleFile } from '@api/upload';

const file = event.target.files[0];
const result = await uploadPuzzleFile(file, true); // true = public
console.log('Uploaded puzzle ID:', result.pid);
```

## API Endpoints

### Health

- `GET /health` - Health check

### Games

- `POST /game` - Create a new game
- `GET /game/:gid` - Get game information

### Puzzles

- `POST /puzzle` - Add a new puzzle
- `GET /puzzle_list` - List puzzles with pagination and filters
- `POST /record_solve/:pid` - Record a puzzle solve

### Stats

- `POST /stats` - Get statistics for multiple games

### Counters

- `POST /counters/gid` - Increment and get new game ID
- `POST /counters/pid` - Increment and get new puzzle ID

### Link Preview

- `GET /link_preview` - Generate Open Graph metadata
- `GET /oembed` - OEmbed endpoint

## Configuration

The API base URL is configured in `@config/index.ts`:

- Production: `https://www.crosswithfriends.com/api`
- Staging: `https://crosswithfriendsbackend-staging.onrender.com/api`
- Local: `http://localhost:3021/api`

The client automatically selects the correct URL based on environment variables.
