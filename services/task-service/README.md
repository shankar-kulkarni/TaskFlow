# TaskFlow Task Service

A microservice for task management in the TaskFlow SaaS platform.

## Overview

The Task Service provides REST APIs for creating, managing, and assigning tasks within the TaskFlow multi-tenant platform. It supports flexible assignment to users and groups, comments, watchers, and integrates with the broader TaskFlow ecosystem.

## Features

- **Task CRUD**: Create, read, update, and archive tasks
- **Flexible Assignments**: Assign tasks to individual users, groups, or combinations
- **Effective Assignees**: Resolve group memberships to get all assigned users
- **Comments**: Add threaded comments to tasks
- **Watchers**: Subscribe to task updates
- **Multi-tenancy**: Schema-based isolation per tenant
- **Audit Logging**: Track all changes for compliance

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Testing**: Vitest
- **Linting**: ESLint
- **Formatting**: Prettier

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL
   ```

4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The service will be available at `http://localhost:3000`.

## API Documentation

API documentation is available in OpenAPI 3.1 format at `docs/openapi.yaml`.

### Key Endpoints

- `GET /api/v1/tasks` - List tasks with filtering
- `POST /api/v1/tasks` - Create a new task
- `GET /api/v1/tasks/{id}` - Get task details
- `PATCH /api/v1/tasks/{id}` - Update task
- `PUT /api/v1/tasks/{id}/assignments` - Manage assignments
- `GET /api/v1/tasks/{id}/assignees` - Get effective assignees
- `POST /api/v1/tasks/{id}/comments` - Add comments

## Development

### Validation Modes

The service now supports route validation in two modes:

- **Relaxed mode (default)**: Active when `VALIDATION_STRICT_MODE=false` (or unset). This validates request shape without tightening existing payload compatibility.
- **Strict mode (opt-in)**: Active when `VALIDATION_STRICT_MODE=true`. This applies stricter schema rules and can reject extra/invalid fields.

Set the mode in `.env`:

```bash
VALIDATION_STRICT_MODE=false
```

Current route coverage includes:

- Tasks, projects, groups, users, watchers
- Analytics, my-tasks, search
- Timeline, calendar, workflows
- Assignments, comments, tenant preferences

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code
- `npm run format` - Format code

### Testing

Run the test suite:

```bash
npm test
```

Tests use Vitest and Supertest for API testing.

### Database

The service uses Prisma ORM with PostgreSQL. Schema is defined in `prisma/schema.prisma`.

To update the database schema:

```bash
npx prisma migrate dev
```

## Deployment

### Docker

Build and run with Docker:

```bash
docker build -f infrastructure/Dockerfile -t task-service .
docker run -p 3000:3000 task-service
```

### Docker Compose

For local development with PostgreSQL:

```bash
cd infrastructure
docker-compose up
```

### Kubernetes

Deploy to Kubernetes using the manifest in `infrastructure/k8s-deployment.yaml`.

## Architecture

The service follows microservices architecture principles:

- **Stateless**: No session state stored in the service
- **Event-driven**: Publishes events to Kafka for notifications and audit
- **Multi-tenant**: Uses schema-based isolation
- **RESTful**: Follows REST API conventions
- **Testable**: Comprehensive unit test coverage

## Security

- JWT authentication via API Gateway
- Tenant isolation at database level
- Input validation and sanitization
- Rate limiting at gateway level
- Audit logging for all mutations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Ensure linting passes
5. Submit a pull request

## License

This project is part of TaskFlow SaaS. See LICENSE file for details.