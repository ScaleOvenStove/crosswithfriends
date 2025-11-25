<!--
Sync Impact Report:
Version: 1.0.0 (initial constitution)
Ratification: 2025-11-17
Last Amended: 2025-11-17

Modified Principles: None (initial creation)
Added Sections: Core Principles, Development Workflow, Security Requirements
Removed Sections: None

Templates Status:
✅ plan-template.md - Constitution Check section aligns with principles
✅ spec-template.md - No constitution-specific references to update
✅ tasks-template.md - No constitution-specific references to update
⚠️ checklist-template.md - No updates needed (generic template)
⚠️ agent-file-template.md - Not reviewed (if exists)

Follow-up TODOs: None
-->

# Cross with Friends Constitution

## Core Principles

### I. Type Safety First (NON-NEGOTIABLE)

All code MUST be written in TypeScript with strict type checking enabled. Shared types and interfaces MUST be defined in the `shared/` workspace package. Type definitions MUST be exported and imported across frontend and backend to ensure contract consistency. No `any` types are permitted except where explicitly justified with inline comments explaining why type information is unavailable.

**Rationale**: Type safety prevents runtime errors, enables better IDE support, and ensures API contracts are maintained between frontend and backend services.

### II. Real-time Collaboration Architecture

Real-time features MUST use Socket.io for WebSocket communication. All real-time events MUST be typed using shared TypeScript interfaces from the `shared/` package. Event handlers MUST validate incoming data using Joi schemas on the backend. Frontend Socket.io clients MUST handle connection failures gracefully with retry logic and user feedback.

**Rationale**: Real-time collaboration is core to the application's value proposition. Consistent typing and validation ensure reliable multiplayer experiences.

### III. Monorepo Structure & Shared Code

The project MUST maintain a monorepo structure using Yarn workspaces and Turbo. Shared types, utilities, and constants MUST live in the `shared/` workspace. Frontend and backend MUST NOT duplicate type definitions or business logic that can be shared. Workspace dependencies MUST be explicitly declared in package.json files.

**Rationale**: Monorepo structure enables code reuse, ensures type consistency, and simplifies dependency management across frontend and backend.

### IV. Security & Input Validation (NON-NEGOTIABLE)

All user inputs MUST be validated using Joi schemas on the backend. Authentication MUST use Firebase Auth. Authorization checks MUST be performed on every request. No credentials, API keys, or secrets MUST be hardcoded in source code. All environment variables MUST be documented and validated at application startup.

**Rationale**: Security vulnerabilities can compromise user data and system integrity. Input validation and proper authentication/authorization are fundamental security requirements.

### V. Testing Discipline

All features MUST include appropriate tests:

- Unit tests using Vitest for business logic and utilities
- Component tests using Playwright for React components
- E2E tests using Playwright for critical user journeys
- Backend API tests for all endpoints

Tests MUST be written alongside implementation code. Test coverage SHOULD be maintained above 80% for critical paths. Integration tests MUST verify real-time Socket.io event flows.

**Rationale**: Comprehensive testing ensures reliability, prevents regressions, and enables confident refactoring. Real-time features require specific integration testing approaches.

### VI. Code Quality & Consistency

All code MUST pass ESLint and Prettier checks before commit. TypeScript compilation MUST succeed with no errors. Code reviews MUST verify compliance with this constitution. Complex code MUST include inline comments explaining non-obvious logic. Performance-critical paths MUST be documented with rationale.

**Rationale**: Consistent code quality improves maintainability, reduces bugs, and enables effective collaboration across team members.

## Development Workflow

### Branch Strategy

Feature development MUST occur in feature branches named `feature/[feature-name]`. All changes MUST be submitted via Pull Requests. PRs MUST pass all tests, linting, and type checking before merge. PRs MUST include a description of changes and reference related issues.

### Build & Deployment

The project MUST use Turbo for build orchestration. All packages MUST build successfully before deployment. Frontend builds MUST be optimized for production (minification, tree-shaking). Backend builds MUST include type checking and validation.

### Environment Management

Environment variables MUST be documented in README.md or dedicated environment documentation. Local development MUST use `.env.local` files (not committed to version control). Production and staging environments MUST use secure secret management systems.

## Security Requirements

### Authentication & Authorization

User authentication MUST use Firebase Auth. All protected routes and API endpoints MUST verify authentication tokens. Authorization checks MUST validate user permissions before allowing resource access. Session management MUST follow Firebase Auth best practices.

### Data Validation

All API endpoints MUST validate request bodies using Joi schemas. Validation errors MUST return clear, non-revealing error messages. Database queries MUST use parameterized statements to prevent SQL injection. User-generated content MUST be sanitized before storage or display.

### Secrets Management

No secrets, API keys, passwords, or credentials MUST be committed to version control. Environment variables MUST be used for all configuration. Production secrets MUST be managed through secure secret management systems (e.g., Firebase Config, environment-specific secret stores).

## Governance

This constitution supersedes all other development practices and guidelines. All code contributions MUST comply with these principles. Amendments to this constitution require:

1. Documentation of the proposed change and rationale
2. Review and approval by project maintainers
3. Update to version number following semantic versioning:
   - **MAJOR**: Backward incompatible principle changes or removals
   - **MINOR**: New principles added or existing principles materially expanded
   - **PATCH**: Clarifications, wording improvements, typo fixes
4. Propagation of changes to dependent templates and documentation
5. Update to the Sync Impact Report in this file

All PRs and code reviews MUST verify compliance with this constitution. Complexity that violates principles MUST be justified in code comments and PR descriptions. Use this constitution as the primary reference for development decisions.

**Version**: 1.0.0 | **Ratified**: 2025-11-17 | **Last Amended**: 2025-11-17
