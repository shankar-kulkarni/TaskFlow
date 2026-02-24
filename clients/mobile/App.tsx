import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskBoard } from './src/screens/TaskBoard';
import { TaskDetail } from './src/screens/TaskDetail';
import { TaskFormScreen } from './src/screens/TaskForm';
import { LanguageProvider } from './src/i18n/LanguageProvider';
import { useIntl } from 'react-intl';

const Stack = createStackNavigator();
const queryClient = new QueryClient();

const AppNavigator = () => {
  const intl = useIntl();

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="TaskBoard">
        <Stack.Screen
          name="TaskBoard"
          component={TaskBoard}
          options={{ title: intl.formatMessage({ id: 'mobile.appTitle' }) }}
        />
        <Stack.Screen
          name="TaskDetail"
          component={TaskDetail}
          options={{ title: intl.formatMessage({ id: 'mobile.taskDetails' }) }}
        />
        <Stack.Screen
          name="TaskForm"
          component={TaskFormScreen}
          options={({ route }: any) => ({
            title: route.params?.taskId
              ? intl.formatMessage({ id: 'mobile.editTask' })
              : intl.formatMessage({ id: 'mobile.createTask' })
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AppNavigator />
      </LanguageProvider>
    </QueryClientProvider>
  );
}