# Cross with Friends - System Requirements

**Version**: 1.0.0  
**Last Updated**: 2025-01-23  
**Status**: Active

This document defines the functional and technical requirements that both the frontend and backend must satisfy to ensure the Cross with Friends application operates correctly, securely, and reliably.

---

## Table of Contents

1. [Core Functional Requirements](#core-functional-requirements)
2. [Frontend Requirements](#frontend-requirements)
3. [Backend Requirements](#backend-requirements)
4. [Real-time Collaboration Requirements](#real-time-collaboration-requirements)
5. [Security Requirements](#security-requirements)
6. [Data Management Requirements](#data-management-requirements)
7. [Performance Requirements](#performance-requirements)
8. [Error Handling Requirements](#error-handling-requirements)
9. [Testing Requirements](#testing-requirements)

---

## Core Functional Requirements

### FR-1: Puzzle Management

- **FR-1.1**: The system MUST allow users to create crossword puzzles with:
  - Grid layout (cells, black squares, circles, shades)
  - Clues (across and down)
  - Metadata (title, author, copyright, description)
  - Size classification (Mini, Standard)
  - Public/private visibility setting
- **FR-1.2**: The system MUST allow users to browse and search puzzles with:
  - Pagination support
  - Filtering by size (Mini, Standard)
  - Search by title or author name
  - Display of solve statistics
- **FR-1.3**: The system MUST store puzzle data persistently in the database
- **FR-1.4**: The system MUST generate unique puzzle IDs (PID) for each puzzle
- **FR-1.5**: The system MUST support puzzle composition workflow with validation

### FR-2: Game Management

- **FR-2.1**: The system MUST allow users to create games from puzzles
- **FR-2.2**: The system MUST generate unique game IDs (GID) for each game
- **FR-2.3**: The system MUST associate each game with exactly one puzzle
- **FR-2.4**: The system MUST track game state including:
  - Cell values and correctness
  - Checked squares count
  - Revealed squares count
  - Start and completion timestamps
  - Solve duration
- **FR-2.5**: The system MUST support game replay functionality
- **FR-2.6**: The system MUST allow users to view game information by GID

### FR-3: Real-time Collaborative Play

- **FR-3.1**: The system MUST support multiple users playing the same game simultaneously
- **FR-3.2**: The system MUST synchronize game state across all connected clients in real-time
- **FR-3.3**: The system MUST broadcast game events to all participants
- **FR-3.4**: The system MUST handle user join/leave events gracefully
- **FR-3.5**: The system MUST support room-based multiplayer sessions

### FR-4: Statistics and Analytics

- **FR-4.1**: The system MUST track solve statistics per puzzle:
  - Number of solves
  - Average solve time
  - Best solve time
  - Average checked/revealed square counts
- **FR-4.2**: The system MUST provide user statistics:
  - Puzzle solve history
  - Solve times per puzzle
  - Performance metrics by puzzle size
- **FR-4.3**: The system MUST record solve completion events with timestamps

### FR-5: User Interface

- **FR-5.1**: The system MUST provide a responsive web interface that works on desktop and mobile devices
- **FR-5.2**: The system MUST support dark mode theme
- **FR-5.3**: The system MUST provide navigation between:
  - Home/Welcome page
  - Puzzle browsing
  - Game play interface
  - Puzzle composition
  - Account/profile pages
  - Replay viewer
  - Statistics pages
- **FR-5.4**: The system MUST provide embeddable game and room views
- **FR-5.5**: The system MUST display loading states during data fetching
- **FR-5.6**: The system MUST handle route errors gracefully with error boundaries

---

## Frontend Requirements

### FE-1: Type Safety

- **FE-1.1**: All frontend code MUST be written in TypeScript with strict type checking
- **FE-1.2**: All types MUST be imported from the `@crosswithfriends/shared` package
- **FE-1.3**: No `any` types are permitted except where explicitly justified with inline comments
- **FE-1.4**: All API response types MUST match backend contract definitions
- **FE-1.5**: All Socket.io event types MUST use shared type definitions

### FE-2: State Management

- **FE-2.1**: The frontend MUST use Zustand for global state management
- **FE-2.2**: The frontend MUST use React Query for server state and caching
- **FE-2.3**: Game state MUST be synchronized with backend via Socket.io events
- **FE-2.4**: Local state MUST be used only for UI-specific concerns (form inputs, modals, etc.)
- **FE-2.5**: State updates MUST be type-safe and validated

### FE-3: API Communication

- **FE-3.1**: All API calls MUST use the configured `SERVER_URL` based on environment:
  - Production: `https://api.foracross.com`
  - Staging: `https://api-staging.foracross.com`
  - Local: `localhost:3021` (when `VITE_USE_LOCAL_SERVER=1`)
- **FE-3.2**: All API requests MUST include proper error handling
- **FE-3.3**: All API requests MUST handle authentication tokens when required
- **FE-3.4**: The frontend MUST retry failed requests with exponential backoff
- **FE-3.5**: The frontend MUST display user-friendly error messages for API failures

### FE-4: Real-time Communication

- **FE-4.1**: The frontend MUST establish Socket.io connection on game/room pages
- **FE-4.2**: The frontend MUST join appropriate Socket.io rooms (`game-{gid}` or `room-{rid}`)
- **FE-4.3**: The frontend MUST handle Socket.io connection failures with:
  - Automatic reconnection attempts
  - User notification of connection status
  - Graceful degradation when disconnected
- **FE-4.4**: The frontend MUST emit game events to the backend via Socket.io
- **FE-4.5**: The frontend MUST receive and process real-time game events from the backend
- **FE-4.6**: The frontend MUST sync all game events on initial connection
- **FE-4.7**: The frontend MUST measure and display latency using ping/pong events

### FE-5: Routing

- **FE-5.1**: The frontend MUST use React Router for client-side routing
- **FE-5.2**: All routes MUST be defined in the centralized routes configuration
- **FE-5.3**: Protected routes MUST verify authentication before rendering
- **FE-5.4**: Route components MUST be lazy-loaded for code splitting
- **FE-5.5**: Route errors MUST be caught by error boundaries
- **FE-5.6**: The frontend MUST support the following routes:
  - `/` - Welcome page
  - `/fencing` - Fencing mode welcome
  - `/game/:gid` - Game play interface
  - `/embed/game/:gid` - Embedded game view
  - `/room/:rid` - Room multiplayer interface
  - `/embed/room/:rid` - Embedded room view
  - `/replay/:gid` - Game replay viewer
  - `/replays/:pid` - Puzzle replay list
  - `/replays` - All replays
  - `/compose` - Puzzle composition
  - `/account` - User account page
  - `/beta/*` - Beta feature routes

### FE-6: User Experience

- **FE-6.1**: The frontend MUST display loading spinners during async operations
- **FE-6.2**: The frontend MUST provide visual feedback for user actions
- **FE-6.3**: The frontend MUST handle form validation and display errors
- **FE-6.4**: The frontend MUST support keyboard navigation
- **FE-6.5**: The frontend MUST be accessible (WCAG 2.1 Level AA minimum)
- **FE-6.6**: The frontend MUST optimize images and assets for performance
- **FE-6.7**: The frontend MUST implement code splitting for route-based chunks

### FE-7: Build and Deployment

- **FE-7.1**: The frontend MUST build successfully with Vite
- **FE-7.2**: Production builds MUST be optimized (minification, tree-shaking)
- **FE-7.3**: The frontend MUST pass ESLint and Prettier checks
- **FE-7.4**: TypeScript compilation MUST succeed with no errors
- **FE-7.5**: The frontend MUST be statically hostable

---

## Backend Requirements

### BE-1: Type Safety

- **BE-1.1**: All backend code MUST be written in TypeScript with strict type checking
- **BE-1.2**: All types MUST be imported from the `@crosswithfriends/shared` package
- **BE-1.3**: No `any` types are permitted except where explicitly justified with inline comments
- **BE-1.4**: All API request/response types MUST be explicitly defined
- **BE-1.5**: All Socket.io event types MUST use shared type definitions

### BE-2: API Endpoints

- **BE-2.1**: All API endpoints MUST be prefixed with `/api`
- **BE-2.2**: All endpoints MUST validate request data using Joi schemas
- **BE-2.3**: All endpoints MUST return appropriate HTTP status codes
- **BE-2.4**: All endpoints MUST handle errors gracefully with clear error messages
- **BE-2.5**: The backend MUST implement the following endpoints:
  - `POST /api/game` - Create a new game
  - `GET /api/game/:gid` - Get game information
  - `POST /api/puzzle` - Add a new puzzle
  - `GET /api/puzzle_list` - List puzzles with pagination and filtering
  - `POST /api/record_solve/:pid` - Record a puzzle solve
  - `POST /api/stats` - Get statistics for games
  - `POST /api/counters/gid` - Get new game ID
  - `POST /api/counters/pid` - Get new puzzle ID
  - `GET /api/link_preview` - Generate Open Graph metadata
  - `GET /api/oembed` - OEmbed endpoint
  - `GET /api/health` - Health check endpoint

### BE-3: Database Operations

- **BE-3.1**: All database queries MUST use parameterized statements to prevent SQL injection
- **BE-3.2**: All database operations MUST handle connection errors gracefully
- **BE-3.3**: The backend MUST use PostgreSQL for persistent storage
- **BE-3.4**: The backend MUST store game events in the `game_events` table with:
  - `gid` (text) - Game ID
  - `uid` (text) - User ID
  - `ts` (timestamp) - Event timestamp
  - `event_type` (text) - Type of event
  - `event_payload` (json) - Event data
- **BE-3.5**: The backend MUST support transaction management for critical operations
- **BE-3.6**: The backend MUST implement proper database connection pooling

### BE-4: Real-time Communication

- **BE-4.1**: The backend MUST use Socket.io for WebSocket communication
- **BE-4.2**: The backend MUST handle the following Socket.io events:
  - `latency_ping` - Client latency measurement
  - `join_game` - Join a game room
  - `leave_game` - Leave a game room
  - `sync_all_game_events` - Request all game events
  - `game_event` - Receive game event from client
  - `join_room` - Join a room
  - `leave_room` - Leave a room
  - `sync_all_room_events` - Request all room events
  - `room_event` - Receive room event from client
- **BE-4.3**: The backend MUST broadcast events to all clients in a room
- **BE-4.4**: The backend MUST persist game events to the database
- **BE-4.5**: The backend MUST validate all incoming Socket.io events using Joi schemas
- **BE-4.6**: The backend MUST handle Socket.io connection/disconnection events
- **BE-4.7**: The backend MUST respond to latency ping with pong and calculated latency

### BE-5: Input Validation

- **BE-5.1**: All API request bodies MUST be validated using Joi schemas
- **BE-5.2**: All Socket.io event payloads MUST be validated using Joi schemas
- **BE-5.3**: Validation errors MUST return clear, non-revealing error messages
- **BE-5.4**: The backend MUST reject invalid data with appropriate HTTP status codes (400, 422)
- **BE-5.5**: The backend MUST sanitize user-generated content before storage

### BE-6: Authentication and Authorization

- **BE-6.1**: The backend MUST use Firebase Auth for user authentication
- **BE-6.2**: All protected endpoints MUST verify authentication tokens
- **BE-6.3**: The backend MUST validate user permissions before allowing resource access
- **BE-6.4**: The backend MUST extract user ID from authentication tokens
- **BE-6.5**: The backend MUST handle authentication failures with appropriate error responses

### BE-7: Error Handling and Logging

- **BE-7.1**: The backend MUST implement centralized error handling
- **BE-7.2**: All errors MUST be logged with appropriate severity levels
- **BE-7.3**: Error responses MUST not expose sensitive system information
- **BE-7.4**: The backend MUST log all Socket.io events for debugging
- **BE-7.5**: The backend MUST implement request logging

### BE-8: Server Configuration

- **BE-8.1**: The backend MUST use Fastify as the HTTP server framework
- **BE-8.2**: The backend MUST support CORS configuration
- **BE-8.3**: The backend MUST read configuration from environment variables
- **BE-8.4**: The backend MUST validate all required environment variables at startup
- **BE-8.5**: The backend MUST expose a health check endpoint

---

## Real-time Collaboration Requirements

### RT-1: Event Synchronization

- **RT-1.1**: All game state changes MUST be represented as events
- **RT-1.2**: Events MUST be persisted to the database before broadcasting
- **RT-1.3**: Events MUST be broadcast to all clients in the game/room
- **RT-1.4**: Clients MUST be able to request full event history on connection
- **RT-1.5**: Events MUST be applied in chronological order
- **RT-1.6**: Event conflicts MUST be resolved using last-write-wins or operational transformation

### RT-2: Connection Management

- **RT-2.1**: The system MUST handle client reconnections gracefully
- **RT-2.2**: Reconnecting clients MUST receive missed events
- **RT-2.3**: The system MUST detect and handle stale connections
- **RT-2.4**: The system MUST support room-based isolation (games and rooms are separate)

### RT-3: Event Types

- **RT-3.1**: The system MUST support the following game event types:
  - Cell value changes
  - Cell checking/revealing
  - Game start/completion
  - User join/leave
  - Any other game state mutations
- **RT-3.2**: All event types MUST be defined in shared TypeScript types
- **RT-3.3**: Event payloads MUST be validated on both client and server

---

## Security Requirements

### SEC-1: Input Validation

- **SEC-1.1**: All user inputs MUST be validated on the backend using Joi schemas
- **SEC-1.2**: Database queries MUST use parameterized statements
- **SEC-1.3**: User-generated content MUST be sanitized before storage or display
- **SEC-1.4**: File uploads (if any) MUST be validated for type and size
- **SEC-1.5**: The backend MUST reject malformed requests

### SEC-2: Authentication

- **SEC-2.1**: User authentication MUST use Firebase Auth
- **SEC-2.2**: All protected routes MUST verify authentication tokens
- **SEC-2.3**: Authentication tokens MUST be validated on every request
- **SEC-2.4**: Session management MUST follow Firebase Auth best practices

### SEC-3: Authorization

- **SEC-3.1**: Authorization checks MUST be performed on every request
- **SEC-3.2**: Users MUST only access resources they are authorized to view
- **SEC-3.3**: Puzzle creators MUST have appropriate permissions
- **SEC-3.4**: Private puzzles MUST only be accessible to authorized users

### SEC-4: Secrets Management

- **SEC-4.1**: No secrets, API keys, passwords, or credentials MUST be hardcoded in source code
- **SEC-4.2**: All secrets MUST be stored in environment variables
- **SEC-4.3**: Environment variables MUST be documented
- **SEC-4.4**: Production secrets MUST be managed through secure secret management systems

### SEC-5: Data Protection

- **SEC-5.1**: All API communications MUST use HTTPS in production
- **SEC-5.2**: WebSocket connections MUST use WSS in production
- **SEC-5.3**: Sensitive data MUST NOT be logged
- **SEC-5.4**: Error messages MUST NOT reveal sensitive system information

---

## Data Management Requirements

### DM-1: Data Persistence

- **DM-1.1**: All game events MUST be persisted to PostgreSQL
- **DM-1.2**: Puzzle data MUST be stored persistently
- **DM-1.3**: User statistics MUST be calculated from persisted data
- **DM-1.4**: Data MUST be backed up regularly

### DM-2: Data Integrity

- **DM-2.1**: Database transactions MUST be used for critical operations
- **DM-2.2**: Foreign key constraints MUST be enforced where applicable
- **DM-2.3**: Data validation MUST occur before database writes
- **DM-2.4**: Unique constraints MUST be enforced (e.g., GID, PID)

### DM-3: Data Retrieval

- **DM-3.1**: Pagination MUST be implemented for list endpoints
- **DM-3.2**: Database queries MUST be optimized to prevent N+1 problems
- **DM-3.3**: Caching SHOULD be used where appropriate (React Query on frontend)
- **DM-3.4**: Database indexes MUST be created for frequently queried fields

---

## Performance Requirements

### PERF-1: Response Times

- **PERF-1.1**: API endpoints MUST respond within 500ms for 95% of requests
- **PERF-1.2**: Real-time events MUST be broadcast within 100ms
- **PERF-1.3**: Initial page load MUST complete within 3 seconds
- **PERF-1.4**: Database queries MUST be optimized with proper indexes

### PERF-2: Scalability

- **PERF-2.1**: The system MUST support concurrent connections from multiple clients
- **PERF-2.2**: Socket.io MUST handle multiple rooms efficiently
- **PERF-2.3**: Database connection pooling MUST be configured appropriately
- **PERF-2.4**: The frontend MUST implement code splitting for optimal bundle sizes

### PERF-3: Resource Usage

- **PERF-3.1**: Frontend bundle size MUST be optimized (tree-shaking, minification)
- **PERF-3.2**: Images and assets MUST be optimized
- **PERF-3.3**: Unused dependencies MUST be removed
- **PERF-3.4**: Database queries MUST avoid full table scans

---

## Error Handling Requirements

### ERR-1: Frontend Error Handling

- **ERR-1.1**: All API calls MUST handle network errors gracefully
- **ERR-1.2**: Error boundaries MUST catch React component errors
- **ERR-1.3**: User-friendly error messages MUST be displayed
- **ERR-1.4**: Socket.io connection errors MUST be handled with retry logic
- **ERR-1.5**: Form validation errors MUST be displayed inline

### ERR-2: Backend Error Handling

- **ERR-2.1**: All errors MUST be caught and handled appropriately
- **ERR-2.2**: Error responses MUST include appropriate HTTP status codes
- **ERR-2.3**: Error messages MUST be logged for debugging
- **ERR-2.4**: Database errors MUST be handled gracefully
- **ERR-2.5**: Validation errors MUST return clear messages

---

## Testing Requirements

### TEST-1: Test Coverage

- **TEST-1.1**: All features MUST include appropriate tests
- **TEST-1.2**: Test coverage SHOULD be maintained above 80% for critical paths
- **TEST-1.3**: Unit tests MUST be written using Vitest
- **TEST-1.4**: Component tests MUST be written using Playwright
- **TEST-1.5**: E2E tests MUST be written using Playwright for critical user journeys
- **TEST-1.6**: Backend API tests MUST cover all endpoints

### TEST-2: Test Quality

- **TEST-2.1**: Tests MUST be written alongside implementation code
- **TEST-2.2**: Tests MUST be independent and repeatable
- **TEST-2.3**: Integration tests MUST verify real-time Socket.io event flows
- **TEST-2.4**: Tests MUST run in CI/CD pipeline before deployment

### TEST-3: Test Types

- **TEST-3.1**: Unit tests for business logic and utilities
- **TEST-3.2**: Component tests for React components
- **TEST-3.3**: E2E tests for critical user journeys
- **TEST-3.4**: API contract tests for backend endpoints
- **TEST-3.5**: Integration tests for real-time features

---

## Compliance Requirements

### COMP-1: Code Quality

- **COMP-1.1**: All code MUST pass ESLint checks
- **COMP-1.2**: All code MUST be formatted with Prettier
- **COMP-1.3**: TypeScript compilation MUST succeed with no errors
- **COMP-1.4**: Code reviews MUST verify compliance with this requirements document

### COMP-2: Architecture Compliance

- **COMP-2.1**: All code MUST comply with the Cross with Friends Constitution
- **COMP-2.2**: Shared types MUST be used from the `shared/` package
- **COMP-2.3**: Monorepo structure MUST be maintained
- **COMP-2.4**: Workspace dependencies MUST be explicitly declared

### COMP-3: Documentation

- **COMP-3.1**: Complex code MUST include inline comments
- **COMP-3.2**: API endpoints MUST be documented
- **COMP-3.3**: Environment variables MUST be documented
- **COMP-3.4**: Setup and deployment instructions MUST be maintained

---

## Version History

| Version | Date       | Changes                       |
| ------- | ---------- | ----------------------------- |
| 1.0.0   | 2025-01-23 | Initial requirements document |

---

## Notes

- This requirements document MUST be updated when new features are added or existing requirements change
- All requirements marked as MUST are mandatory and non-negotiable
- Requirements marked as SHOULD are recommended but not strictly required
- This document should be referenced during code reviews and feature development
