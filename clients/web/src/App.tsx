import { useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import { useAuth } from './auth/AuthContext';
import { AuthScreen } from './auth/AuthScreen';
import { Nav } from './components/Nav';
import { TaskBoard } from './components/TaskBoard';
import { TaskDetail } from './components/TaskDetail';
import { TaskForm } from './components/TaskForm';
import { CalendarView } from './components/CalendarView';
import { TimelineView } from './components/TimelineView';
import { MyTasksView } from './components/MyTasksView';
import { AllTasksView } from './components/AllTasksView';
import { AnalyticsView } from './components/AnalyticsView';
import { WorkflowsView } from './components/WorkflowsView';
import { DashboardView } from './components/DashboardView';
import { AccountView } from './components/AccountView';
import { canCreateOrEditTasks } from './auth/permissions';
import { apiClient } from './api/client';

function App() {
  const { isAuthenticated, user, mustChangePassword, clearMustChangePassword, logout } = useAuth();
  const [forcedPassword, setForcedPassword] = useState({ currentPassword: '', newPassword: '' });
  const [forcedPasswordError, setForcedPasswordError] = useState('');
  const [forcedPasswordSaving, setForcedPasswordSaving] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const {
    activeView,
    selectedTaskId,
    formMode,
    selectTask,
    openNewTaskForm,
    closeForm,
    submitTask,
    updateTask,
    setActiveView,
    loadTasks,
    loadProjects
  } = useStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    let isActive = true;

    const refreshFeatureFlags = async () => {
      try {
        const response = await apiClient.getFeatureFlags();
        if (!isActive) return;
        const map = (response?.items || []).reduce((acc: Record<string, boolean>, item: { key: string; enabled: boolean }) => {
          acc[item.key] = Boolean(item.enabled);
          return acc;
        }, {});
        setFeatureFlags(map);
      } catch {
        // Keep last known flags if refresh fails.
      }
    };

    const loadInitialData = async () => {
      await loadProjects();
      await loadTasks();
      await refreshFeatureFlags();
    };

    void loadInitialData();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, loadProjects, loadTasks]);

  const workflowsEnabled = useMemo(() => featureFlags.workflow_v2 !== false, [featureFlags]);
  const aiAssistEnabled = useMemo(() => featureFlags.ai_assist !== false, [featureFlags]);
  const betaReportsEnabled = useMemo(() => featureFlags.beta_reports !== false, [featureFlags]);

  const showDetailPanel =
    selectedTaskId !== null &&
    formMode === 'none';
  const showCentreForm = formMode !== 'none';
  const showDetailWhileEditing = false;

  const handleNewTask = () => {
    if (!canCreateOrEditTasks(user?.role)) return;
    openNewTaskForm();
  };

  const handleTaskSelect = (taskId: string) => {
    selectTask(taskId);
  };

  const handleFormSubmit = async (data: any) => {
    if (!canCreateOrEditTasks(user?.role)) return;
    if (formMode === 'edit-task' && selectedTaskId) {
      await updateTask(selectedTaskId, data);
    } else {
      await submitTask(data);
    }
    closeForm();
    // Transition to state D then A
  };

  const handleFormCancel = () => {
    closeForm();
  };

  useEffect(() => {
    if (!workflowsEnabled && activeView === 'workflows') {
      setActiveView('tasks');
      return;
    }
    if (!betaReportsEnabled && activeView === 'analytics') {
      setActiveView('tasks');
    }
  }, [activeView, betaReportsEnabled, setActiveView, workflowsEnabled]);

  const renderCentreContent = () => {
    if (showCentreForm) {
      // When editing, show form in a narrower center pane, detail panel on the right
      if (formMode === 'edit-task') {
        return (
          <TaskForm
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
            isEditing={true}
            aiAssistEnabled={aiAssistEnabled}
          />
        );
      }
      // When creating, full form
      return (
        <TaskForm
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          isEditing={false}
          aiAssistEnabled={aiAssistEnabled}
        />
      );
    }

    switch (activeView) {
      case 'dashboard':
        return <DashboardView onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} aiAssistEnabled={aiAssistEnabled} />;
      case 'tasks':
        return <TaskBoard onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} />;
      case 'all-tasks':
        if (user?.role === 'ADMIN' || user?.role === 'OWNER') {
          return <AllTasksView onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} />;
        }
        return <MyTasksView onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} />;
      case 'calendar':
        return <CalendarView onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} />;
      case 'timeline':
        return <TimelineView onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} />;
      case 'my-tasks':
        return <MyTasksView onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} />;
      case 'analytics':
        return betaReportsEnabled ? <AnalyticsView onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} /> : <TaskBoard onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} />;
      case 'workflows':
        return workflowsEnabled ? <WorkflowsView onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} /> : <TaskBoard onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} />;
      case 'account':
        return <AccountView />;
      default:
        return <TaskBoard onTaskSelect={handleTaskSelect} onNewTask={handleNewTask} />;
    }
  };

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const submitForcedPasswordChange = async () => {
    if (!forcedPassword.currentPassword.trim() || !forcedPassword.newPassword.trim()) {
      setForcedPasswordError('Current and new password are required.');
      return;
    }
    setForcedPasswordSaving(true);
    setForcedPasswordError('');
    try {
      await apiClient.changePassword({
        currentPassword: forcedPassword.currentPassword,
        newPassword: forcedPassword.newPassword,
      });
      setForcedPassword({ currentPassword: '', newPassword: '' });
      clearMustChangePassword();
    } catch (error: any) {
      setForcedPasswordError(error?.message || 'Failed to change password.');
    } finally {
      setForcedPasswordSaving(false);
    }
  };

  if (mustChangePassword) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Password Reset Required</h1>
          <p>Your admin has required a password reset before continuing.</p>
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitForcedPasswordChange();
            }}
          >
            <label>
              Current password
              <input
                type="password"
                value={forcedPassword.currentPassword}
                onChange={(event) => setForcedPassword({ ...forcedPassword, currentPassword: event.target.value })}
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={forcedPassword.newPassword}
                onChange={(event) => setForcedPassword({ ...forcedPassword, newPassword: event.target.value })}
                required
              />
            </label>
            {forcedPasswordError && <div className="auth-error">{forcedPasswordError}</div>}
            <button type="submit" disabled={forcedPasswordSaving}>
              {forcedPasswordSaving ? 'Saving...' : 'Change Password'}
            </button>
          </form>
          <div className="auth-actions">
            <button type="button" onClick={() => void logout()} className="link-button" disabled={forcedPasswordSaving}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${showDetailPanel ? 'detail-open' : ''} ${showDetailWhileEditing ? 'form-with-detail' : ''}`}>
      <Nav
        onViewChange={setActiveView}
        workflowsEnabled={workflowsEnabled}
        betaReportsEnabled={betaReportsEnabled}
      />
      <div className="centre-pane">
        {renderCentreContent()}
      </div>
      <div className="detail-panel">
        {showDetailPanel && <TaskDetail onClose={() => selectTask(null)} aiAssistEnabled={aiAssistEnabled} />}
      </div>
    </div>
  );
}

export default App;
