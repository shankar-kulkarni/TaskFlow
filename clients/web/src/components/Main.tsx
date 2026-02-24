import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { TaskForm } from './TaskForm';

interface Task {
  id: string;
  title: string;
  assignees: { initials: string; color: string }[];
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Todo' | 'In Progress' | 'In Review' | 'Blocked' | 'Done';
  checked: boolean;
}

interface MainProps {
  onTaskSelect: (task: Task) => void;
  onNewTask?: () => void;
  onFilter?: () => void;
  onTaskToggle?: (taskId: string, checked: boolean) => void;
  onTaskMenu?: (taskId: string) => void;
  currentProject?: string;
  showNewTaskModal?: boolean;
  showFilterDialog?: boolean;
  onCloseNewTaskModal?: () => void;
  onCloseFilterDialog?: () => void;
  onTaskFormSubmit?: (taskData: any) => void;
  onTaskFormCancel?: () => void;
}

export const Main: React.FC<MainProps> = ({
  onTaskSelect,
  onNewTask,
  onFilter,
  onTaskToggle,
  onTaskMenu,
  currentProject = 'design-system',
  showNewTaskModal = false,
  showFilterDialog = false,
  onCloseNewTaskModal,
  onCloseFilterDialog,
  onTaskFormSubmit,
  onTaskFormCancel
}) => {
  const [activeTab, setActiveTab] = useState('All');
  const [activeView, setActiveView] = useState('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [apiTasks, setApiTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadTasks = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.getTasks();
        if (mounted) {
          setApiTasks(Array.isArray(response) ? response : []);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load tasks'));
          setApiTasks([]);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadTasks();
    return () => {
      mounted = false;
    };
  }, []);

  // Transform API data to match component interface
  const tasks: Task[] = apiTasks.map((task: any) => ({
    id: task.id,
    title: task.title,
    assignees: [
      ...task.userAssignments.map((ua: any) => ({
        initials: ua.user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
        color: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color for now
      })),
      ...task.groupAssignments.map((ga: any) => ({
        initials: ga.group.name.substring(0, 2).toUpperCase(),
        color: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color for now
      }))
    ],
    priority: task.priority === 'CRITICAL' ? 'Critical' :
             task.priority === 'HIGH' ? 'High' :
             task.priority === 'MEDIUM' ? 'Medium' :
             task.priority === 'LOW' ? 'Low' : 'Medium',
    status: task.status === 'TODO' ? 'Todo' : 
            task.status === 'IN_PROGRESS' ? 'In Progress' : 
            task.status === 'IN_REVIEW' ? 'In Review' :
            task.status === 'DONE' ? 'Done' :
            task.status === 'BLOCKED' ? 'Blocked' : 'Todo',
    checked: task.status === 'DONE'
  }));

  const handleTabSwitch = (tab: string) => {
    setActiveTab(tab);
  };

  const handleViewSwitch = (view: string) => {
    setActiveView(view);
  };

  const handleTaskSelect = (task: Task) => {
    setSelectedTaskId(task.id);
    onTaskSelect(task);
  };

  const handleCheckboxClick = (taskId: string, currentChecked: boolean) => {
    onTaskToggle?.(taskId, !currentChecked);
  };

  const handleRowMenuClick = (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent task selection
    onTaskMenu?.(taskId);
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'chip-c';
      case 'High': return 'chip-h';
      case 'Medium': return 'chip-m';
      case 'Low': return 'chip-l';
      default: return 'chip-l';
    }
  };

  const getProjectDisplayName = (project: string) => {
    const names: { [key: string]: string } = {
      'design-system': 'Design System',
      'web-redesign': 'Web Redesign',
      'mobile-app': 'Mobile App',
      'brand-refresh': 'Brand Refresh',
      'docs-portal': 'Docs Portal'
    };
    return names[project] || 'Design System';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress': return '#4f8eff';
      case 'Todo': return '#8a8a9a';
      case 'In Review': return '#ffb84d';
      case 'Done': return '#3fddc7';
      default: return '#8a8a9a';
    }
  };

  return (
    <main className="main">
      {showNewTaskModal ? (
        <div className="task-form-container">
          <div className="ph">
            <div className="ph-left">
              <div className="ph-title">Create New Task</div>
              <div className="ph-sub">Add a new task to {getProjectDisplayName(currentProject)}</div>
            </div>
          </div>
          <div className="form-content">
            <TaskForm
              onSubmit={onTaskFormSubmit || (() => {})}
              onCancel={onTaskFormCancel || (() => {})}
              isEditing={false}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="ph">
            <div className="ph-left">
              <div className="ph-title">{getProjectDisplayName(currentProject)} Tasks</div>
              <div className="ph-sub">24 tasks · 9 in progress · 5 blocked</div>
            </div>
            <div className="ph-actions">
              <button className="btn btn-ghost" onClick={onFilter} title="Filter tasks">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>Filter
              </button>
              <button className="btn btn-primary" onClick={onNewTask} title="Create new task">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>New Task
              </button>
            </div>
          </div>
      <div className="toolbar">
        <div className="ftabs">
          <button className={`ftab ${activeTab === 'All' ? 'on' : ''}`} onClick={() => handleTabSwitch('All')}>All</button>
          <button className={`ftab ${activeTab === 'Active' ? 'on' : ''}`} onClick={() => handleTabSwitch('Active')}>Active</button>
          <button className={`ftab ${activeTab === 'Review' ? 'on' : ''}`} onClick={() => handleTabSwitch('Review')}>Review</button>
          <button className={`ftab ${activeTab === 'Done' ? 'on' : ''}`} onClick={() => handleTabSwitch('Done')}>Done</button>
        </div>
        <span className="tb-gap"></span>
        <div className="vbtns">
          <button className={`vb ${activeView === 'list' ? 'on' : ''}`} onClick={() => handleViewSwitch('list')} title="List view">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M3 8h10M3 12h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button className={`vb ${activeView === 'grid' ? 'on' : ''}`} onClick={() => handleViewSwitch('grid')} title="Grid view">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="5" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="1" width="6" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
          <button className={`vb ${activeView === 'board' ? 'on' : ''}`} onClick={() => handleViewSwitch('board')} title="Board view">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="stat-val">24</div>
          <div className="stat-lbl">Total Tasks</div>
          <div className="stat-delta up">↑ 4 this week</div>
        </div>
        <div className="stat">
          <div className="stat-val">9</div>
          <div className="stat-lbl">In Progress</div>
          <div className="stat-delta up">↑ 2 today</div>
        </div>
        <div className="stat">
          <div className="stat-val">5</div>
          <div className="stat-lbl">Blocked</div>
          <div className="stat-delta dn">↑ 1 new</div>
        </div>
        <div className="stat">
          <div className="stat-val">68%</div>
          <div className="stat-lbl">Completion</div>
          <div className="stat-delta up">↑ 8% this sprint</div>
        </div>
      </div>
      <div className="list">
        <div className="list-head">
          <span></span><span>Title</span><span>Assignees</span><span>Priority</span><span>Status</span><span></span>
        </div>
        {isLoading ? (
          <div className="loading">Loading tasks...</div>
        ) : error ? (
          <div className="error">Error loading tasks: {error.message}</div>
        ) : tasks.length === 0 ? (
          <div className="empty">No tasks found</div>
        ) : (
          tasks.map((task, index) => (
            <div
              key={task.id}
              className={`task-row ${selectedTaskId === task.id ? 'sel' : ''}`}
              onClick={() => handleTaskSelect(task)}
              style={{ animationDelay: `${index * 0.03}s` }}
            >
              <div className={`cb ${task.checked ? 'ck' : ''}`} onClick={(e) => {
                e.stopPropagation();
                handleCheckboxClick(task.id, task.checked);
              }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className={`task-title ${task.status === 'Done' ? 'done' : ''}`}>{task.title}</div>
              <div className="assign">
                {task.assignees.map((assignee, idx) => (
                  <div key={idx} className="aav" style={{ background: assignee.color, marginLeft: idx > 0 ? '-6px' : '0' }}>
                    {assignee.initials}
                  </div>
                ))}
              </div>
              <div><span className={`chip ${getPriorityClass(task.priority)}`}>{task.priority}</span></div>
              <div className="status">
                <span className="sdot" style={{ background: getStatusColor(task.status) }}></span>
                <span style={{ color: getStatusColor(task.status), fontSize: '12px' }}>{task.status}</span>
              </div>
              <button className="row-menu" onClick={(e) => handleRowMenuClick(task.id, e)} title="Task options">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="3" r="1.2" fill="currentColor"/>
                  <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
                  <circle cx="8" cy="13" r="1.2" fill="currentColor"/>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* New Task Modal Placeholder */}
      {showNewTaskModal && (
        <div className="modal-overlay" onClick={onCloseNewTaskModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Task</h3>
              <button className="modal-close" onClick={onCloseNewTaskModal}>×</button>
            </div>
            <div className="modal-body">
              <p>New task creation form will be implemented here.</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Dialog Placeholder */}
      {showFilterDialog && (
        <div className="modal-overlay" onClick={onCloseFilterDialog}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Filter Tasks</h3>
              <button className="modal-close" onClick={onCloseFilterDialog}>×</button>
            </div>
            <div className="modal-body">
              <p>Task filtering options will be implemented here.</p>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </main>
  );
};
