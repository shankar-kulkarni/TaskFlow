import { useStore } from '../store';
import type { ViewType } from '../store';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useIntl } from 'react-intl';
import { Tooltip } from './shared/Tooltip';
import { canCreateProject } from '../auth/permissions';

interface NavProps {
  onViewChange: (view: ViewType, projectId?: string) => void;
  workflowsEnabled: boolean;
  betaReportsEnabled: boolean;
}

export const Nav: React.FC<NavProps> = ({ onViewChange, workflowsEnabled, betaReportsEnabled }) => {
  const {
    activeView,
    activeProjectId,
    projects,
    tasks,
    getTaskCount,
    getTimelineCount,
    createProject,
    updateProject,
    loadProjects
  } = useStore();
  const { user, logout } = useAuth();
  const allowProjectCreate = canCreateProject(user?.role);
  const intl = useIntl();
  const isImpersonating = localStorage.getItem('taskflow.impersonating') === 'true';
  const canAccessAllTasks = user?.role === 'ADMIN' || user?.role === 'OWNER';
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const navIcons: Record<string, string> = {
    dashboard: '📊',
    tasks: '📋',
    allTasks: '🗂',
    calendar: '📅',
    timeline: '🕒',
    myTasks: '✅',
    analytics: '📈',
    workflows: '🔗',
    account: '👤',
    add: '➕',
    endImpersonation: '⏹',
    signOut: '➜]',
  };

  const renderNavLabel = (iconKey: keyof typeof navIcons, label: string) => (
    <>
      <span className="ni-icon" aria-hidden="true">{navIcons[iconKey]}</span>
      {!navCollapsed && <span>{label}</span>}
    </>
  );

  const handleViewChange = (view: string) => {
    onViewChange(view as ViewType);
  };

  const handleProjectSelect = (projectId: string) => {
    onViewChange('tasks', projectId);
  };

  const handleEditProject = (projectId: string, currentName: string) => {
    setEditingProjectId(projectId);
    setEditingProjectName(currentName);
  };

  const handleSaveProjectName = async (projectId: string) => {
    if (editingProjectName.trim()) {
      await updateProject(projectId, editingProjectName);
    }
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleCreateProject = async () => {
    if (newProjectName.trim()) {
      await createProject(newProjectName, '#' + Math.floor(Math.random() * 16777215).toString(16));
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  const handleEndImpersonation = async () => {
    localStorage.removeItem('taskflow.impersonating');
    await logout();
    window.close();
  };

  // const handleDeleteProject = async (projectId: string, projectName: string) => {
  //   if (window.confirm(`Delete project "${projectName}"? This cannot be undone.`)) {
  //     await deleteProject(projectId);
  //   }
  // };

  const projectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(tasks).forEach(task => {
      const projectId = task.projectId || task.project?.id;
      if (projectId) {
        counts[projectId] = (counts[projectId] || 0) + 1;
      }
    });
    return counts;
  }, [tasks]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  return (
    <nav className={`nav ${navCollapsed ? 'collapsed' : ''}`}>
      <div className="nav-pin-row">
        <Tooltip content={navCollapsed ? 'Unpin navigation (expand menu)' : 'Pin navigation (collapse menu)'} placement="right">
          <button
            type="button"
            className="nav-pin-btn"
            onClick={() => setNavCollapsed((current) => !current)}
            title={navCollapsed ? 'Unpin navigation (expand menu)' : 'Pin navigation (collapse menu)'}
            aria-label={navCollapsed ? 'Unpin navigation (expand menu)' : 'Pin navigation (collapse menu)'}
          >
            {navCollapsed ? '📌' : '📍'}
          </button>
        </Tooltip>
      </div>
      <div className="nav-sec">
        {!navCollapsed && <span className="nav-lbl">{intl.formatMessage({ id: 'nav.views' })}</span>}
        <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.dashboard' })} className="tooltip-block" placement="right">
          <div className={`ni ${activeView === 'dashboard' ? 'on' : ''}`} onClick={() => handleViewChange('dashboard')}>
            {renderNavLabel('dashboard', intl.formatMessage({ id: 'nav.dashboard' }))}
          </div>
        </Tooltip>
        <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.tasks' })} className="tooltip-block" placement="right">
          <div className={`ni ${activeView === 'tasks' && !activeProjectId ? 'on' : ''}`} onClick={() => handleViewChange('tasks')}>
            {renderNavLabel('tasks', intl.formatMessage({ id: 'nav.tasks' }))}<span className="ni-badge">{getTaskCount()}</span>
          </div>
        </Tooltip>
        {canAccessAllTasks && (
          <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.allTasks' })} className="tooltip-block" placement="right">
            <div className={`ni ${activeView === 'all-tasks' ? 'on' : ''}`} onClick={() => handleViewChange('all-tasks')}>
              {renderNavLabel('allTasks', intl.formatMessage({ id: 'nav.allTasks' }))}
            </div>
          </Tooltip>
        )}
        <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.calendar' })} className="tooltip-block" placement="right">
          <div className={`ni ${activeView === 'calendar' ? 'on' : ''}`} onClick={() => handleViewChange('calendar')}>
            {renderNavLabel('calendar', intl.formatMessage({ id: 'nav.calendar' }))}
          </div>
        </Tooltip>
        <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.timeline' })} className="tooltip-block" placement="right">
          <div className={`ni ${activeView === 'timeline' ? 'on' : ''}`} onClick={() => handleViewChange('timeline')}>
            {renderNavLabel('timeline', intl.formatMessage({ id: 'nav.timeline' }))}<span className="ni-badge">{getTimelineCount()}</span>
          </div>
        </Tooltip>
        <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.myTasks' })} className="tooltip-block" placement="right">
          <div className={`ni ${activeView === 'my-tasks' ? 'on' : ''}`} onClick={() => handleViewChange('my-tasks')}>
            {renderNavLabel('myTasks', intl.formatMessage({ id: 'nav.myTasks' }))}
          </div>
        </Tooltip>
        {betaReportsEnabled && (
          <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.analytics' })} className="tooltip-block" placement="right">
            <div className={`ni ${activeView === 'analytics' ? 'on' : ''}`} onClick={() => handleViewChange('analytics')}>
              {renderNavLabel('analytics', intl.formatMessage({ id: 'nav.analytics' }))}
            </div>
          </Tooltip>
        )}
        {workflowsEnabled && (
          <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.workflows' })} className="tooltip-block" placement="right">
            <div className={`ni ${activeView === 'workflows' ? 'on' : ''}`} onClick={() => handleViewChange('workflows')}>
              {renderNavLabel('workflows', intl.formatMessage({ id: 'nav.workflows' }))}
            </div>
          </Tooltip>
        )}
        <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.account' })} className="tooltip-block" placement="right">
          <div className={`ni ${activeView === 'account' ? 'on' : ''}`} onClick={() => handleViewChange('account')}>
            {renderNavLabel('account', intl.formatMessage({ id: 'nav.account' }))}
          </div>
        </Tooltip>
      </div>
      <div className="ndiv"></div>
      <div className="nav-sec">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!navCollapsed && <span className="nav-lbl">{intl.formatMessage({ id: 'nav.projects' })}</span>}
          <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.createProject' })} placement="right">
            <button
              onClick={() => allowProjectCreate && setShowNewProject(!showNewProject)}
              disabled={!allowProjectCreate}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--tx-md)',
                cursor: allowProjectCreate ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                padding: '2px 6px',
                borderRadius: '4px',
                transition: 'all 200ms',
                opacity: allowProjectCreate ? 1 : 0.45
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--s2)';
                e.currentTarget.style.color = 'var(--tx-hi)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--tx-md)';
              }}
            >
              <span>{navIcons.add}</span>
              {!navCollapsed && <span>{intl.formatMessage({ id: 'nav.addProject' })}</span>}
            </button>
          </Tooltip>
        </div>
        {!navCollapsed && showNewProject && (
          <div style={{ marginBottom: '8px', display: 'flex', gap: '4px' }}>
            <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.projectName' })} className="tooltip-block" placement="right">
              <input
                type="text"
                placeholder={intl.formatMessage({ id: 'nav.projectName' })}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleCreateProject()}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--s1)',
                  color: 'var(--tx-hi)',
                  fontSize: '12px'
                }}
                autoFocus
              />
            </Tooltip>
            <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.addProject' })} placement="right">
              <button
                onClick={handleCreateProject}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: 'var(--lime)',
                  border: 'none',
                  color: '#0a0a0c',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                {intl.formatMessage({ id: 'nav.addProject' })}
              </button>
            </Tooltip>
          </div>
        )}
        {Object.values(projects).map(project => (
          <Tooltip
            key={project.id}
            content={intl.formatMessage({ id: 'tooltip.nav.projectOpen' }, { project: project.name })}
            className="tooltip-block"
            placement="right"
          >
            <div
              className={`proj ${activeProjectId === project.id ? 'sel' : ''}`}
              onClick={() => handleProjectSelect(project.id)}
            >
              <span className="pdot" style={{ background: project.color }}></span>
              {editingProjectId === project.id ? (
                <input
                  type="text"
                  value={editingProjectName}
                  onChange={(e) => setEditingProjectName(e.target.value)}
                  onBlur={() => void handleSaveProjectName(project.id)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleSaveProjectName(project.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    padding: '2px 4px',
                    borderRadius: '3px',
                    border: '1px solid var(--lime)',
                    background: 'var(--s1)',
                    color: 'var(--tx-hi)',
                    fontSize: '12px'
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="pname"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleEditProject(project.id, project.name);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {navCollapsed ? '' : project.name}
                </span>
              )}
              {!navCollapsed && <span className="ptag">{projectCounts[project.id] || 0}</span>}
              {activeProjectId === project.id && null}
            </div>
          </Tooltip>
        ))}
      </div>
      <div className="nav-foot">
        <div className="ws">
          <div className="ws-av">{user?.displayName?.slice(0, 2).toUpperCase() || 'ME'}</div>
          {!navCollapsed && <div>
            <div className="ws-name">{user?.displayName || 'My Account'}</div>
            <div className="ws-plan">{user?.email || 'Signed in'}</div>
          </div>}
        </div>
        {isImpersonating && (
          <Tooltip content="End impersonation and return to admin portal" placement="right">
            <button
              onClick={() => void handleEndImpersonation()}
              style={{
                marginTop: '10px',
                width: '100%',
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                color: 'var(--tx-hi)',
                padding: '6px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>{navIcons.endImpersonation}</span>
              {!navCollapsed && <span>End impersonation</span>}
            </button>
          </Tooltip>
        )}
        <Tooltip content={intl.formatMessage({ id: 'tooltip.nav.signOut' })} placement="right">
          <button
            onClick={() => void logout()}
            style={{
              marginTop: '10px',
              width: '100%',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--tx-md)',
              padding: '6px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--s2)';
              e.currentTarget.style.color = 'var(--tx-hi)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--tx-md)';
            }}
          >
            <span>{navIcons.signOut}</span>
            {!navCollapsed && <span>Sign out</span>}
          </button>
        </Tooltip>
      </div>
    </nav>
  );
};
