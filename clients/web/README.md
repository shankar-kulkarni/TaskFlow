# TaskFlow Web Client

A modern React web application for TaskFlow SaaS task management platform.

## Overview

The TaskFlow web client provides a user-friendly interface for managing tasks, assignments, and collaboration. Built with React 19, TypeScript, and modern web technologies.

## Features

- **Task Board**: Kanban-style task management with drag-and-drop
- **Task Details**: Comprehensive task view with comments and assignments
- **Real-time Updates**: Live updates using React Query
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Type Safety**: Full TypeScript support

## Tech Stack

- **Framework**: React 19 with TypeScript
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Styling**: Tailwind CSS
- **Icons**: Heroicons
- **Build Tool**: Vite

## Quick Start

### Prerequisites

- Node.js 20+ (Note: Current environment has 21.1.0, but Vite requires 20.19+)
- Task Service API running on `http://localhost:3000`

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── api/           # API client and React Query hooks
├── components/    # Reusable UI components
├── store.ts       # Zustand state management
├── App.tsx        # Main application component
└── main.tsx       # Application entry point
```

## Key Components

- **TaskBoard**: Main dashboard with task columns
- **TaskCard**: Individual task display component
- **TaskDetail**: Detailed task view with comments
- **TaskForm**: Form for creating/editing tasks

## API Integration

The client integrates with the Task Service API:

- `GET /api/v1/tasks` - Fetch tasks with filtering
- `POST /api/v1/tasks` - Create new tasks
- `GET /api/v1/tasks/{id}` - Get task details
- `PATCH /api/v1/tasks/{id}` - Update tasks
- `GET /api/v1/tasks/{id}/comments` - Fetch comments
- `POST /api/v1/tasks/{id}/comments` - Add comments

## State Management

Uses Zustand for global state:
- User authentication state
- Selected task for detail view
- Tenant information

## Styling

Built with Tailwind CSS for:
- Responsive design
- Consistent spacing and colors
- Dark/light mode support (extensible)

## Development

### Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm run lint` - ESLint checking

### Environment Variables

Create a `.env` file for configuration:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## Contributing

1. Follow the existing code style
2. Use TypeScript for type safety
3. Write tests for new features
4. Ensure responsive design
5. Follow React best practices

## License

Part of TaskFlow SaaS platform.

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
