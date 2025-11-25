# Socket.IO Events API Documentation

This document describes all Socket.IO events handled by the server and emitted to connected clients.

## Connection

### `connection`

**Direction**: Server-side handler
**Triggered**: When a client successfully connects via Socket.IO

The server listens for new connections and sets up all event handlers for the connected socket.

```typescript
io.on('connection', (socket) => {
  // Socket is now connected
  // All event handlers are registered here
});
```

### `disconnect`

**Direction**: Server-side handler
**Triggered**: When a client disconnects

**Parameters**:

- `reason` (string): The reason for disconnection

**Example**:

```typescript
socket.on('disconnect', (reason) => {
  console.log('Client disconnected:', reason);
});
```

---

## Latency Measurement

### `latency_ping`

**Direction**: Client → Server
**Purpose**: Measure round-trip latency between client and server

**Parameters**:

- `clientTimestamp` (number): The client's current timestamp in milliseconds

**Response**: Server emits `latency_pong` with calculated latency

**Validation**:

- `clientTimestamp` must be a valid number

**Example**:

```typescript
// Client
const clientTimestamp = Date.now();
socket.emit('latency_ping', clientTimestamp);

socket.on('latency_pong', (latency) => {
  console.log('Latency:', latency, 'ms');
});
```

### `latency_pong`

**Direction**: Server → Client
**Purpose**: Response to `latency_ping` with calculated round-trip latency

**Parameters**:

- `latency` (number): Calculated round-trip latency in milliseconds

---

## Game Events

### `join_game`

**Direction**: Client → Server
**Purpose**: Join a game room to receive game event broadcasts

**Parameters**:

- `gid` (string): The game ID to join

**Callback Parameters**:

- Success: `{ success: true }`
- Error: `{ error: string }` (e.g., "Invalid game ID", "Failed to join game")

**Validation**:

- `gid` must be a non-empty string

**Example**:

```typescript
socket.emit('join_game', 'game-123', (response) => {
  if (response.success) {
    console.log('Successfully joined game');
  } else {
    console.error('Failed to join:', response.error);
  }
});
```

### `leave_game`

**Direction**: Client → Server
**Purpose**: Leave a game room and stop receiving game event broadcasts

**Parameters**:

- `gid` (string): The game ID to leave

**Callback Parameters**:

- Success: `{ success: true }`
- Error: `{ error: string }`

**Validation**:

- `gid` must be a non-empty string

**Example**:

```typescript
socket.emit('leave_game', 'game-123', (response) => {
  if (response.success) {
    console.log('Successfully left game');
  }
});
```

### `sync_all_game_events`

**Direction**: Client → Server
**Purpose**: Retrieve all historical events for a game (for initial sync or recovery)

**Parameters**:

- `gid` (string): The game ID to sync

**Callback Parameters**:

- Success: Array of `GameEvent` objects
- Error: `{ error: string }`

**Validation**:

- `gid` must be a non-empty string

**Example**:

```typescript
socket.emit('sync_all_game_events', 'game-123', (events) => {
  if (Array.isArray(events)) {
    console.log('Received', events.length, 'game events');
    // Process events...
  } else {
    console.error('Sync failed:', events.error);
  }
});
```

### `game_event` (Client → Server)

**Direction**: Client → Server
**Purpose**: Emit a new game event (e.g., player move, cell update, etc.)

**Parameters**:

- `message` (object):
  - `gid` (string): The game ID
  - `event` (GameEvent): The game event to add

**Callback Parameters**:

- Success: `{ success: true }`
- Error: `{ error: string }` (validation errors, authorization errors, etc.)

**Validation**:

- `message` must be a valid object
- `gid` must be a non-empty string
- `event` must pass GameEvent validation (Zod schema)
- Event timestamp is automatically assigned if missing or invalid

**GameEvent Structure**:

```typescript
interface GameEvent {
  type: string; // Event type (e.g., "create", "update_cell", "check")
  timestamp: number; // Unix timestamp in milliseconds
  id?: string; // User/player ID (optional)
  params?: unknown; // Event-specific parameters
  // Additional fields vary by event type
}
```

**Example**:

```typescript
socket.emit(
  'game_event',
  {
    gid: 'game-123',
    event: {
      type: 'update_cell',
      timestamp: Date.now(),
      id: 'player-456',
      params: {
        row: 0,
        col: 0,
        value: 'A',
      },
    },
  },
  (response) => {
    if (response.success) {
      console.log('Event processed successfully');
    } else {
      console.error('Event failed:', response.error);
    }
  }
);
```

### `game_event` (Server → Clients)

**Direction**: Server → Clients (broadcast to game room)
**Purpose**: Notify all players in a game of a new event

**Broadcast Target**: All sockets in the game room (`game-${gid}`)

**Parameters**:

- `gameEvent` (GameEvent): The validated and persisted game event

**Example** (client receives):

```typescript
socket.on('game_event', (gameEvent) => {
  console.log('Game event received:', gameEvent.type);
  // Update local game state based on event
});
```

---

## Room Events

### `join_room`

**Direction**: Client → Server
**Purpose**: Join a room (lobby) to receive room event broadcasts

**Parameters**:

- `rid` (string): The room ID to join

**Callback Parameters**:

- Success: `{ success: true }`
- Error: `{ error: string }`

**Validation**:

- `rid` must be a non-empty string

**Example**:

```typescript
socket.emit('join_room', 'room-abc', (response) => {
  if (response.success) {
    console.log('Successfully joined room');
  }
});
```

### `leave_room`

