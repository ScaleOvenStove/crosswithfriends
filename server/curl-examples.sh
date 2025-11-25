#!/bin/bash

# Backend API curl test commands
# Default port: 3000 (or set PORT environment variable)
# Base URL: http://localhost:3000/api

BASE_URL="${BASE_URL:-http://localhost:3000/api}"

echo "Testing backend API at $BASE_URL"
echo "=================================="
echo ""

# Health check
echo "1. Health Check"
echo "---------------"
curl -X GET "$BASE_URL/health" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Get puzzle list
echo "2. Get Puzzle List (page 0, pageSize 10)"
echo "-----------------------------------------"
curl -X GET "$BASE_URL/puzzle_list?page=0&pageSize=10" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Get puzzle list with filters
echo "3. Get Puzzle List with Filters"
echo "--------------------------------"
curl -X GET "$BASE_URL/puzzle_list?page=0&pageSize=10&filter[sizeFilter][Standard]=true" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Increment GID counter
echo "4. Increment GID Counter"
echo "------------------------"
curl -X POST "$BASE_URL/counters/gid" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Increment PID counter
echo "5. Increment PID Counter"
echo "------------------------"
curl -X POST "$BASE_URL/counters/pid" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Create a game (requires valid pid)
echo "6. Create Game (requires valid pid - may fail if pid doesn't exist)"
echo "-------------------------------------------------------------------"
GID=$(curl -s -X POST "$BASE_URL/counters/gid" -H "Content-Type: application/json" | grep -o '"gid":"[^"]*"' | cut -d'"' -f4)
PID=$(curl -s -X POST "$BASE_URL/counters/pid" -H "Content-Type: application/json" | grep -o '"pid":"[^"]*"' | cut -d'"' -f4)
echo "Using GID: $GID, PID: $PID"
curl -X POST "$BASE_URL/game" \
  -H "Content-Type: application/json" \
  -d "{\"gid\":\"$GID\",\"pid\":\"$PID\"}" \
  -w "\nStatus: %{http_code}\n\n"

# Get game info (requires valid gid)
echo "7. Get Game Info (requires valid gid - may fail if game doesn't exist)"
echo "----------------------------------------------------------------------"
curl -X GET "$BASE_URL/game/$GID" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Get stats (requires valid gids array)
echo "8. Get Stats (requires valid gids - may fail if games don't exist)"
echo "-------------------------------------------------------------------"
curl -X POST "$BASE_URL/stats" \
  -H "Content-Type: application/json" \
  -d "{\"gids\":[\"$GID\"]}" \
  -w "\nStatus: %{http_code}\n\n"

# OEmbed endpoint
echo "9. OEmbed Endpoint"
echo "------------------"
curl -X GET "$BASE_URL/oembed?author=TestAuthor" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

# Link preview (requires valid URL)
echo "10. Link Preview (requires valid game/puzzle URL)"
echo "--------------------------------------------------"
curl -X GET "$BASE_URL/link_preview?url=http://localhost:3000/game/$GID" \
  -H "Content-Type: application/json" \
  -H "User-Agent: facebookexternalhit/1.1" \
  -w "\nStatus: %{http_code}\n\n"

# Add puzzle (POST with puzzle data)
echo "11. Add Puzzle (example - adjust puzzle content as needed)"
echo "-----------------------------------------------------------"
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
  -w "\nStatus: %{http_code}\n\n"

echo ""
echo "=================================="
echo "Testing complete!"

