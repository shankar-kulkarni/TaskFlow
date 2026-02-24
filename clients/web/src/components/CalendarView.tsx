import { useStore } from '../store';
import { useIntl } from 'react-intl';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';

interface CalendarViewProps {
  onTaskSelect: (taskId: string) => void;
  onNewTask: () => void;
}

export const CalendarView = ({ onTaskSelect, onNewTask }: CalendarViewProps) => {
  const { tasks, activeProjectId, projects } = useStore();
  const intl = useIntl();

  const visibleTasks = Object.values(tasks).filter(task =>
    !activeProjectId || task.project?.id === activeProjectId
  );

  const selectedProject = activeProjectId ? projects[activeProjectId] : null;
  const title = selectedProject
    ? intl.formatMessage({ id: 'calendar.titleWithProject' }, { project: selectedProject.name })
    : intl.formatMessage({ id: 'calendar.title' });
  const subtitle = selectedProject
    ? intl.formatMessage({ id: 'calendar.subtitleWithProject' })
    : intl.formatMessage({ id: 'calendar.subtitle' });
  const dayLabels = [
    intl.formatMessage({ id: 'calendar.day.sun' }),
    intl.formatMessage({ id: 'calendar.day.mon' }),
    intl.formatMessage({ id: 'calendar.day.tue' }),
    intl.formatMessage({ id: 'calendar.day.wed' }),
    intl.formatMessage({ id: 'calendar.day.thu' }),
    intl.formatMessage({ id: 'calendar.day.fri' }),
    intl.formatMessage({ id: 'calendar.day.sat' })
  ];

  // Group tasks by date
  const tasksByDate = visibleTasks.reduce((acc, task) => {
    if (task.dueDate) {
      const date = new Date(task.dueDate).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(task);
    }
    return acc;
  }, {} as Record<string, typeof tasks[keyof typeof tasks][]>);

  // Get current month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Generate calendar days
  const firstDay = new Date(currentYear, currentMonth, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const calendarDays = [];
  const currentDate = new Date(startDate);

  for (let i = 0; i < 42; i++) { // 6 weeks
    calendarDays.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const isToday = (date: Date) => date.toDateString() === now.toDateString();
  const isCurrentMonth = (date: Date) => date.getMonth() === currentMonth;

  return (
    <div className="main">
      <div className="ph">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ph-title">{title}</h1>
            <HelpSection
              titleId="help.calendar.title"
              items={["help.calendar.item1", "help.calendar.item2", "help.calendar.item3"]}
            />
          </div>
          <p className="ph-sub">{subtitle}</p>
        </div>
        <div className="ph-actions">
          <Tooltip content={intl.formatMessage({ id: 'tooltip.calendar.newTask' })}>
            <button className="btn btn-primary" onClick={onNewTask}>
              {intl.formatMessage({ id: 'calendar.newTask' })}
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="calendar-content" style={{ padding: '28px' }}>
        <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
            {intl.formatDate(new Date(currentYear, currentMonth), { month: 'long', year: 'numeric' })}
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Tooltip content={intl.formatMessage({ id: 'tooltip.calendar.prevMonth' })}>
              <button className="btn btn-ghost" style={{ padding: '6px 12px' }}>‹</button>
            </Tooltip>
            <Tooltip content={intl.formatMessage({ id: 'tooltip.calendar.nextMonth' })}>
              <button className="btn btn-ghost" style={{ padding: '6px 12px' }}>›</button>
            </Tooltip>
          </div>
        </div>

        <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 'var(--r)' }}>
          {/* Day headers */}
          {dayLabels.map(day => (
            <div key={day} style={{
              background: 'var(--s1)',
              padding: '12px 8px',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--tx-lo)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((date, index) => {
            const dateStr = date.toDateString();
            const dayTasks = tasksByDate[dateStr] || [];
            const isCurrentMonthDay = isCurrentMonth(date);

            return (
              <div key={index} style={{
                background: 'var(--bg)',
                minHeight: '120px',
                padding: '8px',
                position: 'relative'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: isToday(date) ? '700' : '500',
                  color: isCurrentMonthDay ? (isToday(date) ? 'var(--lime)' : 'var(--tx-hi)') : 'var(--tx-lo)',
                  marginBottom: '4px'
                }}>
                  {date.getDate()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayTasks.slice(0, 3).map(task => (
                    <Tooltip key={task.id} content={intl.formatMessage({ id: 'tooltip.calendar.openTask' })}>
                      <div
                        onClick={() => onTaskSelect(task.id)}
                        style={{
                          background: task.status === 'DONE' ? 'var(--teal)' : task.status === 'IN_PROGRESS' ? 'var(--blue)' : task.status === 'IN_REVIEW' ? 'var(--amber)' : 'var(--tx-lo)',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          opacity: task.status === 'DONE' ? 0.7 : 1
                        }}
                      >
                        {task.title}
                      </div>
                    </Tooltip>
                  ))}
                  {dayTasks.length > 3 && (
                    <div style={{
                      fontSize: '10px',
                      color: 'var(--tx-lo)',
                      textAlign: 'center',
                      marginTop: '2px'
                    }}>
                      {intl.formatMessage({ id: 'calendar.more' }, { count: dayTasks.length - 3 })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};