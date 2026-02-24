import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  creator: { displayName: string };
  userAssignments: any[];
  groupAssignments: any[];
}

interface TaskCardProps {
  task: Task;
  onPress: () => void;
}

const priorityColors = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#ca8a04',
  LOW: '#16a34a',
  NONE: '#6b7280',
};

export const TaskCard = ({ task, onPress }: TaskCardProps) => {
  const assigneeCount = task.userAssignments.length +
    task.groupAssignments.reduce((sum, ga) => sum + (ga.group?.members?.length || 0), 0);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {task.title}
        </Text>
        <View
          style={[
            styles.priorityIndicator,
            { backgroundColor: priorityColors[task.priority as keyof typeof priorityColors] },
          ]}
        />
      </View>

      {task.description && (
        <Text style={styles.description} numberOfLines={2}>
          {task.description}
        </Text>
      )}

      <View style={styles.footer}>
        <View style={styles.meta}>
          <Text style={styles.assigneeCount}>{assigneeCount} assignees</Text>
          {task.dueDate && (
            <Text style={styles.dueDate}>
              Due {new Date(task.dueDate).toLocaleDateString()}
            </Text>
          )}
        </View>
        <Text style={styles.creator}>{task.creator.displayName}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    flex: 1,
  },
  assigneeCount: {
    fontSize: 12,
    color: '#666',
  },
  dueDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  creator: {
    fontSize: 12,
    color: '#999',
  },
});