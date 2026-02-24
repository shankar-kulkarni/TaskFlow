import { useStore } from '../store';
import { useIntl } from 'react-intl';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';

interface TimelineViewProps {
  onTaskSelect: (taskId: string) => void;
  onNewTask: () => void;
}

export const TimelineView = ({ onTaskSelect, onNewTask }: TimelineViewProps) => {
  const { tasks, projects, activeProjectId } = useStore();
  const intl = useIntl();

  const selectedProject = activeProjectId ? projects[activeProjectId] : null;
  const title = selectedProject
    ? intl.formatMessage({ id: 'timeline.titleWithProject' }, { project: selectedProject.name })
    : intl.formatMessage({ id: 'timeline.title' });
  const subtitle = selectedProject
    ? intl.formatMessage({ id: 'timeline.subtitleWithProject' })
    : intl.formatMessage({ id: 'timeline.subtitle' });

  const visibleTasks = Object.values(tasks).filter(task =>
    !activeProjectId || task.project?.id === activeProjectId
  );

  // Get tasks with dates
  const timelineTasks = visibleTasks.filter(task =>
    task.startDate || task.dueDate
  ).sort((a, b) => {
    const aDate = new Date(a.startDate || a.dueDate || a.createdAt);
    const bDate = new Date(b.startDate || b.dueDate || b.createdAt);
    return aDate.getTime() - bDate.getTime();
  });

  // Calculate timeline range
  const allDates = timelineTasks.flatMap(task => [
    task.startDate ? new Date(task.startDate) : null,
    task.dueDate ? new Date(task.dueDate) : null
  ]).filter(Boolean) as Date[];

  if (allDates.length === 0) {
    return (
      <div className="main">
        <div className="ph">
          <div>
            <h1 className="ph-title">{title}</h1>
            <p className="ph-sub">{subtitle}</p>
          </div>
          <div className="ph-actions">
            <Tooltip content={intl.formatMessage({ id: 'tooltip.timeline.newTask' })}>
              <button className="btn btn-primary" onClick={onNewTask}>
                {intl.formatMessage({ id: 'timeline.newTask' })}
              </button>
            </Tooltip>
          </div>
        </div>
        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--tx-lo)' }}>
          {intl.formatMessage({ id: 'timeline.empty' })}
        </div>
      </div>
    );
  }

  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

  // Extend range by 1 week on each side
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 7);

  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const dayWidth = 30;
  const chartWidth = Math.max(800, totalDays * dayWidth);

  const getTaskPosition = (task: typeof timelineTasks[0]) => {
    const startDate = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
    const rawEndDate = task.dueDate ? new Date(task.dueDate) : startDate;
    const endDate = rawEndDate < startDate ? startDate : rawEndDate;

    const startOffset = Math.floor((startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    return { start: startOffset, duration };
  };

  return (
    <div className="main">
      <div className="ph">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ph-title">{title}</h1>
            <HelpSection
              titleId="help.timeline.title"
              items={["help.timeline.item1", "help.timeline.item2", "help.timeline.item3"]}
            />
          </div>
          <p className="ph-sub">{subtitle}</p>
        </div>
        <div className="ph-actions">
          <Tooltip content={intl.formatMessage({ id: 'tooltip.timeline.newTask' })}>
            <button className="btn btn-primary" onClick={onNewTask}>
              {intl.formatMessage({ id: 'timeline.newTask' })}
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="timeline-content" style={{ padding: '28px' }}>
        <div className="gantt-chart" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: `${chartWidth}px` }}>
            {/* Timeline header */}
            <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div style={{ width: '200px', fontSize: '12px', fontWeight: '600', color: 'var(--tx-lo)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {intl.formatMessage({ id: 'timeline.header.task' })}
              </div>
              <div style={{ flex: 1, position: 'relative', height: '30px' }}>
                {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => {
                  const weekStart = new Date(minDate);
                  weekStart.setDate(weekStart.getDate() + i * 7);
                  return (
                    <div key={i} style={{
                      position: 'absolute',
                      left: `${i * 7 * dayWidth}px`,
                      top: '0',
                      width: `${7 * dayWidth}px`,
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '11px',
                      color: 'var(--tx-lo)',
                      borderRight: '1px solid var(--border)',
                      paddingLeft: '8px'
                    }}>
                      {intl.formatDate(weekStart, { month: 'short', day: 'numeric' })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tasks */}
            {timelineTasks.map((task) => {
              const { start, duration } = getTaskPosition(task);
              const project = task.project ? projects[task.project.id] : null;

              return (
                <div key={task.id} style={{ display: 'flex', marginBottom: '8px', alignItems: 'center' }}>
                  <div style={{ width: '200px', paddingRight: '16px' }}>
                    <Tooltip content={intl.formatMessage({ id: 'tooltip.timeline.openTask' })}>
                      <div
                        onClick={() => onTaskSelect(task.id)}
                        style={{
                          fontSize: '13px',
                          color: 'var(--tx-hi)',
                          cursor: 'pointer',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {task.title}
                      </div>
                    </Tooltip>
                    <div style={{ fontSize: '11px', color: 'var(--tx-lo)', marginTop: '2px' }}>
                      {project?.name || intl.formatMessage({ id: 'common.noProject' })}
                    </div>
                  </div>

                  <div style={{ flex: 1, position: 'relative', height: '32px' }}>
                    <Tooltip content={intl.formatMessage({ id: 'tooltip.timeline.openTask' })}>
                      <div
                        onClick={() => onTaskSelect(task.id)}
                        style={{
                          position: 'absolute',
                          left: `${start * dayWidth}px`,
                          width: `${duration * dayWidth}px`,
                          height: '24px',
                          background: task.status === 'DONE' ? 'var(--teal)' : task.status === 'IN_PROGRESS' ? 'var(--blue)' : task.status === 'IN_REVIEW' ? 'var(--amber)' : 'var(--tx-lo)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 8px',
                          fontSize: '11px',
                          fontWeight: '500',
                          color: '#fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {task.title}
                        </span>
                      </div>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};