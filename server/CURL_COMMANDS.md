# Backend API curl Commands

Quick reference for testing the backend API endpoints.

## Configuration

Default ports:

- **Development**: `localhost:3021` (when running `yarn devbackend`)
- **Production**: `localhost:3000` (default)
- **Docker**: `localhost:3000` (mapped from container)

Set the base URL:

```bash
export BASE_URL="http://localhost:3021/api"  # Development
# or
export BASE_URL="http://localhost:3000/api"  # Production/Docker
```

## Health Check

```bash
# Basic health check
curl -X GET "$BASE_URL/health" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Pretty print JSON response
curl -X GET "$BASE_URL/health" \
  -H "Content-Type: application/json" | jq
```

## Counter Endpoints

### Get New Game ID (GID)

```bash
# Send empty JSON object {} - required when using Content-Type: application/json
curl -X POST "$BASE_URL/counters/gid" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n"

# Extract GID from response
GID=$(curl -s -X POST "$BASE_URL/counters/gid" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.gid')
echo "GID: $GID"
```

### Get New Puzzle ID (PID)

```bash
# Send empty JSON object {} - required when using Content-Type: application/json
curl -X POST "$BASE_URL/counters/pid" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n"

# Extract PID from response
PID=$(curl -s -X POST "$BASE_URL/counters/pid" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.pid')
echo "PID: $PID"
```

## Puzzle Endpoints

### List Puzzles

```bash
# Basic list (page 0, 10 puzzles)
curl -X GET "$BASE_URL/puzzle_list?page=0&pageSize=10" \
  -H "Content-Type: application/json" | jq

# With size filter (Standard puzzles only)
curl -X GET "$BASE_URL/puzzle_list?page=0&pageSize=10&filter[sizeFilter][Standard]=true" \
  -H "Content-Type: application/json" | jq

# With size filter (Mini puzzles only)
curl -X GET "$BASE_URL/puzzle_list?page=0&pageSize=10&filter[sizeFilter][Mini]=true" \
  -H "Content-Type: application/json" | jq

# With name/title search filter
curl -X GET "$BASE_URL/puzzle_list?page=0&pageSize=10&filter[nameOrTitleFilter]=test" \
  -H "Content-Type: application/json" | jq

# Combined filters
curl -X GET "$BASE_URL/puzzle_list?page=0&pageSize=10&filter[sizeFilter][Standard]=true&filter[nameOrTitleFilter]=crossword" \
  -H "Content-Type: application/json" | jq
```

### Add Puzzle

```bash
# Minimal puzzle (will fail validation, but shows structure)
curl -X POST "$BASE_URL/puzzle" \
  -H "Content-Type: application/json" \
  -d '{
    "puzzle": {
      "info": {
        "title": "Test Puzzle",
        "author": "Test Author",
        "description": "A test puzzle"
      },
      "grid": [],
      "clues": {"across": [], "down": []}
    },
    "isPublic": true
  }' \
  -w "\nStatus: %{http_code}\n"

# With explicit PID
curl -X POST "$BASE_URL/puzzle" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "custom-puzzle-id",
    "puzzle": {
      "info": {
        "title": "Custom Puzzle",
        "author": "Author Name"
      },
      "grid": [],
      "clues": {"across": [], "down": []}
    },
    "isPublic": false
  }' \
  -w "\nStatus: %{http_code}\n"
```

### Record Puzzle Solve

```bash
# Record a solve (requires valid PID and GID)
PID="your-puzzle-id"
GID="your-game-id"
TIME_TO_SOLVE=120  # seconds

curl -X POST "$BASE_URL/record_solve/$PID" \
  -H "Content-Type: application/json" \
  -d "{
    \"gid\": \"$GID\",
    \"time_to_solve\": $TIME_TO_SOLVE
  }" \
  -w "\nStatus: %{http_code}\n"
```

## Game Endpoints

### Create Game

```bash
# Create a new game (requires valid PID)
GID=$(curl -s -X POST "$BASE_URL/counters/gid" -H "Content-Type: application/json" | jq -r '.gid')
PID="your-puzzle-id"  # Must exist in database

curl -X POST "$BASE_URL/game" \
  -H "Content-Type: application/json" \
  -d "{
    \"gid\": \"$GID\",
    \"pid\": \"$PID\"
  }" \
  -w "\nStatus: %{http_code}\n"
```

### Get Game Info

```bash
# Get game information by GID
GID="your-game-id"

curl -X GET "$BASE_URL/game/$GID" \
  -H "Content-Type: application/json" | jq

# With error handling
curl -X GET "$BASE_URL/game/$GID" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"
```

