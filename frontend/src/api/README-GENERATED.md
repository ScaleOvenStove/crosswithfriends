# Generated API Client

This directory contains an automatically generated TypeScript client for the CrossWithFriends API.

## 📁 Structure

```
src/api/
├── generated/           # Auto-generated code (do not edit manually)
│   ├── apis/           # API endpoint classes
│   ├── models/         # TypeScript interfaces/types
│   ├── runtime.ts      # Core fetch logic
│   └── index.ts        # Main exports
├── apiClient.ts        # Configured API client instances
└── README-GENERATED.md # This file
```

## 🚀 Usage

### Basic Example

```typescript
import { healthApi, puzzlesApi, countersApi } from '@/api/apiClient';

// Health check
const health = await healthApi.healthGet();
console.log(health.status); // 'ok'

// Get puzzle by ID
const puzzle = await puzzlesApi.puzzlePidGet({ pid: 'abc123' });

// Create new puzzle
const newPuzzle = await puzzlesApi.puzzlePost({
  puzzlePostRequest: {
    puzzle: {
      version: 'http://ipuz.org/v1',
      kind: ['http://ipuz.org/crossword#1'],
      dimensions: { width: 15, height: 15 },
      title: 'My Crossword',
      author: 'John Doe',
      solution: [...],
      puzzle: [...],
      clues: {
        Across: [...],
        Down: [...]
      }
    },
    isPublic: true
  }
});

// Get new counter IDs
const gameId = await countersApi.countersGidPost();
const puzzleId = await countersApi.countersPidPost();
```

### With React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { puzzlesApi } from '@/api/apiClient';

// Query
function usePuzzle(pid: string) {
  return useQuery({
    queryKey: ['puzzle', pid],
    queryFn: () => puzzlesApi.puzzlePidGet({ pid }),
  });
}

// Mutation
function useCreatePuzzle() {
  return useMutation({
    mutationFn: (request: PuzzlePostRequest) =>
      puzzlesApi.puzzlePost({ puzzlePostRequest: request }),
  });
}
```

### Error Handling

```typescript
import { puzzlesApi } from '@/api/apiClient';

try {
  const puzzle = await puzzlesApi.puzzlePidGet({ pid: 'invalid' });
} catch (error) {
  if (error instanceof Response) {
    const errorData = await error.json();
    console.error(errorData.message);
  }
}
```

## 🔄 Regenerating the Client

When the backend API changes, regenerate the client:

```bash
# Make sure your local server is running at http://localhost:3021
yarn api:regenerate
```

This will:

1. Download the latest OpenAPI spec from your local server
2. Fix any validation issues
3. Generate the TypeScript client
4. Format the generated code

### Manual Steps

If you need more control:

```bash
# 1. Download the spec
yarn api:download

# 2. Generate client
yarn api:generate

# 3. Format (if needed)
prettier --write "src/api/generated/**/*.ts"
```

## ⚙️ Configuration

The API client is pre-configured in `apiClient.ts` with:

- **Base URL**: Automatically set based on environment (production/staging/local)
- **Headers**: Content-Type: application/json
- **Fetch API**: Uses native browser `fetch()`

### Custom Configuration

If you need a custom configuration:

```typescript
import { Configuration, PuzzlesApi } from './generated';

const customConfig = new Configuration({
  basePath: 'https://custom-api.example.com/api',
  headers: {
    'X-Custom-Header': 'value',
  },
  credentials: 'include', // For cookies
});

const customPuzzlesApi = new PuzzlesApi(customConfig);
```

## 📝 Type Safety

All request and response types are fully typed:

```typescript
import type {
  PuzzlePostRequest,
  PuzzlePostRequestPuzzle,
  PuzzlePost200Response,
} from '@/api/apiClient';

const createPuzzle = async (puzzle: PuzzlePostRequestPuzzle) => {
  const request: PuzzlePostRequest = {
    puzzle,
    isPublic: true,
  };

  const response: PuzzlePost200Response = await puzzlesApi.puzzlePost({
    puzzlePostRequest: request,
  });

  return response.pid;
};
```

## 🚫 Do Not Edit

**Important**: Never edit files in the `generated/` directory directly. Your changes will be overwritten when the client is regenerated.

If you need to customize behavior:

- Modify `apiClient.ts` for configuration
- Create wrapper functions around the generated APIs
- Update the OpenAPI spec on the backend and regenerate

## 📚 Learn More

- [OpenAPI Generator Documentation](https://openapi-generator.tech/docs/generators/typescript-fetch)
- [Backend API Documentation](../../server/README.md)
