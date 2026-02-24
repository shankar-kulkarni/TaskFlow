import React, { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useStore } from '../store';
import { useAuth } from '../auth/AuthContext';
import { SmartDataTable } from './shared/SmartDataTable';
import type { Column } from './shared/DataTableTypes';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';
import { apiClient } from '../api/client';
import { canCreateOrEditTasks } from '../auth/permissions';

export interface TaskBoardProps {
  onTaskSelect?: (taskId: string) => void;
  onNewTask?: () => void;
}

type TaskRow = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedHrs?: number;
  projectId?: string;
  createdAt: string;
};

const isAssignedToUser = (task: any, userId: string): boolean => {
  if (task?.createdBy === userId || task?.creator?.id === userId) {
    return true;
  }
  const assignments = Array.isArray(task?.userAssignments) ? task.userAssignments : [];
  return assignments.some((assignment: any) => {
    if (assignment?.userId === userId) return true;
    if (assignment?.user?.id === userId) return true;
    return false;
  });
};

export const TaskBoard: React.FC<TaskBoardProps> = ({ onTaskSelect, onNewTask }) => {
  const { tasks, projects, activeProjectId, updateTask } = useStore();
  const { user } = useAuth();
  const intl = useIntl();
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticRows, setSemanticRows] = useState<TaskRow[]>([]);
  const [semanticModeActive, setSemanticModeActive] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const allowTaskWrite = canCreateOrEditTasks(user?.role);

  const selectedCount = selectedTaskIds.size;

  const columns: Column<TaskRow>[] = useMemo(
    () => [
      {
        id: 'title',
        label: intl.formatMessage({ id: 'allTasks.column.task' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '1fr',
      },
      {
        id: 'description',
        label: intl.formatMessage({ id: 'taskForm.description' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '1.2fr',
        render: (value: string | undefined) => value?.trim() || <span className="text-[var(--tx-lo)]">-</span>,
      },
      {
        id: 'projectId',
        label: intl.formatMessage({ id: 'allTasks.column.project' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '170px',
        accessor: (row: TaskRow) => {
          const project = row.projectId ? projects[row.projectId] : null;
          return project ? project.name : '';
        },
        render: (_value: unknown, row: TaskRow) => {
          const project = row.projectId ? projects[row.projectId] : null;
          return project ? project.name : <span className="text-[var(--tx-lo)]">-</span>;
        },
      },
      {
        id: 'status',
        label: intl.formatMessage({ id: 'allTasks.column.status' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '130px',
        headerContent:
          selectedCount > 0 ? (
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              aria-label="Bulk status"
              style={{
                width: '100%',
                minWidth: '120px',
                padding: '4px 8px',
                borderRadius: 'var(--r)',
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                color: 'var(--tx-hi)',
                fontSize: '11px',
              }}
            >
              <option value="">Status</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          ) : undefined,
        render: (value: string) => {
          const statusClass = `status-badge status-${value.toLowerCase().replace(/_/g, '-')}`;
          return <span className={statusClass}>{value.replace('_', ' ')}</span>;
        },
      },
      {
        id: 'priority',
        label: intl.formatMessage({ id: 'allTasks.column.priority' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '110px',
        headerContent:
          selectedCount > 0 ? (
            <select
              value={bulkPriority}
              onChange={(e) => setBulkPriority(e.target.value)}
              aria-label="Bulk priority"
              style={{
                width: '100%',
                minWidth: '100px',
                padding: '4px 8px',
                borderRadius: 'var(--r)',
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                color: 'var(--tx-hi)',
                fontSize: '11px',
              }}
            >
              <option value="">Priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          ) : undefined,
        render: (value: string) => <span className={`priority-${value.toLowerCase()}`}>{value}</span>,
      },
      {
        id: 'dueDate',
        label: intl.formatMessage({ id: 'allTasks.column.dueDate' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '170px',
        headerContent:
          selectedCount > 0 ? (
            <input
              type="date"
              className="bulk-date-input"
              value={bulkDueDate}
              onChange={(e) => setBulkDueDate(e.target.value)}
              onClick={(e) => {
                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                if (typeof input.showPicker === 'function') {
                  input.showPicker();
                }
              }}
              onFocus={(e) => {
                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                if (typeof input.showPicker === 'function') {
                  input.showPicker();
                }
              }}
              aria-label="Bulk due date"
              style={{
                width: '100%',
                minWidth: '160px',
                whiteSpace: 'nowrap',
                padding: '4px 8px',
                borderRadius: 'var(--r)',
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                color: 'var(--tx-hi)',
                fontSize: '11px',
                lineHeight: '1',
              }}
            />
          ) : undefined,
        render: (value: string | undefined) => {
          if (!value) return <span className="text-[var(--tx-lo)]">-</span>;
          return intl.formatDate(new Date(value), { month: 'short', day: 'numeric' });
        },
      },
      {
        id: 'estimatedHrs',
        label: intl.formatMessage({ id: 'allTasks.column.estimated' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '100px',
        render: (value: number | undefined) => (value ? `${value}h` : '-'),
      },
    ],
    [intl, projects, selectedCount, bulkStatus, bulkPriority, bulkDueDate]
  );

  const allRows = useMemo(() => Object.values(tasks) as TaskRow[], [tasks]);
  const myRows = useMemo(() => {
    if (!user?.id) return [];
    return allRows.filter((task) => isAssignedToUser(task, user.id));
  }, [allRows, user?.id]);

  const filteredRows = useMemo(() => {
    if (!activeProjectId) return myRows;
    return myRows.filter((task) => task.projectId === activeProjectId);
  }, [myRows, activeProjectId]);

  useEffect(() => {
    setSemanticQuery('');
    setSemanticRows([]);
    setSemanticModeActive(false);
    setSemanticError(null);
    setSelectedTaskIds(new Set());
    setBulkStatus('');
    setBulkPriority('');
    setBulkDueDate('');
    setBulkMessage(null);
  }, [activeProjectId]);

  const displayedRows = semanticModeActive ? semanticRows : filteredRows;
  const projectName = activeProjectId ? projects[activeProjectId]?.name : null;

  const runSemanticSearch = async () => {
    const query = semanticQuery.trim();
    if (!query) {
      setSemanticModeActive(false);
      setSemanticRows([]);
      setSemanticError(null);
      return;
    }

    setSemanticModeActive(true);
    setSemanticLoading(true);
    setSemanticError(null);
    try {
      const response = await apiClient.aiSemanticSearch({
        query,
        limit: 50,
        projectId: activeProjectId,
      });
      const mode = typeof response?.meta?.mode === 'string' ? response.meta.mode : '';
      if (mode && !['semantic', 'semantic-empty', 'keyword-fallback'].includes(mode)) {
        setSemanticRows([]);
        setSemanticError(`AI search returned mode "${mode}". Semantic ranking is unavailable.`);
        return;
      }
      const rows = Array.isArray(response?.data) ? response.data : [];
      if (mode === 'semantic-empty' || rows.length === 0) {
        setSemanticRows([]);
        setSemanticError(null);
        return;
      }
      const myResultRows = rows
        .filter((row: any) => isAssignedToUser(tasks[row.id], user?.id || ''))
        .map((row: any) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          priority: row.priority,
          dueDate: row.due_date,
          estimatedHrs: row.estimated_hrs,
          projectId: row.project_id,
          createdAt: tasks[row.id]?.createdAt || new Date().toISOString(),
        }));
      setSemanticRows(myResultRows);
    } catch (error) {
      setSemanticError(error instanceof Error ? error.message : 'Semantic AI search unavailable.');
      setSemanticRows([]);
    } finally {
      setSemanticLoading(false);
    }
  };

  const clearSemanticSearch = () => {
    setSemanticQuery('');
    setSemanticRows([]);
    setSemanticModeActive(false);
    setSemanticError(null);
  };

  const applyBulkUpdates = async () => {
    setBulkMessage(null);
    if (selectedTaskIds.size === 0) return;
    if (!bulkStatus && !bulkPriority && !bulkDueDate) return;

    try {
      for (const taskId of selectedTaskIds) {
        const task = tasks[taskId] as any;
        if (!task) continue;
        await updateTask(taskId, {
          title: task.title,
          project_id: task.projectId || '',
          status: bulkStatus || task.status,
          priority: bulkPriority || task.priority,
          description: task.description,
          due_date: bulkDueDate || task.dueDate,
          start_date: task.startDate,
          estimated_hrs: task.estimatedHrs,
          user_ids: task.userAssignments?.map((a: any) => a.userId || a.user?.id).filter(Boolean) || [],
          group_ids: task.groupAssignments?.map((a: any) => a.groupId || a.group?.id).filter(Boolean) || [],
          watcher_ids: [],
          tags: [],
        });
      }
      setBulkMessage(`Updated ${selectedTaskIds.size} task(s).`);
      setSelectedTaskIds(new Set());
      setBulkStatus('');
      setBulkPriority('');
      setBulkDueDate('');
    } catch {
      setBulkMessage('Failed to apply bulk update.');
    }
  };

  const headerControls =
    selectedCount > 0 ? (
      <button
        type="button"
        onClick={() => void applyBulkUpdates()}
        disabled={!bulkStatus && !bulkPriority && !bulkDueDate}
        className="btn btn-ghost"
      >
        Apply
      </button>
    ) : null;
  return (
    <div className="main">
      <div className="ph">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ph-title">
              {projectName
                ? intl.formatMessage({ id: 'myTasks.titleWithProject' }, { project: projectName })
                : intl.formatMessage({ id: 'myTasks.title' })}
            </h1>
            <HelpSection
              titleId="help.myTasks.title"
              items={["help.myTasks.item1", "help.myTasks.item2", "help.myTasks.item3"]}
            />
          </div>
          <p className="ph-sub">
            {projectName
              ? intl.formatMessage({ id: 'myTasks.subtitleWithProject' })
              : intl.formatMessage({ id: 'myTasks.subtitle' })}
          </p>
          {selectedCount > 0 && (
            <div style={{ marginTop: '6px' }}>
              <span className="chip chip-m">{selectedCount} selected</span>
            </div>
          )}
        </div>
        <div className="ph-actions">
          <input
            value={semanticQuery}
            onChange={(e) => setSemanticQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runSemanticSearch()}
            placeholder="Semantic search"
            style={{
              minWidth: '220px',
              background: 'var(--s1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              padding: '6px 10px',
              fontSize: '12px',
              color: 'var(--tx-hi)',
            }}
          />
          <button onClick={() => void runSemanticSearch()} className="btn btn-ghost" disabled={semanticLoading}>
            {semanticLoading ? 'Searching...' : 'AI Search'}
          </button>
          {semanticQuery.trim() && (
            <button onClick={clearSemanticSearch} className="btn btn-ghost">
              Clear
            </button>
          )}
          <Tooltip content={intl.formatMessage({ id: 'tooltip.myTasks.newTask' })}>
            <button onClick={allowTaskWrite ? onNewTask : undefined} className="btn btn-primary" disabled={!allowTaskWrite}>
              {intl.formatMessage({ id: 'myTasks.newTask' })}
            </button>
          </Tooltip>
        </div>
      </div>

      {semanticError && (
        <div className="status-error" style={{ margin: '8px 28px 0' }}>
          {semanticError}
        </div>
      )}
      {bulkMessage && (
        <div className="status-success" style={{ margin: '8px 28px 0' }}>
          {bulkMessage}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, padding: '20px 28px 28px' }}>
        <SmartDataTable<TaskRow>
          data={displayedRows}
          columns={columns}
          tableId={activeProjectId ? `my-project-tasks-${activeProjectId}` : 'my-tasks-view'}
          onRowClick={(row) => onTaskSelect?.(row.id)}
          emptyMessage={intl.formatMessage({ id: 'myTasks.empty', defaultMessage: 'No tasks found.' })}
          alternateRows={true}
          selectable={true}
          selectedRowIds={selectedTaskIds}
          onSelectionChange={setSelectedTaskIds}
          headerControls={headerControls}
        />
      </div>
    </div>
  );
};