## Stats Endpoints

### Get Statistics

```bash
# Get stats for one or more games
GID1="game-id-1"
GID2="game-id-2"

curl -X POST "$BASE_URL/stats" \
  -H "Content-Type: application/json" \
  -d "{
    \"gids\": [\"$GID1\", \"$GID2\"]
  }" | jq

# Single game
curl -X POST "$BASE_URL/stats" \
  -H "Content-Type: application/json" \
  -d "{
    \"gids\": [\"$GID1\"]
  }" | jq
```

## Link Preview & OEmbed

### OEmbed Endpoint

```bash
# Get OEmbed data
curl -X GET "$BASE_URL/oembed?author=TestAuthor" \
  -H "Content-Type: application/json" | jq
```

### Link Preview

```bash
# Generate link preview (requires valid game/puzzle URL)
GID="your-game-id"

# For link expander bots (returns HTML with Open Graph tags)
curl -X GET "$BASE_URL/link_preview?url=http://localhost:3000/game/$GID" \
  -H "Content-Type: application/json" \
  -H "User-Agent: facebookexternalhit/1.1" \
  -w "\nStatus: %{http_code}\n"

# For regular browsers (redirects)
curl -X GET "$BASE_URL/link_preview?url=http://localhost:3000/game/$GID" \
  -H "Content-Type: application/json" \
  -L \
  -w "\nStatus: %{http_code}\n"
```

## Complete Test Workflow

Here's a complete workflow to test the full API:

```bash
#!/bin/bash
BASE_URL="${BASE_URL:-http://localhost:3021/api}"

echo "=== Testing Backend API ==="
echo "Base URL: $BASE_URL"
echo ""

# 1. Health check
echo "1. Health Check"
curl -s -X GET "$BASE_URL/health" | jq
echo ""

# 2. Get IDs
echo "2. Getting new IDs"
GID=$(curl -s -X POST "$BASE_URL/counters/gid" -H "Content-Type: application/json" -d '{}' | jq -r '.gid')
PID=$(curl -s -X POST "$BASE_URL/counters/pid" -H "Content-Type: application/json" -d '{}' | jq -r '.pid')
echo "GID: $GID"
echo "PID: $PID"
echo ""

# 3. List puzzles
echo "3. Listing puzzles"
curl -s -X GET "$BASE_URL/puzzle_list?page=0&pageSize=5" | jq '.puzzles | length'
echo ""

# 4. Create game (may fail if PID doesn't exist)
echo "4. Creating game"
curl -s -X POST "$BASE_URL/game" \
  -H "Content-Type: application/json" \
  -d "{\"gid\":\"$GID\",\"pid\":\"$PID\"}" | jq
echo ""

# 5. Get game info (may fail if game doesn't exist)
echo "5. Getting game info"
curl -s -X GET "$BASE_URL/game/$GID" | jq
echo ""

# 6. Get stats
echo "6. Getting stats"
curl -s -X POST "$BASE_URL/stats" \
  -H "Content-Type: application/json" \
  -d "{\"gids\":[\"$GID\"]}" | jq
echo ""

echo "=== Testing Complete ==="
```

## Tips

1. **Pretty JSON**: Pipe responses through `jq` for formatted output:

   ```bash
   curl -s "$BASE_URL/health" | jq
   ```

2. **Save responses**: Use `-o` to save responses:

   ```bash
   curl -s "$BASE_URL/health" -o response.json
   ```

3. **Verbose mode**: Use `-v` to see request/response headers:

   ```bash
   curl -v "$BASE_URL/health"
   ```

4. **Follow redirects**: Use `-L` for endpoints that redirect:

   ```bash
   curl -L "$BASE_URL/link_preview?url=..."
   ```

5. **Error handling**: Check status codes with `-w`:
   ```bash
   curl -w "\nHTTP Status: %{http_code}\n" "$BASE_URL/health"
   ```

## Common Issues

- **400 "Body cannot be empty when content-type is set to 'application/json'"**:
  - When using `Content-Type: application/json`, you must send a JSON body, even if empty
  - Solution: Send `-d '{}'` for endpoints that don't require a body (like `/counters/gid` and `/counters/pid`)
  - Alternative: Omit the `Content-Type` header if the endpoint doesn't need it

- **404 Not Found**: Make sure the endpoint path is correct (all endpoints are under `/api`)

- **400 Bad Request**: Check request body format and required fields

- **Connection refused**: Ensure the server is running on the correct port

- **Database errors**: Ensure PostgreSQL is running and connection is configured
