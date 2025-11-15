[![DeepWiki](https://img.shields.io/badge/DeepWiki-downforacross%2Fdownforacross.com-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/downforacross/downforacross.com)

# Cross with Friends

Cross with Friends is an online platform for sharing crosswords and playing collaboratively with friends in real time. The application features a modern web interface built with React and a real-time backend powered by Fastify and Socket.io.

**Live Site**: <https://crosswithfriends.com/>

## Tech Stack

### Frontend

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Material-UI (MUI)** - Component library
- **React Router** - Client-side routing
- **Socket.io Client** - Real-time communication
- **Firebase** - Authentication and real-time database
- **Zustand** - State management
- **React Query** - Data fetching and caching

### Backend

- **Fastify** - HTTP server framework
- **TypeScript** - Type safety
- **Socket.io** - WebSocket server
- **PostgreSQL** - Database
- **Joi** - Schema validation

### Infrastructure

- **Yarn Workspaces** - Monorepo management
- **Turbo** - Build system and task runner
- **Docker** - Containerization
- **Firebase** - Hosting and services

## Project Structure

This is a monorepo managed with Yarn workspaces and Turbo:

```text
crosswithfriends/
├── frontend/          # React frontend application
├── server/            # Fastify backend server
├── shared/            # Shared TypeScript types and utilities
├── package.json       # Root workspace configuration
└── turbo.json         # Turbo build configuration
```

## Getting Started

### Prerequisites

- **Node.js** v20 or higher
- **Yarn** v4.11.0 (managed via packageManager)
- **nvm** (recommended for Node.js version management)
- **PostgreSQL** (for local backend development)

### Installation

1. **Install Node.js v20** (using nvm):

   ```bash
   nvm install 20
   nvm use 20
   nvm alias default 20  # optional
   ```

2. **Clone the repository**:

   ```bash
   git clone https://github.com/ScaleOvenStove/crosswithfriends.git
   cd crosswithfriends
   ```

3. **Install dependencies**:

   ```bash
   corepack enable
   yarn
   ```

### Development

#### Run Both Frontend and Backend

Start both the frontend and backend servers concurrently:

```bash
yarn dev
```

This will start:

- Frontend dev server on `http://localhost:3020`
- Backend server on `http://localhost:3021`

#### Run Frontend Only

```bash
yarn devfrontend
# or with local server connection
yarn devfrontend  # Uses VITE_USE_LOCAL_SERVER=1
```

#### Run Backend Only

```bash
yarn devbackend
```

The backend server runs on `http://localhost:3021` by default.

### Building

Build all packages:

```bash
yarn build
```

Build specific packages:

```bash
yarn build:frontend
yarn build:backend
yarn build:shared
```

### Testing

Run all tests:

```bash
yarn test
```

Run backend tests:

```bash
yarn test:backend
yarn test:backend:watch      # Watch mode
yarn test:backend:coverage   # With coverage
```

Frontend tests (from frontend directory):

```bash
cd frontend
yarn test                    # Unit tests (Vitest)
yarn test:component          # Component tests (Playwright)
yarn test:e2e                # E2E tests (Playwright)
```

### Linting and Formatting

Lint all code:

```bash
yarn lint
yarn lint:fix                # Auto-fix issues
```

Format all code:

```bash
yarn format
yarn format:check            # Check without fixing
```

## Docker Development

The project includes Docker support for easy development and deployment:

```bash
# Start PostgreSQL and backend services
docker compose up -d

# View logs
docker compose logs -f backend

# Stop services
docker compose down
```

See `docker-compose.yaml` for configuration details.

## Environment Variables

The project uses environment variables for configuration. Create `.env.local` files as needed:

- Frontend: `frontend/.env.local`
- Backend: `.env.prod`, `.env.staging` (for production/staging)

Key variables:

- `VITE_USE_LOCAL_SERVER` - Connect frontend to local backend
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3021)

## API Documentation

The backend API is documented in `server/README.md`. Key endpoints:

- `POST /api/game` - Create a new game
- `GET /api/game/:gid` - Get game information
- `POST /api/puzzle` - Add a new puzzle
- `GET /api/puzzle_list` - List puzzles

WebSocket events are handled via Socket.io for real-time game updates.

## Contributing

Cross with Friends is open to contributions from developers of any level or experience.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`yarn test && yarn lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

If you notice a bug or have a feature request, feel free to open an issue.

**Join the [Discord](https://discord.gg/RmjCV8EZ73) for discussion.**

## Development Tips

### Mobile Web Development

- **Mobile device emulator**: <https://appetize.io/demo?device=nexus7&scale=50&orientation=portrait&osVersion=9.0>
- **Public URLs for local server**: [ngrok](https://ngrok.com/)
- **Remote debugging tips**: <https://support.brightcove.com/debugging-mobile-devices>

### Code Quality

- ESLint and Prettier are configured for consistent code style
- TypeScript provides type safety across the codebase

## Resources

- [Firebase Realtime Database](https://firebase.google.com/docs/database/web/start) - Introduction to Firebase Realtime Database
- [React Tutorial](https://reactjs.org/tutorial/tutorial.html) - Introduction to React
- [Fastify Documentation](https://www.fastify.io/) - Fastify framework docs
- [Socket.io Documentation](https://socket.io/docs/) - Real-time communication
- [Turbo Documentation](https://turbo.build/repo/docs) - Monorepo build system
- [Community Discord](https://discord.gg/RmjCV8EZ73)

## License

See [LICENSE](LICENSE) file for details.
