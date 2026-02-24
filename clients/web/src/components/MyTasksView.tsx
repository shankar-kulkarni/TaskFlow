import { useMemo } from 'react';
import { useStore } from '../store';
import { useIntl } from 'react-intl';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';
import { SmartDataTable } from './shared/SmartDataTable';
import type { Column } from './shared/DataTableTypes';
import { useAuth } from '../auth/AuthContext';
import { canCreateOrEditTasks } from '../auth/permissions';

interface MyTasksViewProps {
  onTaskSelect: (taskId: string) => void;
  onNewTask: () => void;
}

export const MyTasksView = ({ onTaskSelect, onNewTask }: MyTasksViewProps) => {
  const { projects, activeProjectId, tasks } = useStore();
  const { user } = useAuth();
  const intl = useIntl();
  const allowTaskWrite = canCreateOrEditTasks(user?.role);

  const selectedProject = activeProjectId ? projects[activeProjectId] : null;
  const title = selectedProject
    ? intl.formatMessage({ id: 'myTasks.titleWithProject' }, { project: selectedProject.name })
    : intl.formatMessage({ id: 'myTasks.title' });
  const subtitle = selectedProject
    ? intl.formatMessage({ id: 'myTasks.subtitleWithProject' })
    : intl.formatMessage({ id: 'myTasks.subtitle' });

  const allTaskRows = useMemo(() => Object.values(tasks) as any[], [tasks]);

  const myTasks = allTaskRows.filter((task) => {
    const createdByCurrentUser = task?.createdBy === user?.id || task?.creator?.id === user?.id;
    const assignments = Array.isArray(task?.userAssignments) ? task.userAssignments : [];
    const assignedToCurrentUser = assignments.some(
      (assignment: any) => assignment?.userId === user?.id || assignment?.user?.id === user?.id
    );
    if (!assignedToCurrentUser && !createdByCurrentUser) return false;
    if (!activeProjectId) return true;
    const taskProjectId = task.projectId || task.project_id || task.project?.id;
    return taskProjectId === activeProjectId;
  });
  const allTasksCount = allTaskRows.length;

  const tasksByStatus = {
    todo: myTasks.filter(task => task.status === 'TODO'),
    in_progress: myTasks.filter(task => task.status === 'IN_PROGRESS'),
    in_review: myTasks.filter(task => task.status === 'IN_REVIEW'),
    done: myTasks.filter(task => task.status === 'DONE')
  };

  const statusConfig = {
    todo: { color: 'var(--tx-lo)', label: intl.formatMessage({ id: 'status.todo' }), bg: 'var(--s2)' },
    in_progress: { color: 'var(--blue)', label: intl.formatMessage({ id: 'status.in_progress' }), bg: 'rgba(79, 142, 255, 0.1)' },
    in_review: { color: 'var(--amber)', label: intl.formatMessage({ id: 'status.in_review' }), bg: 'rgba(255, 184, 77, 0.1)' },
    done: { color: 'var(--teal)', label: intl.formatMessage({ id: 'status.done' }), bg: 'rgba(63, 221, 199, 0.1)' }
  };

  type MyTaskRow = {
    id: string;
    title: string;
    description?: string;
    priority: string;
    dueDate?: string;
    projectId?: string;
    project?: { id?: string };
  };

  const columns: Column<MyTaskRow>[] = useMemo(
    () => [
      {
        id: 'title',
        label: intl.formatMessage({ id: 'taskBoard.column.task' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '1fr',
      },
      {
        id: 'priority',
        label: intl.formatMessage({ id: 'taskBoard.column.priority' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '120px',
        render: (value: string) => {
          const priorityClass = `priority-${String(value).toLowerCase()}`;
          return <span className={priorityClass}>{value}</span>;
        },
      },
      {
        id: 'project',
        label: intl.formatMessage({ id: 'taskBoard.column.project' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '170px',
        accessor: (row) => {
          const projectId = row.projectId || row.project?.id;
          return projectId ? projects[projectId]?.name || '' : '';
        },
        render: (_value: unknown, row) => {
          const projectId = row.projectId || row.project?.id;
          const project = projectId ? projects[projectId] : null;
          return project ? project.name : <span className="text-[var(--tx-lo)]">-</span>;
        },
      },
      {
        id: 'dueDate',
        label: intl.formatMessage({ id: 'taskBoard.column.dueDate' }),
        sortable: true,
        searchable: true,
        visible: true,
        width: '140px',
        render: (value: string | undefined) => {
          if (!value) return <span className="text-[var(--tx-lo)]">-</span>;
          return intl.formatDate(new Date(value));
        },
      },
    ],
    [intl, projects]
  );

  return (
    <div className="main">
      <div className="ph">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ph-title">{title}</h1>
            <HelpSection
              titleId="help.myTasks.title"
              items={["help.myTasks.item1", "help.myTasks.item2", "help.myTasks.item3"]}
            />
          </div>
          <p className="ph-sub">{subtitle}</p>
          <div className="ph-sub" style={{ marginTop: '6px' }}>
            <span className="chip" style={{ background: 'var(--s2)', color: 'var(--tx-md)' }}>
              My Tasks: {myTasks.length} / All Tasks: {allTasksCount}
            </span>
          </div>
        </div>
        <div className="ph-actions">
          <Tooltip content={intl.formatMessage({ id: 'tooltip.myTasks.newTask' })}>
            <button className="btn btn-primary" onClick={allowTaskWrite ? onNewTask : undefined} disabled={!allowTaskWrite}>
              {intl.formatMessage({ id: 'myTasks.newTask' })}
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="my-tasks-content" style={{ padding: '0 28px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
            <div key={status} style={{
              background: 'var(--s1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              padding: '20px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: statusConfig[status as keyof typeof statusConfig].color,
                    margin: 0,
                  }}>
                    {statusConfig[status as keyof typeof statusConfig].label}
                  </h3>
                  <HelpSection
                    titleId="help.myTasks.title"
                    items={["help.myTasks.item1", "help.myTasks.item2", "help.myTasks.item3"]}
                  />
                </div>
                <span style={{
                  background: 'var(--s2)',
                  color: 'var(--tx-lo)',
                  fontSize: '12px',
                  fontWeight: '500',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {statusTasks.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {statusTasks.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '24px',
                    color: 'var(--tx-lo)',
                    fontSize: '14px'
                  }}>
                    {intl.formatMessage(
                      { id: 'myTasks.noTasks' },
                      { status: statusConfig[status as keyof typeof statusConfig].label }
                    )}
                  </div>
                ) : (
                  <SmartDataTable<MyTaskRow>
                    data={statusTasks as MyTaskRow[]}
                    columns={columns}
                    tableId={`my-tasks-${status}`}
                    onRowClick={(row) => onTaskSelect(row.id)}
                    emptyMessage={intl.formatMessage(
                      { id: 'myTasks.noTasks' },
                      { status: statusConfig[status as keyof typeof statusConfig].label }
                    )}
                    alternateRows={true}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

