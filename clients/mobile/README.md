# TaskFlow Mobile App

A React Native mobile application for the TaskFlow SaaS platform, built with Expo.

## Features

- **Task Management**: View, create, edit, and manage tasks
- **Status Filtering**: Filter tasks by status (To Do, In Progress, Done)
- **Task Details**: View detailed task information including assignments and comments
- **Comments**: Add and view comments on tasks
- **Real-time Updates**: Automatic data synchronization with the backend API

## Tech Stack

- **React Native 0.74.5** - Mobile framework
- **Expo** - Development platform
- **TypeScript** - Type safety
- **TanStack Query** - Data fetching and caching
- **React Navigation** - Navigation
- **React Native Dotenv** - Environment variables

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (macOS) or Android Emulator/Device

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Run on device/emulator:
   - For iOS: `npm run ios`
   - For Android: `npm run android`
   - For web: `npm run web`

## Configuration

The app connects to the Task Service backend API. Configure the API endpoint in `.env`:

```
API_BASE_URL=http://localhost:3000
```

## Project Structure

```
src/
├── api/
│   ├── client.ts      # API client with all HTTP requests
│   └── hooks.ts       # React Query hooks for data fetching
├── components/
│   ├── TaskCard.tsx   # Task card component
│   ├── TaskForm.tsx   # Task creation/editing form
│   └── CommentList.tsx # Comments display and input
└── screens/
    ├── TaskBoard.tsx  # Main task list screen
    ├── TaskDetail.tsx # Task details and comments
    └── TaskForm.tsx   # Task form screen
```

## API Integration

The app integrates with the Task Service backend API endpoints:

- `GET /api/tasks` - Fetch tasks with filtering
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/:id/comments` - Fetch task comments
- `POST /api/tasks/:id/comments` - Add comment to task

## Development

### Adding New Features

1. Create components in `src/components/`
2. Add API methods to `src/api/client.ts`
3. Create React Query hooks in `src/api/hooks.ts`
4. Add new screens in `src/screens/`
5. Update navigation in `App.tsx`

### Code Style

- Use TypeScript for all new code
- Follow React Native and Expo best practices
- Use functional components with hooks
- Implement proper error handling and loading states

## Building for Production

1. Configure app.json for production
2. Build with Expo:
   ```bash
   expo build:ios
   expo build:android
   ```

## Troubleshooting

### Common Issues

1. **Metro bundler issues**: Clear cache with `npx react-native start --reset-cache`
2. **Expo CLI issues**: Update Expo CLI and restart
3. **API connection issues**: Check API_BASE_URL in .env file

### Dependencies

If you encounter dependency issues:
```bash
rm -rf node_modules package-lock.json
npm install
```