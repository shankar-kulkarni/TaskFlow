import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useStore } from '../store';
import { apiClient } from '../api/client';
import { SmartDataTable } from './shared/SmartDataTable';
import type { Column } from './shared/DataTableTypes';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';
import { isOverdueForTenant } from '../utils/tenantDate';

interface DashboardViewProps {
  onTaskSelect: (taskId: string) => void;
  onNewTask: () => void;
  aiAssistEnabled?: boolean;
}

interface WeeklyDigest {
  summary: string;
  wins: string[];
  watchList: string[];
  focus: string[];
  generatedAt?: string;
  totals?: {
    total: number;
    inProgress: number;
    blocked: number;
    overdue: number;
    completed?: number;
  };
}

export const DashboardView = ({ onTaskSelect, onNewTask, aiAssistEnabled = true }: DashboardViewProps) => {
  const { tasks, projects, activeProjectId } = useStore();
  const intl = useIntl();
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  const allTasks = Object.values(tasks).filter(task => {
    if (!activeProjectId) return true;
    const taskProjectId = task.projectId || task.project?.id;
    return taskProjectId === activeProjectId;
  });

  const selectedProject = activeProjectId ? projects[activeProjectId] : null;
  const title = selectedProject
    ? intl.formatMessage({ id: 'dashboard.titleWithProject' }, { project: selectedProject.name })
    : intl.formatMessage({ id: 'dashboard.title' });

  const stats = useMemo(() => {
    const total = allTasks.length;
    const completed = allTasks.filter(task => task.status === 'DONE').length;
    const inProgress = allTasks.filter(task => task.status === 'IN_PROGRESS').length;
    const blocked = allTasks.filter(task => task.status === 'BLOCKED').length;
    const overdue = allTasks.filter(task =>
      task.status !== 'DONE' && isOverdueForTenant(task.dueDate)
    ).length;

    const recent = [...allTasks]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);

    return { total, completed, inProgress, blocked, overdue, recent };
  }, [allTasks]);

  type RecentTask = (typeof stats.recent)[number];

  const columns: Column<RecentTask>[] = useMemo(
    () => [
      {
        id: 'title',
        label: intl.formatMessage({ id: 'dashboard.table.task' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '1fr',
        render: (value: string, row) => (
          <span className={row.status === 'DONE' ? 'line-through text-[var(--tx-lo)]' : ''}>
            {value}
          </span>
        ),
      },
      {
        id: 'priority',
        label: intl.formatMessage({ id: 'dashboard.table.priority' }),
        sortable: true,
        visible: true,
        width: '110px',
        render: (value: string) => {
          const priorityClass = `priority-${value.toLowerCase()}`;
          const label = intl.formatMessage({ id: `priority.${value.toLowerCase()}` });
          return <span className={priorityClass}>{label}</span>;
        },
      },
      {
        id: 'status',
        label: intl.formatMessage({ id: 'dashboard.table.status' }),
        sortable: true,
        visible: true,
        width: '120px',
        render: (value: string) => {
          const statusClass = `status-badge status-${value.toLowerCase().replace(/_/g, '-')}`;
          const label = intl.formatMessage({ id: `status.${value.toLowerCase()}` });
          return <span className={statusClass}>{label}</span>;
        },
      },
      {
        id: 'dueDate',
        label: intl.formatMessage({ id: 'dashboard.table.dueDate' }),
        sortable: true,
        visible: true,
        width: '120px',
        render: (value: string | undefined) => {
          if (!value) return <span className="text-[var(--tx-lo)]">-</span>;
          return intl.formatDate(new Date(value));
        },
      },
      {
        id: 'updatedAt',
        label: intl.formatMessage({ id: 'dashboard.table.updated' }),
        sortable: true,
        visible: true,
        width: '120px',
        render: (value: string) =>
          intl.formatDate(new Date(value), {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
      },
      {
        id: 'project',
        label: intl.formatMessage({ id: 'dashboard.table.project' }),
        sortable: true,
        visible: true,
        width: '160px',
        render: (_value: unknown, row) => {
          const project = row.project?.id ? projects[row.project.id] : null;
          return project ? project.name : <span className="text-[var(--tx-lo)]">-</span>;
        },
      },
    ],
    [intl, projects]
  );
  useEffect(() => {
    if (!aiAssistEnabled) return;
    let isActive = true;

    const loadDigest = async () => {
      setDigestLoading(true);
      setDigestError(null);
      try {
        const response = await apiClient.aiWeeklyDigest({ projectId: activeProjectId });
        if (!isActive) return;
        setDigest(response?.data ?? null);
      } catch (error: any) {
        if (!isActive) return;
        setDigestError(error?.message || 'Failed to load weekly digest');
      } finally {
        if (isActive) {
          setDigestLoading(false);
        }
      }
    };

    void loadDigest();

    return () => {
      isActive = false;
    };
  }, [aiAssistEnabled, activeProjectId]);

  return (
    <div className="main">
      <div className="ph">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ph-title">{title}</h1>
            <HelpSection
              titleId="help.dashboard.title"
              items={["help.dashboard.item1", "help.dashboard.item2", "help.dashboard.item3"]}
            />
          </div>
          <p className="ph-sub">{intl.formatMessage({ id: 'dashboard.subtitle' })}</p>
        </div>
        <div className="ph-actions">
          <Tooltip content={intl.formatMessage({ id: 'tooltip.dashboard.newTask' })}>
            <button className="btn btn-primary" onClick={onNewTask}>
              {intl.formatMessage({ id: 'dashboard.newTask' })}
            </button>
          </Tooltip>
        </div>
      </div>


      <div className="stats">
        <div className="stat">
          <div className="stat-val">{stats.total}</div>
          <div className="stat-lbl">{intl.formatMessage({ id: 'dashboard.stats.totalTasks' })}</div>
        </div>
        <div className="stat">
          <div className="stat-val">{stats.inProgress}</div>
          <div className="stat-lbl">{intl.formatMessage({ id: 'dashboard.stats.inProgress' })}</div>
        </div>
        <div className="stat">
          <div className="stat-val">{stats.blocked}</div>
          <div className="stat-lbl">{intl.formatMessage({ id: 'dashboard.stats.blocked' })}</div>
        </div>
        <div className="stat">
          <div className="stat-val">{stats.overdue}</div>
          <div className="stat-lbl">{intl.formatMessage({ id: 'dashboard.stats.overdue' })}</div>
        </div>
      </div>

      <div style={{ padding: '4px 28px 28px' }}>
        {aiAssistEnabled && (
        <div
          style={{
            marginBottom: '16px',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            background: 'var(--s1)',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx-hi)' }}>Weekly AI Digest</div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={async () => {
                setDigestLoading(true);
                setDigestError(null);
                try {
                  const response = await apiClient.aiWeeklyDigest({ projectId: activeProjectId });
                  setDigest(response?.data ?? null);
                } catch (error: any) {
                  setDigestError(error?.message || 'Failed to refresh weekly digest');
                } finally {
                  setDigestLoading(false);
                }
              }}
              disabled={digestLoading}
            >
              {digestLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {digestError && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--rose)' }}>{digestError}</div>}
          {!digestError && digest && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--tx-md)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>{digest.summary}</div>
              <div><strong>Wins:</strong> {digest.wins?.slice(0, 3).join(' • ') || 'None'}</div>
              <div><strong>Watch:</strong> {digest.watchList?.slice(0, 3).join(' • ') || 'None'}</div>
              <div><strong>Focus:</strong> {digest.focus?.slice(0, 3).join(' • ') || 'None'}</div>
            </div>
          )}
        </div>
        )}
        <SmartDataTable<RecentTask>
          data={stats.recent}
          columns={columns}
          tableId="dashboard-recent"
          onRowClick={(row) => onTaskSelect(row.id)}
          emptyMessage={intl.formatMessage({ id: 'dashboard.recent.empty' })}
          alternateRows={true}
        />
      </div>
    </div>
  );
};

