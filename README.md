[![DeepWiki](https://img.shields.io/badge/DeepWiki-downforacross%2Fdownforacross.com-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/downforacross/downforacross.com)

# Cross with Friends

**Solve crossword puzzles together, in real time.**

Cross with Friends is a free, open-source platform for sharing crossword puzzles and solving them collaboratively with friends. Whether you're racing against the clock on a daily mini or tackling a Sunday-sized challenge with a group, Cross with Friends makes it easy and fun.

**Play now**: [crosswithfriends.com](https://crosswithfriends.com/)

**Join the community**: [Discord](https://discord.gg/RmjCV8EZ73)

---

## Features

- **Real-time collaboration** - Solve puzzles with friends, seeing their cursors and inputs live
- **Extensive puzzle library** - Access thousands of puzzles or upload your own
- **Multiple game modes** - Solo, collaborative, and competitive battle modes
- **Cross-platform** - Works on desktop and mobile browsers
- **Dark mode** - Easy on the eyes for late-night solving
- **Game replay** - Watch completed games and learn from your solves
- **Statistics** - Track your solving times and improvement over time

---

## Quick Start for Developers

### Prerequisites

- **Node.js** 20 or higher ([install with nvm](https://github.com/nvm-sh/nvm))
- **Yarn** 4.11.0 (enabled via corepack)
- **PostgreSQL** (for backend development)

### Setup

```bash
# Clone the repository
git clone https://github.com/ScaleOvenStove/crosswithfriends.git
cd crosswithfriends

# Enable yarn via corepack
corepack enable

# Install dependencies
yarn

# Start development servers (frontend + backend)
yarn dev
```

This starts:

- Frontend at `http://localhost:5173`
- Backend at `http://localhost:3021`

### Common Commands

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `yarn dev`         | Start both frontend and backend   |
| `yarn devfrontend` | Start frontend only               |
| `yarn devbackend`  | Start backend only                |
| `yarn build`       | Build all packages for production |
| `yarn test`        | Run all tests                     |
| `yarn lint`        | Check code style                  |

---

## Project Structure

```
crosswithfriends/
├── frontend/          # React web application
├── server/            # Fastify API server
├── shared/            # Shared TypeScript types
└── docs/              # Additional documentation
```

---

## Documentation

### For Developers

| Guide                                             | Description                                        |
| ------------------------------------------------- | -------------------------------------------------- |
| [Frontend README](frontend/README.md)             | Frontend setup, architecture overview              |
| [Frontend Developer Guide](frontend/DEVELOPER.md) | Deep dive: state management, hooks, components     |
| [Server README](server/README.md)                 | Backend setup, API reference, WebSocket events     |
| [Server Developer Guide](server/DEVELOPER.md)     | Deep dive: event sourcing, authentication, testing |

### API Reference

The backend API is fully documented in the [OpenAPI specification](server/openapi.json). Key endpoints:

- `POST /api/game` - Create a new game
- `GET /api/game/:gid` - Get game information
- `POST /api/puzzle` - Upload a puzzle
- `GET /api/puzzle_list` - Browse puzzles

WebSocket events enable real-time gameplay via Socket.io.

---

## Contributing

Contributions are welcome from developers of all experience levels!

1. **Fork** the repository
2. **Create a branch** (`git checkout -b feature/my-feature`)
3. **Make changes** and add tests
4. **Run checks** (`yarn test && yarn lint`)
5. **Commit** (`git commit -m 'Add my feature'`)
6. **Push** (`git push origin feature/my-feature`)
7. **Open a Pull Request**

Found a bug or have a feature idea? [Open an issue](https://github.com/ScaleOvenStove/crosswithfriends/issues).

Questions? Join us on [Discord](https://discord.gg/RmjCV8EZ73).

---

## Tech Stack

**Frontend**: React 19, TypeScript, Vite, Material-UI, Zustand, Socket.io Client, Firebase

**Backend**: Fastify, TypeScript, PostgreSQL, Socket.io, Firebase Admin

**Infrastructure**: Yarn Workspaces, Turbo, Docker

---

## Resources

- [React Documentation](https://react.dev/)
- [Fastify Documentation](https://www.fastify.io/)
- [Socket.io Documentation](https://socket.io/docs/)
- [Firebase Documentation](https://firebase.google.com/docs/)

---

## License

See [LICENSE](LICENSE) for details.
