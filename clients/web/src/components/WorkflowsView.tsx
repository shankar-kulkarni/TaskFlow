import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useStore } from '../store';
import { apiClient } from '../api/client';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';

interface WorkflowsViewProps {
  onTaskSelect: (taskId: string) => void;
  onNewTask: () => void;
}

type UiAction = { actionOrder: number; actionType: string; actionConfig: Record<string, any> };
type UiWorkflow = {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  name: string;
  description?: string | null;
  triggerType: string;
  triggerConfig: Record<string, any>;
  actions: UiAction[];
  isActive: boolean;
};

const TRIGGER_OPTIONS = [
  'TASK_CREATED',
  'TASK_STATUS_CHANGED',
  'TASK_PRIORITY_CHANGED',
  'TASK_ASSIGNED',
  'TASK_DUE_DATE_APPROACHING',
  'TASK_OVERDUE',
];

const ACTION_OPTIONS = [
  'CHANGE_STATUS',
  'CHANGE_PRIORITY',
  'ASSIGN_USER',
  'ASSIGN_GROUP',
  'UNASSIGN_USER',
  'SET_DUE_DATE',
  'ADD_TAG',
  'POST_COMMENT',
];

const friendly = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const WorkflowsView = ({ onTaskSelect: _onTaskSelect, onNewTask: _onNewTask }: WorkflowsViewProps) => {
  const { activeProjectId, projects } = useStore();
  const intl = useIntl();
  const [workflows, setWorkflows] = useState<UiWorkflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTriggerType, setFormTriggerType] = useState('TASK_CREATED');
  const [formTriggerConfig, setFormTriggerConfig] = useState<Record<string, any>>({});
  const [formActions, setFormActions] = useState<UiAction[]>([{ actionOrder: 1, actionType: 'CHANGE_STATUS', actionConfig: { status: 'IN_PROGRESS' } }]);
  const [saving, setSaving] = useState(false);

  const selectedProject = activeProjectId ? projects[activeProjectId] : null;
  const title = selectedProject
    ? intl.formatMessage({ id: 'workflows.titleWithProject' }, { project: selectedProject.name })
    : intl.formatMessage({ id: 'workflows.title' });
  const subtitle = selectedProject
    ? intl.formatMessage({ id: 'workflows.subtitleWithProject' })
    : intl.formatMessage({ id: 'workflows.subtitle' });

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null,
    [selectedWorkflowId, workflows]
  );

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getWorkflows({
        project_id: activeProjectId || undefined,
      });
      const rows: UiWorkflow[] = Array.isArray(response)
        ? response.map((item: any) => ({
            id: item.id,
            workspaceId: item.workspaceId,
            projectId: item.projectId,
            name: item.name,
            description: item.description,
            triggerType: item.triggerType,
            triggerConfig: (item.triggerConfig ?? {}) as Record<string, any>,
            actions: Array.isArray(item.actions)
              ? item.actions
                  .sort((a: any, b: any) => a.actionOrder - b.actionOrder)
                  .map((action: any) => ({
                    actionOrder: action.actionOrder,
                    actionType: action.actionType,
                    actionConfig: action.actionConfig ?? {},
                  }))
              : [],
            isActive: item.isActive,
          }))
        : [];
      setWorkflows(rows);
      if (rows.length > 0) {
        setSelectedWorkflowId((prev) => (prev && rows.some((w) => w.id === prev) ? prev : rows[0].id));
      } else {
        setSelectedWorkflowId(null);
      }
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkflows();
  }, [activeProjectId]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormTriggerType('TASK_CREATED');
    setFormTriggerConfig({});
    setFormActions([{ actionOrder: 1, actionType: 'CHANGE_STATUS', actionConfig: { status: 'IN_PROGRESS' } }]);
    setIsEditing(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (workflow: UiWorkflow) => {
    setIsEditing(true);
    setFormName(workflow.name);
    setFormDescription(workflow.description || '');
    setFormTriggerType(workflow.triggerType);
    setFormTriggerConfig(workflow.triggerConfig || {});
    setFormActions(
      workflow.actions.length > 0
        ? workflow.actions
        : [{ actionOrder: 1, actionType: 'CHANGE_STATUS', actionConfig: { status: 'IN_PROGRESS' } }]
    );
    setShowForm(true);
  };

  const saveWorkflow = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const workspaceId =
        selectedWorkflow?.workspaceId ||
        selectedProject?.workspaceId ||
        Object.values(projects)[0]?.workspaceId;

      if (isEditing && selectedWorkflow) {
        await apiClient.updateWorkflow(selectedWorkflow.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          triggerType: formTriggerType,
          triggerConfig: formTriggerConfig,
          projectId: activeProjectId || selectedWorkflow.projectId || null,
          actions: formActions,
        });
      } else {
        await apiClient.createWorkflow({
          workspace_id: workspaceId,
          project_id: activeProjectId || undefined,
          name: formName.trim(),
          description: formDescription.trim(),
          trigger_type: formTriggerType,
          trigger_config: formTriggerConfig,
          actions: formActions.map((action, index) => ({
            action_order: index + 1,
            action_type: action.actionType,
            action_config: action.actionConfig ?? {},
          })),
        });
      }

      setShowForm(false);
      resetForm();
      await loadWorkflows();
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkflow = async (workflow: UiWorkflow) => {
    try {
      await apiClient.toggleWorkflow(workflow.id);
      await loadWorkflows();
    } catch (toggleError: any) {
      setError(toggleError?.message || 'Failed to toggle workflow');
    }
  };

  const deleteWorkflow = async (workflow: UiWorkflow) => {
    if (!confirm(`Delete workflow "${workflow.name}"?`)) return;
    try {
      await apiClient.deleteWorkflow(workflow.id);
      await loadWorkflows();
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Failed to delete workflow');
    }
  };

  const updateActionType = (index: number, nextType: string) => {
    setFormActions((prev) =>
      prev.map((action, currentIndex) =>
        currentIndex === index ? { ...action, actionType: nextType, actionConfig: {} } : action
      )
    );
  };

  const updateActionConfig = (index: number, key: string, value: any) => {
    setFormActions((prev) =>
      prev.map((action, currentIndex) =>
        currentIndex === index
          ? { ...action, actionConfig: { ...(action.actionConfig ?? {}), [key]: value } }
          : action
      )
    );
  };

  const renderActionConfigEditor = (action: UiAction, index: number) => {
    switch (action.actionType) {
      case 'CHANGE_STATUS':
        return (
          <select value={action.actionConfig.status || ''} onChange={(event) => updateActionConfig(index, 'status', event.target.value)}>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="DONE">DONE</option>
          </select>
        );
      case 'CHANGE_PRIORITY':
        return (
          <select value={action.actionConfig.priority || ''} onChange={(event) => updateActionConfig(index, 'priority', event.target.value)}>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        );
      case 'ASSIGN_USER':
      case 'UNASSIGN_USER':
        return <input value={action.actionConfig.userId || ''} onChange={(event) => updateActionConfig(index, 'userId', event.target.value)} placeholder="user id" />;
      case 'ASSIGN_GROUP':
        return <input value={action.actionConfig.groupId || ''} onChange={(event) => updateActionConfig(index, 'groupId', event.target.value)} placeholder="group id" />;
      case 'SET_DUE_DATE':
        return <input type="number" value={action.actionConfig.daysFromNow || 0} onChange={(event) => updateActionConfig(index, 'daysFromNow', Number(event.target.value))} placeholder="days from now" />;
      case 'ADD_TAG':
        return <input value={action.actionConfig.tag || ''} onChange={(event) => updateActionConfig(index, 'tag', event.target.value)} placeholder="tag name" />;
      case 'POST_COMMENT':
        return <input value={action.actionConfig.comment || ''} onChange={(event) => updateActionConfig(index, 'comment', event.target.value)} placeholder="comment text" />;
      default:
        return null;
    }
  };

  return (
    <div className="main">
      <div className="ph">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ph-title">{title}</h1>
            <HelpSection titleId="help.workflows.title" items={["help.workflows.item1", "help.workflows.item2", "help.workflows.item3"]} />
          </div>
          <p className="ph-sub">{subtitle}</p>
        </div>
        <div className="ph-actions">
          <Tooltip content={intl.formatMessage({ id: 'tooltip.workflows.newWorkflow' })} className="tooltip-near">
            <button className="btn btn-ghost" onClick={openCreate}>{intl.formatMessage({ id: 'workflows.newWorkflow' })}</button>
          </Tooltip>
        </div>
      </div>

      {error && <div className="status-error" style={{ margin: '0 28px 10px' }}>{error}</div>}

      <div style={{ padding: '20px 28px 28px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px' }}>
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px' }}>
          {loading ? (
            <div style={{ color: 'var(--tx-lo)' }}>Loading workflows...</div>
          ) : workflows.length === 0 ? (
            <div style={{ color: 'var(--tx-lo)' }}>No workflows configured yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                  style={{
                    border: `1px solid ${selectedWorkflowId === workflow.id ? 'var(--blue)' : 'var(--border)'}`,
                    borderRadius: '10px',
                    padding: '10px',
                    cursor: 'pointer',
                    background: selectedWorkflowId === workflow.id ? 'var(--blue-dim)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: 'var(--tx-hi)' }}>{workflow.name}</strong>
                    <span className="chip" style={{ background: workflow.isActive ? 'var(--lime-dim)' : 'var(--s2)', color: workflow.isActive ? 'var(--lime)' : 'var(--tx-lo)' }}>
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--tx-md)', marginTop: '4px' }}>{workflow.description || '-'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tx-lo)', marginTop: '6px' }}>
                    Trigger: {friendly(workflow.triggerType)} | Actions: {workflow.actions.length}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px' }}>
          {selectedWorkflow ? (
            <>
              <h3 style={{ margin: 0, color: 'var(--tx-hi)' }}>{selectedWorkflow.name}</h3>
              <p style={{ color: 'var(--tx-md)', marginTop: '6px' }}>{selectedWorkflow.description || '-'}</p>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--tx-lo)' }}>
                <div>Trigger: <strong style={{ color: 'var(--tx-hi)' }}>{friendly(selectedWorkflow.triggerType)}</strong></div>
                <div style={{ marginTop: '6px' }}>Trigger Config: {JSON.stringify(selectedWorkflow.triggerConfig || {})}</div>
              </div>
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-hi)' }}>Actions</div>
                <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                  {selectedWorkflow.actions.map((action) => (
                    <div key={`${action.actionOrder}-${action.actionType}`} style={{ fontSize: '12px', color: 'var(--tx-md)', background: 'var(--s2)', borderRadius: '8px', padding: '6px 8px' }}>
                      {action.actionOrder}. {friendly(action.actionType)} {JSON.stringify(action.actionConfig || {})}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost" onClick={() => toggleWorkflow(selectedWorkflow)}>
                  {selectedWorkflow.isActive ? 'Disable' : 'Enable'}
                </button>
                <button className="btn btn-ghost" onClick={() => openEdit(selectedWorkflow)}>Edit</button>
                <button className="btn btn-ghost" style={{ color: 'var(--rose)' }} onClick={() => void deleteWorkflow(selectedWorkflow)}>Delete</button>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--tx-lo)' }}>Select a workflow to inspect or edit.</div>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', zIndex: 1200 }}>
          <div style={{ width: '720px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--tx-hi)' }}>{isEditing ? 'Edit Workflow' : 'Create Workflow'}</h3>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Workflow name" />
              <textarea value={formDescription} onChange={(event) => setFormDescription(event.target.value)} placeholder="Description" rows={3} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <select value={formTriggerType} onChange={(event) => setFormTriggerType(event.target.value)}>
                  {TRIGGER_OPTIONS.map((trigger) => <option key={trigger} value={trigger}>{friendly(trigger)}</option>)}
                </select>
                <input
                  value={formTriggerConfig?.status || ''}
                  onChange={(event) => setFormTriggerConfig((prev) => ({ ...prev, status: event.target.value }))}
                  placeholder="Trigger status (optional)"
                />
              </div>

              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-hi)' }}>Actions</div>
              {formActions.map((action, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '190px 1fr auto', gap: '8px', alignItems: 'center' }}>
                  <select value={action.actionType} onChange={(event) => updateActionType(index, event.target.value)}>
                    {ACTION_OPTIONS.map((actionOption) => <option key={actionOption} value={actionOption}>{friendly(actionOption)}</option>)}
                  </select>
                  {renderActionConfigEditor(action, index)}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setFormActions((prev) => prev.filter((_, currentIndex) => currentIndex !== index).map((item, i) => ({ ...item, actionOrder: i + 1 })))}
                    disabled={formActions.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setFormActions((prev) => [...prev, { actionOrder: prev.length + 1, actionType: 'CHANGE_STATUS', actionConfig: { status: 'IN_PROGRESS' } }])
                }
              >
                + Add Action
              </button>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => void saveWorkflow()} disabled={saving || !formName.trim()}>
                {saving ? 'Saving...' : (isEditing ? 'Save' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

