import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTask, useCreateTask, useUpdateTask } from '../api/hooks';
import { TaskForm as TaskFormComponent } from '../components/TaskForm';

type RootStackParamList = {
  TaskForm: { taskId?: string };
  TaskBoard: undefined;
};

type TaskFormRouteProp = RouteProp<RootStackParamList, 'TaskForm'>;
type TaskFormNavigationProp = StackNavigationProp<RootStackParamList, 'TaskForm'>;

export const TaskFormScreen = () => {
  const route = useRoute<TaskFormRouteProp>();
  const navigation = useNavigation<TaskFormNavigationProp>();
  const { taskId } = route.params || {};

  const { data: task } = useTask(taskId || '');
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const handleSubmit = async (formData: any) => {
    try {
      if (taskId) {
        await updateTask.mutateAsync({ id: taskId, updates: formData });
      } else {
        await createTask.mutateAsync(formData);
      }
      navigation.goBack();
    } catch (error) {
      // Error is handled in the component
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <TaskFormComponent
        initialData={task ? {
          title: task.title,
          description: task.description,
          priority: task.priority,
          dueDate: task.dueDate,
        } : undefined}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={createTask.isPending || updateTask.isPending}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});