**Direction**: Client → Server
**Purpose**: Leave a room and stop receiving room event broadcasts

**Parameters**:

- `rid` (string): The room ID to leave

**Callback Parameters**:

- Success: `{ success: true }`
- Error: `{ error: string }`

**Validation**:

- `rid` must be a non-empty string

**Example**:

```typescript
socket.emit('leave_room', 'room-abc', (response) => {
  if (response.success) {
    console.log('Successfully left room');
  }
});
```

### `sync_all_room_events`

**Direction**: Client → Server
**Purpose**: Retrieve all historical events for a room (for initial sync or recovery)

**Parameters**:

- `rid` (string): The room ID to sync

**Callback Parameters**:

- Success: Array of `RoomEvent` objects
- Error: `{ error: string }`

**Validation**:

- `rid` must be a non-empty string

**Example**:

```typescript
socket.emit('sync_all_room_events', 'room-abc', (events) => {
  if (Array.isArray(events)) {
    console.log('Received', events.length, 'room events');
  }
});
```

### `room_event` (Client → Server)

**Direction**: Client → Server
**Purpose**: Emit a new room event (e.g., chat message, player join/leave, etc.)

**Parameters**:

- `message` (object):
  - `rid` (string): The room ID
  - `event` (RoomEvent): The room event to add

**Callback Parameters**:

- Success: `{ success: true }`
- Error: `{ error: string }`

**Validation**:

- `message` must be a valid object
- `rid` must be a non-empty string
- `event` must pass RoomEvent validation (Zod schema)
- Event timestamp is automatically assigned if missing or invalid

**RoomEvent Structure**:

```typescript
interface RoomEvent {
  type: string; // Event type
  timestamp: number; // Unix timestamp in milliseconds
  uid?: string; // User ID (optional)
  // Additional fields vary by event type
}
```

**Example**:

```typescript
socket.emit(
  'room_event',
  {
    rid: 'room-abc',
    event: {
      type: 'chat_message',
      timestamp: Date.now(),
      uid: 'user-456',
      message: 'Hello everyone!',
    },
  },
  (response) => {
    if (response.success) {
      console.log('Room event processed');
    }
  }
);
```

### `room_event` (Server → Clients)

**Direction**: Server → Clients (broadcast to room)
**Purpose**: Notify all users in a room of a new event

**Broadcast Target**: All sockets in the room (`room-${rid}`)

**Parameters**:

- `roomEvent` (RoomEvent): The validated and persisted room event

**Example** (client receives):

```typescript
socket.on('room_event', (roomEvent) => {
  console.log('Room event received:', roomEvent.type);
  // Update UI based on event (e.g., display chat message)
});
```

---

## Error Handling

### `error`

**Direction**: Server-side handler
**Triggered**: When a socket error occurs

**Parameters**:

- `error` (Error): The error object

**Example**:

```typescript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

---

## Implementation Notes

### Timestamp Assignment

The server automatically handles timestamp assignment for all events:

- If an event has a `timestamp` field that is null, invalid, or missing, it will be set to `Date.now()`
- Firebase-style timestamp placeholders (`{ .sv: 'timestamp' }`) are converted to `Date.now()`
- This ensures all events have valid timestamps regardless of client-side issues

### Event Broadcasting

When a valid event is received and persisted:

1. The event is validated using Zod schemas
2. Timestamps are assigned/validated
3. The event is persisted to the database
4. The event is broadcast to all connected clients in the relevant room

### Room Naming Convention

- Game rooms: `game-${gid}`
- Regular rooms: `room-${rid}`

This prevents collisions if a game ID and room ID happen to match.

### Authorization (TODO)

The following authorization checks are planned but not yet implemented:

- Verify user token on connection
- Verify user is authorized to join specific games/rooms
- Verify event emitter matches authenticated user ID
- Reject unauthorized access attempts

### Acknowledgment Callbacks

All client-emitted events support optional acknowledgment callbacks that return:

- Success response: `{ success: true }`
- Error response: `{ error: string }` with a descriptive error message

Always include a callback to handle potential errors gracefully.

---

## Common Error Messages

| Error Message                    | Cause                                | Solution                                                 |
| -------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| "Invalid game ID"                | Empty or non-string gid              | Provide a valid non-empty string game ID                 |
| "Invalid room ID"                | Empty or non-string rid              | Provide a valid non-empty string room ID                 |
| "Invalid message structure"      | Message is null or not an object     | Send a properly structured message object                |
| "Invalid latency_ping timestamp" | Timestamp is not a valid number      | Send a valid numeric timestamp                           |
| "Failed to join game"            | Server error during join             | Check server logs, retry after delay                     |
| "Failed to process game event"   | Server error during event processing | Check event structure and server logs                    |
| Validation error messages        | Event failed Zod schema validation   | Check event structure matches GameEvent/RoomEvent schema |

---

## Best Practices

1. **Always use acknowledgment callbacks** to handle success/error responses
2. **Handle reconnection logic** to recover from disconnects
3. **Sync events on reconnect** using `sync_all_game_events` or `sync_all_room_events`
4. **Validate data client-side** before sending to reduce server validation errors
5. **Handle timestamp automatically** - don't try to manually set timestamps, let the server handle it
6. **Join rooms before emitting events** - ensure you've joined the relevant game/room before emitting events
7. **Leave rooms when done** to reduce server resource usage
8. **Use latency_ping** periodically to monitor connection quality
9. **Handle errors gracefully** - display user-friendly messages for common errors
10. **Log errors** for debugging but avoid exposing sensitive information to users
