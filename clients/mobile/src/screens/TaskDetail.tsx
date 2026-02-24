import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useTask, useUpdateTask, useTaskComments, useAddTaskComment } from '../api/hooks';
import { CommentList } from '../components/CommentList';

type TaskDetailRouteProp = RouteProp<{ TaskDetail: { taskId: string } }, 'TaskDetail'>;

type TaskDetailRouteProp = RouteProp<{ TaskDetail: { taskId: string } }, 'TaskDetail'>;

export const TaskDetail = () => {
  const route = useRoute<TaskDetailRouteProp>();
  const { taskId } = route.params;

  const { data: task, isLoading } = useTask(taskId);
  const { data: comments = [] } = useTaskComments(taskId);
  const updateTask = useUpdateTask();
  const addComment = useAddTaskComment();

  const handleStatusChange = async (status: string) => {
    try {
      await updateTask.mutateAsync({ id: taskId, updates: { status } });
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading task...</Text>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.center}>
        <Text>Task not found</Text>
      </View>
    );
  }

  const statusOptions = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED'];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Task Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{task.title}</Text>
          <View style={styles.statusContainer}>
            {statusOptions.map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusButton,
                  task.status === status && styles.statusButtonActive,
                ]}
                onPress={() => handleStatusChange(status)}
              >
                <Text
                  style={[
                    styles.statusText,
                    task.status === status && styles.statusTextActive,
                  ]}
                >
                  {status.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Task Details */}
        {task.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{task.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Priority</Text>
              <Text style={styles.detailValue}>{task.priority}</Text>
            </View>
            {task.dueDate && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Due Date</Text>
                <Text style={styles.detailValue}>
                  {new Date(task.dueDate).toLocaleDateString()}
                </Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Created by</Text>
              <Text style={styles.detailValue}>{task.creator.displayName}</Text>
            </View>
          </View>
        </View>

        {/* Comments */}
        <CommentList
          comments={comments}
          onAddComment={(content) => addComment.mutateAsync({ taskId, content })}
          isLoading={addComment.isPending}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
  },
  statusButtonActive: {
    backgroundColor: '#3b82f6',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  statusTextActive: {
    color: 'white',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    lineHeight: 20,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    width: '50%',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontWeight: '500',
  },
  comment: {
    borderLeftWidth: 2,
    borderLeftColor: '#e5e5e5',
    paddingLeft: 12,
    marginBottom: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontWeight: '500',
  },
  commentDate: {
    fontSize: 12,
    color: '#666',
  },
  commentBody: {
    lineHeight: 20,
  },
});