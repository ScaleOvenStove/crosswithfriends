# OpenAPI Generator Setup - Complete ✅

Successfully configured OpenAPI Generator for the CrossWithFriends frontendv2 project!

## 📋 What Was Done

### 1. Installed OpenAPI Generator CLI

- Added `@openapitools/openapi-generator-cli` v2.25.2 as a dev dependency
- Created configuration in `openapitools.json`

### 2. Generated TypeScript Client

- Located in `src/api/generated/`
- Uses `typescript-fetch` generator
- Automatically formatted with Prettier during generation
- Fully typed with TypeScript interfaces

### 3. Created Helper Scripts

- **`fix-openapi.py`** - Fixes validation errors in the OpenAPI spec
- **`apiClient.ts`** - Pre-configured API client instances
- **`examples.ts`** - Usage examples and React Query integration

### 4. Added NPM Scripts

```json
{
  "api:download": "Downloads OpenAPI spec from localhost:3021",
  "api:generate": "Generates TypeScript client (with auto-formatting)",
  "api:regenerate": "Full workflow: download → fix → generate"
}
```

### 5. Updated Configuration

- Fixed API base URL to `localhost:3021` (was 3000)
- Added `API_BASE_URL` export to `config/index.ts`
- Updated `.gitignore` to exclude OpenAPI files

## 🎯 Usage

### Regenerate Client (When Backend Changes)

```bash
# Make sure server is running first
cd ../server && yarn dev  # In another terminal

# Then regenerate
cd ../frontendv2
yarn api:regenerate
```

### Use the Generated Client

```typescript
import { healthApi, puzzlesApi, countersApi } from '@/api/apiClient';

// Health check
const health = await healthApi.healthGet();

// Get puzzle
const puzzle = await puzzlesApi.puzzlePidGet('puzzle-id-123');

// Create puzzle
const result = await puzzlesApi.puzzlePost({
  puzzle: {
    /* puzzle data */
  },
  isPublic: true,
});
```

### With React Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { puzzlesApi } from '@/api/apiClient';

function usePuzzle(puzzleId: string) {
  return useQuery({
    queryKey: ['puzzle', puzzleId],
    queryFn: () => puzzlesApi.puzzlePidGet(puzzleId),
  });
}
```

## 🔧 Technical Details

### API Endpoints Available

| Endpoint              | Method | Description       |
| --------------------- | ------ | ----------------- |
| `/health/`            | GET    | Health check      |
| `/puzzle_list/`       | GET    | List puzzles      |
| `/puzzle/`            | POST   | Create puzzle     |
| `/puzzle/{pid}`       | GET    | Get puzzle by ID  |
| `/game/`              | POST   | Create game       |
| `/game/{gid}`         | GET    | Get game by ID    |
| `/record_solve/{pid}` | POST   | Record solve      |
| `/stats/`             | POST   | Submit stats      |
| `/counters/gid`       | POST   | Get new game ID   |
| `/counters/pid`       | POST   | Get new puzzle ID |

### OpenAPI Spec Source

```
http://localhost:3021/api/docs/json
```

The server exposes its OpenAPI 3.0.3 specification via Fastify Swagger at this endpoint.

### Automatic Formatting

The generator uses `TS_POST_PROCESS_FILE` environment variable to automatically run Prettier on each generated file:

```bash
TS_POST_PROCESS_FILE='yarn prettier --write' yarn api:generate
```

This means no separate formatting step is needed!

## 📁 File Structure

```
frontendv2/
├── src/
│   ├── api/
│   │   ├── generated/           # Auto-generated (DO NOT EDIT)
│   │   │   ├── apis/           # API classes
│   │   │   ├── models/         # TypeScript types
│   │   │   └── runtime.ts      # Fetch runtime
│   │   ├── apiClient.ts        # 👈 Use this for imports
│   │   ├── examples.ts         # Usage examples
│   │   └── README-GENERATED.md # Detailed docs
│   └── config/
│       └── index.ts            # Added API_BASE_URL export
├── openapi.json                # Downloaded spec (gitignored)
├── openapi-fixed.json          # Fixed spec (gitignored)
├── openapitools.json           # Generator config
└── package.json                # Added scripts
```

## ✅ Next Steps

1. **Start using the client** - Import from `@/api/apiClient`
2. **Integrate with React Query** - See `examples.ts` for patterns
3. **Regenerate on API changes** - Run `yarn api:regenerate`
4. **Add to CI/CD** - Consider checking if generated client is up-to-date

## 📚 Documentation

- [OPENAPI_SETUP.md](./OPENAPI_SETUP.md) - Full setup guide
- [src/api/README-GENERATED.md](./src/api/README-GENERATED.md) - API client usage
- [src/api/examples.ts](./src/api/examples.ts) - Code examples

## 🎉 Success Indicators

- ✅ `yarn api:regenerate` runs without errors
- ✅ Generated files are automatically formatted
- ✅ TypeScript types are fully generated
- ✅ API client is pre-configured with correct base URLs
- ✅ Examples and documentation are provided

---

**Setup completed successfully!** You now have a fully typed, auto-generated API client that stays in sync with your backend.
