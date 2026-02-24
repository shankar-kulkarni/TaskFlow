import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useStore } from '../store';
import { SmartDataTable } from './shared/SmartDataTable';
import type { Column, RowAction } from './shared/DataTableTypes';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';
import { apiClient } from '../api/client';
import { dayDeltaForTenant } from '../utils/tenantDate';

interface AllTasksViewProps {
  onTaskSelect: (taskId: string) => void;
  onNewTask: () => void;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedHrs?: number;
  projectId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const AllTasksView: React.FC<AllTasksViewProps> = ({ onTaskSelect, onNewTask }) => {
  const { tasks, projects, deleteTask, updateTask, openEditTaskForm } = useStore();
  const intl = useIntl();
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticRows, setSemanticRows] = useState<TaskRow[]>([]);
  const [semanticModeActive, setSemanticModeActive] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);

  const allowedStatuses = useMemo(() => new Set(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']), []);
  const allowedPriorities = useMemo(() => new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']), []);

  const readSortFromUrl = useCallback((): { column: string | null; direction: 'none' | 'asc' | 'desc' } => {
    if (typeof window === 'undefined') {
      return { column: null as string | null, direction: 'none' as const };
    }
    const params = new URLSearchParams(window.location.search);
    const column = params.get('allTasksSort');
    const direction = params.get('allTasksDir');
    if (!column || (direction !== 'asc' && direction !== 'desc')) {
      return { column: null as string | null, direction: 'none' as const };
    }
    return { column, direction };
  }, []);

  const [tableSort, setTableSort] = useState<{ column: string | null; direction: 'none' | 'asc' | 'desc' }>(() => readSortFromUrl());

  const formatStatusLabel = useCallback(
    (value: string) => intl.formatMessage({ id: `status.${value.toLowerCase()}` }),
    [intl]
  );

  const formatPriorityLabel = useCallback(
    (value: string) => intl.formatMessage({ id: `priority.${value.toLowerCase()}` }),
    [intl]
  );

  const selectedCount = selectedTaskIds.size;

  // Define columns for the data table
  const columns: Column<TaskRow>[] = useMemo(
    () => [
      {
        id: 'title',
        label: intl.formatMessage({ id: 'allTasks.column.task' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '1fr',
        render: (value: string, row: TaskRow) => (
          <span className={row.completedAt ? 'line-through text-[var(--tx-lo)]' : ''}>
            {value}
          </span>
        ),
      },
      {
        id: 'projectId',
        label: intl.formatMessage({ id: 'allTasks.column.project' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '150px',
        accessor: (row: TaskRow) => (row.projectId ? projects[row.projectId]?.name || '' : ''),
        render: (_value: unknown, row: TaskRow) => {
          const project = row.projectId ? projects[row.projectId] : null;
          return project ? (
            <span className="inline-flex items-center gap-2">
              {project.icon && <span>{project.icon}</span>}
              {project.name}
            </span>
          ) : (
            <span className="text-[var(--tx-lo)]">-</span>
          );
        },
      },
      {
        id: 'status',
        label: intl.formatMessage({ id: 'allTasks.column.status' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '120px',
        headerContent: selectedCount > 0 ? (
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            aria-label={intl.formatMessage({ id: 'allTasks.bulk.statusAria', defaultMessage: 'Bulk status value' })}
            style={{
              width: '100%',
              minWidth: '110px',
              padding: '4px 8px',
              borderRadius: 'var(--r)',
              background: 'var(--s2)',
              border: '1px solid var(--border)',
              color: 'var(--tx-hi)',
              fontSize: '11px'
            }}
          >
            <option value="">{intl.formatMessage({ id: 'allTasks.bulk.statusPlaceholder', defaultMessage: 'Status' })}</option>
            <option value="TODO">{intl.formatMessage({ id: 'status.todo' })}</option>
            <option value="IN_PROGRESS">{intl.formatMessage({ id: 'status.in_progress' })}</option>
            <option value="IN_REVIEW">{intl.formatMessage({ id: 'status.in_review' })}</option>
            <option value="DONE">{intl.formatMessage({ id: 'status.done' })}</option>
            <option value="BLOCKED">{intl.formatMessage({ id: 'status.blocked' })}</option>
          </select>
        ) : undefined,
        render: (value: string) => {
          const statusClass = `status-badge status-${value.toLowerCase().replace(/_/g, '-')}`;
          const label = formatStatusLabel(value);
          return (
            <span className={statusClass}>
              {label}
            </span>
          );
        },
      },
      {
        id: 'priority',
        label: intl.formatMessage({ id: 'allTasks.column.priority' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '100px',
        headerContent: selectedCount > 0 ? (
          <select
            value={bulkPriority}
            onChange={(e) => setBulkPriority(e.target.value)}
            aria-label={intl.formatMessage({ id: 'allTasks.bulk.priorityAria', defaultMessage: 'Bulk priority value' })}
            style={{
              width: '100%',
              minWidth: '100px',
              padding: '4px 8px',
              borderRadius: 'var(--r)',
              background: 'var(--s2)',
              border: '1px solid var(--border)',
              color: 'var(--tx-hi)',
              fontSize: '11px'
            }}
          >
            <option value="">{intl.formatMessage({ id: 'allTasks.bulk.priorityPlaceholder', defaultMessage: 'Priority' })}</option>
            <option value="CRITICAL">{intl.formatMessage({ id: 'priority.critical' })}</option>
            <option value="HIGH">{intl.formatMessage({ id: 'priority.high' })}</option>
            <option value="MEDIUM">{intl.formatMessage({ id: 'priority.medium' })}</option>
            <option value="LOW">{intl.formatMessage({ id: 'priority.low' })}</option>
          </select>
        ) : undefined,
        render: (value: string) => {
          const priorityClass = `priority-${value.toLowerCase()}`;
          const label = formatPriorityLabel(value);
          return <span className={priorityClass}>{label}</span>;
        },
      },
      {
        id: 'dueDate',
        label: intl.formatMessage({ id: 'allTasks.column.dueDate' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '120px',
        headerContent: selectedCount > 0 ? (
          <input
            type="date"
            value={bulkDueDate}
            onChange={(e) => setBulkDueDate(e.target.value)}
            aria-label={intl.formatMessage({ id: 'allTasks.bulk.dueDateAria', defaultMessage: 'Bulk due date value' })}
            style={{
              width: '100%',
              minWidth: '120px',
              padding: '4px 8px',
              borderRadius: 'var(--r)',
              background: 'var(--s2)',
              border: '1px solid var(--border)',
              color: 'var(--tx-hi)',
              fontSize: '11px'
            }}
          />
        ) : undefined,
        render: (value: string | undefined) => {
          if (!value) return <span className="text-[var(--tx-lo)]">-</span>;
          const date = new Date(value);
          const daysUntil = dayDeltaForTenant(value) ?? 0;
          const isOverdue = daysUntil < 0;
          const formatted = intl.formatDate(date, { month: 'short', day: 'numeric' });
          const daysLabel = isOverdue
            ? intl.formatMessage({ id: 'allTasks.daysOverdue' }, { days: Math.abs(daysUntil) })
            : daysUntil === 0
              ? intl.formatMessage({ id: 'allTasks.today' })
              : intl.formatMessage({ id: 'allTasks.daysLeft' }, { days: daysUntil });
          return (
            <div className="flex flex-col">
              <span className={isOverdue ? 'text-rose-400 font-medium' : ''}>
                {formatted}
              </span>
              <span className="text-xs text-[var(--tx-lo)]">{daysLabel}</span>
            </div>
          );
        },
      },
      {
        id: 'estimatedHrs',
        label: intl.formatMessage({ id: 'allTasks.column.estimated' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '90px',
        accessor: (row: TaskRow) => row.estimatedHrs ?? '',
        render: (value: number | undefined) => value ? `${value}h` : '-',
      },
      {
        id: 'createdAt',
        label: intl.formatMessage({ id: 'allTasks.column.created' }),
        sortable: true,
        searchable: true,
        visible: false,
        width: '120px',
        render: (value: string) => {
          const date = new Date(value);
          return intl.formatDate(date, { month: 'short', day: 'numeric' });
        },
      },
    ],
    [bulkDueDate, bulkPriority, bulkStatus, formatPriorityLabel, formatStatusLabel, intl, projects, selectedCount]
  );

  // Define row actions
  const rowActions: RowAction<TaskRow>[] = useMemo(
    () => [
      {
        id: 'edit',
        label: intl.formatMessage({ id: 'common.edit' }),
        icon: '✎',
        variant: 'primary',
        onClick: (row: TaskRow) => {
          openEditTaskForm(row.id);
        },
      },
      {
        id: 'delete',
        label: intl.formatMessage({ id: 'common.delete' }),
        icon: '✕',
        variant: 'danger',
        onClick: async (row: TaskRow) => {
          if (confirm(intl.formatMessage({ id: 'allTasks.confirmDelete' }, { title: row.title }))) {
            await deleteTask(row.id);
          }
        },
      },
    ],
    [intl, openEditTaskForm, deleteTask, updateTask]
  );

  // Convert tasks record to array
  const taskArray: TaskRow[] = useMemo(() => Object.values(tasks) as TaskRow[], [tasks]);
  const displayedRows = semanticModeActive ? semanticRows : taskArray;

  const handleRowClick = useCallback(
    (row: TaskRow) => {
      onTaskSelect(row.id);
    },
    [onTaskSelect]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!tableSort.column || tableSort.direction === 'none') {
      params.delete('allTasksSort');
      params.delete('allTasksDir');
    } else {
      params.set('allTasksSort', tableSort.column);
      params.set('allTasksDir', tableSort.direction);
    }
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  }, [tableSort]);
  useEffect(() => {
    setSemanticRows([]);
    setSemanticModeActive(false);
    setSemanticQuery('');
    setSemanticError(null);
  }, [tasks]);

  const runSemanticSearch = useCallback(async () => {
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
        limit: 200,
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
      } else {
        const mappedRows: TaskRow[] = rows
          .map((row: { id: string }) => tasks[row.id] as TaskRow | undefined)
          .filter((task: TaskRow | undefined): task is TaskRow => Boolean(task));
        setSemanticRows(mappedRows);
      }
    } catch (error) {
      setSemanticRows([]);
      setSemanticError(error instanceof Error ? error.message : 'Semantic AI search unavailable.');
    } finally {
      setSemanticLoading(false);
    }
  }, [semanticQuery, tasks]);

  const clearSemanticSearch = useCallback(() => {
    setSemanticQuery('');
    setSemanticRows([]);
    setSemanticModeActive(false);
    setSemanticError(null);
  }, []);

  const handleApplyHeaderBulkChanges = useCallback(async () => {
    setBulkMessage(null);

    if (selectedTaskIds.size === 0) {
      setBulkMessage({
        type: 'error',
        text: intl.formatMessage({ id: 'allTasks.bulk.noneSelected', defaultMessage: 'Select at least one task to apply bulk changes.' }),
      });
      return;
    }

    if (!bulkStatus && !bulkPriority && !bulkDueDate) {
      setBulkMessage({
        type: 'error',
        text: intl.formatMessage({ id: 'allTasks.bulk.chooseField', defaultMessage: 'Choose Status, Priority, and/or Due Date before applying.' }),
      });
      return;
    }

    if (bulkStatus && !allowedStatuses.has(bulkStatus)) {
      setBulkMessage({
        type: 'error',
        text: intl.formatMessage({ id: 'allTasks.bulk.invalidStatus', defaultMessage: 'Selected status is invalid.' }),
      });
      return;
    }

    if (bulkPriority && !allowedPriorities.has(bulkPriority)) {
      setBulkMessage({
        type: 'error',
        text: intl.formatMessage({ id: 'allTasks.bulk.invalidPriority', defaultMessage: 'Selected priority is invalid.' }),
      });
      return;
    }

    try {
      for (const taskId of selectedTaskIds) {
        const task = tasks[taskId];
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
          user_ids: task.userAssignments?.map((a) => a.userId) || [],
          group_ids: task.groupAssignments?.map((a) => a.groupId) || [],
          watcher_ids: [],
          tags: [],
        });
      }

      const updatedCount = selectedTaskIds.size;
      setBulkMessage({
        type: 'success',
        text: intl.formatMessage(
          { id: 'allTasks.bulk.success', defaultMessage: 'Updated {count} task(s) successfully.' },
          { count: updatedCount }
        ),
      });
      setSelectedTaskIds(new Set());
      setBulkStatus('');
      setBulkPriority('');
      setBulkDueDate('');
    } catch {
      setBulkMessage({
        type: 'error',
        text: intl.formatMessage({ id: 'allTasks.bulk.failed', defaultMessage: 'Bulk update failed. Please try again.' }),
      });
    }
  }, [allowedPriorities, allowedStatuses, bulkDueDate, bulkPriority, bulkStatus, intl, selectedTaskIds, tasks, updateTask]);

  const canApplyBulk = selectedCount > 0 && Boolean(bulkStatus || bulkPriority || bulkDueDate);

  const headerBulkControls = selectedCount > 0 ? (
    <button
      type="button"
      disabled={!canApplyBulk}
      onClick={() => void handleApplyHeaderBulkChanges()}
      aria-label={intl.formatMessage({ id: 'allTasks.bulk.applyAria', defaultMessage: 'Apply bulk update to selected tasks' })}
      style={{
        padding: '4px 10px',
        borderRadius: 'var(--r)',
        background: 'var(--blue)',
        border: '1px solid var(--border2)',
        color: '#fff',
        fontSize: '11px',
        cursor: canApplyBulk ? 'pointer' : 'not-allowed',
        opacity: canApplyBulk ? 1 : 0.6
      }}
    >
      {intl.formatMessage({ id: 'allTasks.bulk.apply', defaultMessage: 'Apply' })}
    </button>
  ) : null;

  return (
    <div className="main">
      {/* Header Section */}
      <div className="ph">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ph-title">{intl.formatMessage({ id: 'allTasks.title' })}</h1>
            <HelpSection
              titleId="help.allTasks.title"
              items={["help.allTasks.item1", "help.allTasks.item2", "help.allTasks.item3"]}
            />
          </div>
          <p className="ph-sub">
            {selectedCount > 0 ? (
              <span>
                {intl.formatMessage(
                  { id: 'allTasks.selectedSummary' },
                  { selected: selectedCount, total: taskArray.length }
                )}
              </span>
            ) : (
              <span>
                {intl.formatMessage({ id: 'allTasks.totalSummary' }, { total: taskArray.length })}
              </span>
            )}
          </p>
        </div>
        <div className="ph-actions">
          <Tooltip content={intl.formatMessage({ id: 'tooltip.allTasks.newTask' })}>
            <button
              onClick={onNewTask}
              className="btn btn-primary"
            >
              {intl.formatMessage({ id: 'allTasks.newTask' })}
            </button>
          </Tooltip>
          <input
            value={semanticQuery}
            onChange={(event) => setSemanticQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void runSemanticSearch()}
            placeholder="Semantic search across all task fields"
            style={{
              minWidth: '260px',
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
        </div>
      </div>
      {semanticError && (
        <div className="status-error" style={{ margin: '0 28px 8px' }}>
          {semanticError}
        </div>
      )}
      {bulkMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            margin: '0 28px 8px',
            padding: '8px 10px',
            borderRadius: '8px',
            border: bulkMessage.type === 'success' ? '1px solid rgba(63, 221, 199, 0.45)' : '1px solid rgba(255, 94, 122, 0.45)',
            background: bulkMessage.type === 'success' ? 'rgba(63, 221, 199, 0.12)' : 'rgba(255, 94, 122, 0.12)',
            color: bulkMessage.type === 'success' ? 'var(--teal)' : 'var(--rose)',
            fontSize: '12px',
          }}
        >
          {bulkMessage.text}
        </div>
      )}
      {selectedCount > 0 && (
        <div style={{ padding: '0 28px 8px' }}>
          <span className="chip chip-m">{selectedCount} selected</span>
        </div>
      )}

      {/* DataTable Component */}
      <div style={{ flex: 1, minHeight: 0, padding: '20px 28px 28px' }}>
        <SmartDataTable<TaskRow>
          data={displayedRows}
          columns={columns}
          tableId="all-tasks-view"
          sort={tableSort}
          onConfigChange={(config) => setTableSort(config.sort)}
          rowActions={rowActions}
          onRowClick={handleRowClick}
          emptyMessage={intl.formatMessage({ id: 'allTasks.empty' })}
          selectable={true}
          selectedRowIds={selectedTaskIds}
          onSelectionChange={setSelectedTaskIds}
          headerControls={headerBulkControls}
          alternateRows={true}
        />
      </div>
    </div>
  );
};

AllTasksView.displayName = 'AllTasksView';
