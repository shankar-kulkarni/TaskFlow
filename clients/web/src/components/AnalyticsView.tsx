import { useStore } from '../store';
import { useIntl } from 'react-intl';
import { HelpSection } from './shared/HelpSection';
import { isOverdueForTenant } from '../utils/tenantDate';

interface AnalyticsViewProps {
  onTaskSelect: (taskId: string) => void;
  onNewTask: () => void;
}

export const AnalyticsView = ({ onTaskSelect: _onTaskSelect, onNewTask: _onNewTask }: AnalyticsViewProps) => {
  const { tasks, projects, activeProjectId } = useStore();
  const intl = useIntl();

  const selectedProject = activeProjectId ? projects[activeProjectId] : null;
  const title = selectedProject
    ? intl.formatMessage({ id: 'analytics.titleWithProject' }, { project: selectedProject.name })
    : intl.formatMessage({ id: 'analytics.title' });
  const subtitle = selectedProject
    ? intl.formatMessage({ id: 'analytics.subtitleWithProject' })
    : intl.formatMessage({ id: 'analytics.subtitle' });

  const allTasks = Object.values(tasks);

  // Calculate metrics
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(task => task.status === 'DONE').length;
  const inProgressTasks = allTasks.filter(task => task.status === 'IN_PROGRESS').length;
  const overdueTasks = allTasks.filter(task =>
    task.status !== 'DONE' && isOverdueForTenant(task.dueDate)
  ).length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Tasks by status
  const statusData = [
    { status: intl.formatMessage({ id: 'status.todo' }), count: allTasks.filter(t => t.status === 'TODO').length, color: 'var(--tx-lo)' },
    { status: intl.formatMessage({ id: 'status.in_progress' }), count: inProgressTasks, color: 'var(--blue)' },
    { status: intl.formatMessage({ id: 'status.in_review' }), count: allTasks.filter(t => t.status === 'IN_REVIEW').length, color: 'var(--amber)' },
    { status: intl.formatMessage({ id: 'status.done' }), count: completedTasks, color: 'var(--teal)' }
  ];

  // Tasks by priority
  const priorityData = [
    { priority: intl.formatMessage({ id: 'priority.critical' }), count: allTasks.filter(t => t.priority === 'CRITICAL').length, color: 'var(--rose)' },
    { priority: intl.formatMessage({ id: 'priority.high' }), count: allTasks.filter(t => t.priority === 'HIGH').length, color: 'var(--amber)' },
    { priority: intl.formatMessage({ id: 'priority.medium' }), count: allTasks.filter(t => t.priority === 'MEDIUM').length, color: 'var(--blue)' },
    { priority: intl.formatMessage({ id: 'priority.low' }), count: allTasks.filter(t => t.priority === 'LOW').length, color: 'var(--tx-lo)' }
  ];

  // Tasks by project
  const projectTasks = Object.values(projects).map(project => ({
    name: project.name,
    count: allTasks.filter(task => task.project?.id === project.id).length,
    color: project.color
  }));

  // Simple bar chart component
  const BarChart = ({ data, title }: { data: any[], title: string }) => (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--tx-hi)', marginBottom: '16px' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '120px', fontSize: '13px', color: 'var(--tx-md)' }}>
              {item.status || item.priority || item.name}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                height: '24px',
                background: item.color,
                borderRadius: '4px',
                width: `${item.count > 0 ? Math.max(20, (item.count / Math.max(...data.map(d => d.count))) * 100) : 0}%`,
                minWidth: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '8px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                {item.count}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="main">
      <div className="ph">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ph-title">{title}</h1>
            <HelpSection
              titleId="help.analytics.title"
              items={["help.analytics.item1", "help.analytics.item2", "help.analytics.item3"]}
            />
          </div>
          <p className="ph-sub">{subtitle}</p>
        </div>
      </div>
      <div className="analytics-content" style={{ padding: '28px' }}>
        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{
            background: 'var(--s1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--tx-hi)', marginBottom: '4px' }}>
              {totalTasks}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tx-lo)' }}>{intl.formatMessage({ id: 'analytics.stats.totalTasks' })}</div>
          </div>

          <div style={{
            background: 'var(--s1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--teal)', marginBottom: '4px' }}>
              {completionRate}%
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tx-lo)' }}>{intl.formatMessage({ id: 'analytics.stats.completionRate' })}</div>
          </div>

          <div style={{
            background: 'var(--s1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--blue)', marginBottom: '4px' }}>
              {inProgressTasks}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tx-lo)' }}>{intl.formatMessage({ id: 'analytics.stats.inProgress' })}</div>
          </div>

          <div style={{
            background: 'var(--s1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--rose)', marginBottom: '4px' }}>
              {overdueTasks}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tx-lo)' }}>{intl.formatMessage({ id: 'analytics.stats.overdue' })}</div>
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          <BarChart data={statusData} title={intl.formatMessage({ id: 'analytics.charts.byStatus' })} />
          <BarChart data={priorityData} title={intl.formatMessage({ id: 'analytics.charts.byPriority' })} />
          <BarChart data={projectTasks} title={intl.formatMessage({ id: 'analytics.charts.byProject' })} />

          {/* Recent Activity */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--tx-hi)', marginBottom: '16px' }}>
              {intl.formatMessage({ id: 'analytics.recent.title' })}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allTasks.slice(0, 5).map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: task.status === 'DONE' ? 'var(--teal)' : task.status === 'IN_PROGRESS' ? 'var(--blue)' : 'var(--tx-lo)',
                    flexShrink: 0
                  }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--tx-hi)', fontWeight: '500' }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--tx-lo)' }}>
                      {intl.formatMessage(
                        { id: 'analytics.recent.updated' },
                        { date: intl.formatDate(new Date(task.updatedAt)) }
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
