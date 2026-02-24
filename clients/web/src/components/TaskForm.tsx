import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { apiClient } from '../api/client';
import { useIntl } from 'react-intl';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';
import { getTodayIsoInTenantTimezone } from '../utils/tenantDate';

interface TaskFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isEditing?: boolean;
  aiAssistEnabled?: boolean;
  initialData?: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    project_id: string;
    start_date: string;
    due_date: string;
    estimated_hrs: number;
    user_ids: string[];
    group_ids: string[];
    tags: string[];
    watcher_ids: string[];
  }>;
}

export const TaskForm = ({ onSubmit, onCancel, isEditing = false, aiAssistEnabled = true, initialData }: TaskFormProps) => {
  const { projects, formDefaults, activeProjectId } = useStore();
  const intl = useIntl();
  const isEditMode = isEditing;
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'LOW',
    start_date: '',
    due_date: '',
    estimated_hrs: '',
    user_ids: [] as string[],
    group_ids: [] as string[],
    tags: [] as string[],
    watcher_ids: [] as string[]
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; displayName: string; email: string; role: string }>>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);

  const normalizeDateInput = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  };

  // Initialize project selection based on active project or form defaults
  useEffect(() => {
    if (isEditing && formDefaults?.project_id) {
      setSelectedProjectId(formDefaults.project_id);
    } else if (activeProjectId) {
      setSelectedProjectId(activeProjectId);
    } else {
      const projectIds = Object.keys(projects);
      if (projectIds.length > 0) {
        setSelectedProjectId(projectIds[0]);
      }
    }
  }, [activeProjectId, formDefaults, isEditing, projects]);

  // Initialize form data from initialData or formDefaults
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        status: initialData.status || 'TODO',
        priority: initialData.priority || 'MEDIUM',
        start_date: normalizeDateInput(initialData.start_date),
        due_date: normalizeDateInput(initialData.due_date),
        estimated_hrs: initialData.estimated_hrs?.toString() || '',
        user_ids: initialData.user_ids || [],
        group_ids: initialData.group_ids || [],
        tags: initialData.tags || [],
        watcher_ids: initialData.watcher_ids || []
      });
      if (initialData.project_id) {
        setSelectedProjectId(initialData.project_id);
      }
    } else if (isEditing && formDefaults) {
      setFormData({
        title: formDefaults.title || '',
        description: formDefaults.description || '',
        status: formDefaults.status || 'TODO',
        priority: formDefaults.priority || 'MEDIUM',
        start_date: normalizeDateInput(formDefaults.start_date),
        due_date: normalizeDateInput(formDefaults.due_date),
        estimated_hrs: formDefaults.estimated_hrs?.toString() || '',
        user_ids: formDefaults.user_ids || [],
        group_ids: formDefaults.group_ids || [],
        tags: formDefaults.tags || [],
        watcher_ids: formDefaults.watcher_ids || []
      });
      if (formDefaults.project_id) {
        setSelectedProjectId(formDefaults.project_id);
      }
    }
  }, [initialData, isEditing, formDefaults]);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const [usersData, groupsData] = await Promise.all([
          apiClient.getUsers(),
          apiClient.getGroups()
        ]);
        setUsers(usersData || []);
        const groupList = (groupsData?.groups || groupsData || []).map((group: any) => ({
          id: group.id,
          name: group.name
        }));
        setGroups(groupList);
      } catch (error) {
        console.error('Failed to load assignment data', error);
      }
    };

    void loadAssignments();
  }, []);

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!selectedProjectId) {
      newErrors.project = 'Project is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const submitData = {
        ...formData,
        project_id: selectedProjectId,
        start_date: formData.start_date || null,
        due_date: formData.due_date || null,
        estimated_hrs: formData.estimated_hrs ? parseFloat(formData.estimated_hrs) : null
      };

      await onSubmit(submitData);
    } catch (error: any) {
      console.error('Form submission error:', error);
      const errorMsg = error?.message || 'Failed to save task. Please try again.';
      setErrors({ submit: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCharCount = (input: HTMLInputElement) => {
    const count = input.value.length;
    const max = 500;
    const charCountEl = input.parentElement?.querySelector('.char-count') as HTMLElement;
    if (charCountEl) {
      charCountEl.textContent = `${count} / ${max}`;
      charCountEl.classList.toggle('warn', count > max * 0.8);
      charCountEl.classList.toggle('limit', count > max);
    }
  };

  const handleAiFill = async () => {
    if (!aiPrompt.trim()) {
      setAiError('Enter a short task description first.');
      return;
    }

    setAiError('');
    setAiLoading(true);

    try {
      const prompt = aiPrompt.trim();
      const loweredPrompt = prompt.toLowerCase();
      const normalizeStatus = (value?: string | null) => {
        if (!value) return '';
        const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');
        if (['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'].includes(normalized)) {
          return normalized;
        }
        return '';
      };
      const normalizePriority = (value?: string | null) => {
        if (!value) return '';
        const normalized = value.trim().toUpperCase();
        if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(normalized)) {
          return normalized;
        }
        return '';
      };
      const inferStatusFromPrompt = () => {
        if (/\bblocked|waiting|dependency\b/.test(loweredPrompt)) return 'BLOCKED';
        if (/\breview|qa|verify\b/.test(loweredPrompt)) return 'IN_REVIEW';
        if (/\bin progress|working|wip\b/.test(loweredPrompt)) return 'IN_PROGRESS';
        if (/\bdone|complete|completed\b/.test(loweredPrompt)) return 'DONE';
        return '';
      };
      const inferPriorityFromPrompt = () => {
        if (/\bcritical|p0|sev1|urgent\b/.test(loweredPrompt)) return 'CRITICAL';
        if (/\bhigh|asap|important\b/.test(loweredPrompt)) return 'HIGH';
        if (/\blow|minor|later\b/.test(loweredPrompt)) return 'LOW';
        if (/\bmedium|normal\b/.test(loweredPrompt)) return 'MEDIUM';
        return '';
      };
      const inferDateFromPrompt = (type: 'due' | 'start') => {
        const todayIso = getTodayIsoInTenantTimezone();
        const toISO = (date: Date) => date.toISOString().slice(0, 10);
        const exact = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/);
        if (exact) return exact[1];
        if (/\btoday\b/.test(loweredPrompt)) {
          return todayIso;
        }
        if (type === 'due' && /\btom(?:o)?rrow\b/.test(loweredPrompt)) {
          const date = new Date(`${todayIso}T00:00:00.000Z`);
          date.setUTCDate(date.getUTCDate() + 1);
          return toISO(date);
        }
        const inDays = loweredPrompt.match(/\bin\s+(\d+)\s+days?\b/);
        if (inDays) {
          const date = new Date(`${todayIso}T00:00:00.000Z`);
          date.setUTCDate(date.getUTCDate() + Number(inDays[1]));
          return toISO(date);
        }
        return '';
      };
      const inferEstimateFromPrompt = () => {
        const hourMatch = loweredPrompt.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
        if (hourMatch) return hourMatch[1];
        const dayMatch = loweredPrompt.match(/(\d+(?:\.\d+)?)\s*(d|day|days)\b/);
        if (dayMatch) {
          const scheduleContext = /\b(due|by|on|before|after|start(?:ing)?|in)\b/.test(loweredPrompt);
          const estimateContext = /\b(estimate|estimated|est|effort|takes?|spend|duration|work)\b/.test(loweredPrompt);
          if (estimateContext && !scheduleContext) {
            return String(Number(dayMatch[1]) * 8);
          }
        }
        return '';
      };
      const inferProjectFromPrompt = () => {
        const match = Object.values(projects).find((project) => loweredPrompt.includes(project.name.toLowerCase()));
        return match?.id || '';
      };
      const inferAssigneesFromPrompt = () => {
        const ids = users
          .filter((user) => {
            const name = user.displayName?.toLowerCase().trim();
            const emailLocal = user.email?.split('@')[0]?.toLowerCase();
            return (name && loweredPrompt.includes(name)) || (emailLocal && loweredPrompt.includes(emailLocal));
          })
          .map((user) => user.id);
        return Array.from(new Set(ids));
      };
      const inferTagsFromPrompt = () => {
        const tagMatch = prompt.match(/tags?\s*:\s*([^\n]+)/i);
        if (!tagMatch) return [];
        return tagMatch[1].split(',').map((tag) => tag.trim()).filter(Boolean);
      };

      const response = await apiClient.aiTaskCreateLite({ description: aiPrompt.trim() });
      const parseStructuredText = (raw: string) => {
        const result: Record<string, any> = {};
        raw.split('\n').forEach((line) => {
          const [key, ...rest] = line.split(':');
          if (!key || rest.length === 0) return;
          result[key.trim().toLowerCase()] = rest.join(':').trim();
        });
        return result;
      };
      const normalizeEstimatedHours = (value?: number | string | null) => {
        if (value === null || value === undefined || value === '') return '';
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) return '';
        return parsed.toString();
      };

      const responseData = response?.data;
      const extractionMode = typeof response?.mode === 'string' ? response.mode : '';
      if (extractionMode && extractionMode === 'heuristic') {
        setAiError('LLM extraction is unavailable. Configure AI gateway Llama/Ollama settings.');
        return;
      }
      const textFallback = typeof response === 'string'
        ? response
        : (typeof responseData === 'string' ? responseData : '');
      const parsedText = textFallback ? parseStructuredText(textFallback) : {};
      const data = typeof responseData === 'object' && responseData !== null
        ? responseData
        : parsedText;

      if (!data) {
        setAiError('AI did not return task data.');
        return;
      }

      const nextStatus = normalizeStatus(data.status || parsedText.status) || inferStatusFromPrompt();
      const nextPriority = normalizePriority(data.priority || parsedText.priority) || inferPriorityFromPrompt();
      const nextDueDate = normalizeDateInput(
        data.dueDate || data.due_date || parsedText.due || parsedText.due_date || parsedText.dueDate
      ) || inferDateFromPrompt('due');
      const nextStartDate = normalizeDateInput(
        data.startDate || data.start_date || parsedText.start || parsedText.start_date || parsedText.startDate
      ) || inferDateFromPrompt('start');
      const nextEstimate = normalizeEstimatedHours(
        data.estimatedHrs || data.estimated_hrs || parsedText.estimated || parsedText.estimate || parsedText.hours
      ) || inferEstimateFromPrompt();
      const nextTags = Array.isArray(data.tags)
        ? data.tags
        : typeof parsedText.tags === 'string'
          ? parsedText.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
          : inferTagsFromPrompt();
      const nextTitle = typeof data.title === 'string' && data.title.trim().length > 0
        ? data.title.trim()
        : '';
      const nextDescription = typeof data.description === 'string' && data.description.trim().length > 0
        ? data.description.trim()
        : '';
      const aiAssigneeIds = Array.isArray(data.assignee)
        ? data.assignee
            .map((entry: any) => {
              if (typeof entry !== 'string') return '';
              const raw = entry.toLowerCase().trim();
              const byId = users.find((user) => user.id.toLowerCase() === raw);
              if (byId) return byId.id;
              const byName = users.find((user) => user.displayName?.toLowerCase() === raw);
              return byName?.id || '';
            })
            .filter((id: string) => id.length > 0)
        : (typeof data.assigneeId === 'string' && data.assigneeId ? [data.assigneeId] : []);
      const promptAssigneeIds = inferAssigneesFromPrompt();
      const nextAssigneeIds = aiAssigneeIds.length > 0 ? aiAssigneeIds : promptAssigneeIds;
      const inferredProjectId = inferProjectFromPrompt();
      const nextProjectId = (() => {
        if (typeof data.project === 'string' && data.project.trim().length > 0) {
          const norm = data.project.toLowerCase().trim();
          const byName = Object.values(projects).find((project) => project.name.toLowerCase() === norm);
          if (byName?.id) return byName.id;
          const fuzzy = Object.values(projects).find((project) => project.name.toLowerCase().includes(norm) || norm.includes(project.name.toLowerCase()));
          if (fuzzy?.id) return fuzzy.id;
        }
        return data.projectId || data.project_id || inferredProjectId;
      })();
      const aiGroupIds = Array.isArray(data.group)
        ? data.group
            .map((entry: any) => {
              if (typeof entry !== 'string') return '';
              const raw = entry.toLowerCase().trim();
              const byId = groups.find((group) => group.id.toLowerCase() === raw);
              if (byId) return byId.id;
              const byName = groups.find((group) => group.name.toLowerCase() === raw);
              if (byName) return byName.id;
              const fuzzy = groups.find((group) => group.name.toLowerCase().includes(raw) || raw.includes(group.name.toLowerCase()));
              return fuzzy?.id || '';
            })
            .filter((id: string) => id.length > 0)
        : Array.isArray(data.groupIds)
          ? data.groupIds
          : Array.isArray(data.group_ids)
            ? data.group_ids
            : [];
      const normalizedAiGroupIds = Array.from(new Set(aiGroupIds));
      const legacyAiGroupIds = Array.isArray(data.groupIds)
        ? data.groupIds
        : Array.isArray(data.group_ids)
          ? data.group_ids
          : [];
      const mergedGroupIds = normalizedAiGroupIds.length > 0 ? normalizedAiGroupIds : legacyAiGroupIds;

      setFormData((prev) => ({
        ...prev,
        title: nextTitle ? nextTitle : prev.title,
        description: nextDescription ? nextDescription : prev.description,
        status: nextStatus || prev.status,
        priority: nextPriority || (isEditMode ? prev.priority : 'LOW'),
        start_date: nextStartDate || prev.start_date,
        due_date: nextDueDate || prev.due_date,
        estimated_hrs: nextEstimate || (isEditMode ? prev.estimated_hrs : '1'),
        user_ids: nextAssigneeIds.length > 0 ? nextAssigneeIds : prev.user_ids,
        group_ids: mergedGroupIds.length > 0 ? mergedGroupIds : prev.group_ids,
        tags: nextTags.length > 0 ? nextTags : prev.tags,
      }));

      if (nextProjectId) {
        setSelectedProjectId(nextProjectId);
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Failed to auto-fill fields');
    } finally {
      setAiLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      user_ids: prev.user_ids.includes(userId)
        ? prev.user_ids.filter(id => id !== userId)
        : [...prev.user_ids, userId]
    }));
  };

  const toggleGroup = (groupId: string) => {
    setFormData(prev => ({
      ...prev,
      group_ids: prev.group_ids.includes(groupId)
        ? prev.group_ids.filter(id => id !== groupId)
        : [...prev.group_ids, groupId]
    }));
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'var(--bg)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Bar */}
      <div style={{
        height: '52px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              color: 'var(--tx-md)',
              fontSize: '12.5px',
              cursor: 'pointer',
              padding: '5px 10px',
              borderRadius: '7px',
              border: '1px solid transparent',
              background: 'transparent',
              transition: 'all 180ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--s2)';
              e.currentTarget.style.color = 'var(--tx-hi)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--tx-md)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.back' })}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
              </span>
            </Tooltip>
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--tx-hi)' }}>
              {isEditMode ? 'Edit Task' : 'Create Task'}
            </span>
            <HelpSection
              titleId="help.taskForm.title"
              items={["help.taskForm.item1", "help.taskForm.item2", "help.taskForm.item3"]}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {errors.submit && (
            <span style={{ fontSize: '12px', color: 'var(--rose)' }}>{errors.submit}</span>
          )}
          <Tooltip content={intl.formatMessage({ id: 'tooltip.common.cancel' })}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: 'transparent',
                color: 'var(--tx-md)',
                border: '1px solid var(--border)',
                fontFamily: "'Geist', sans-serif",
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 180ms ease'
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
              Cancel
            </button>
          </Tooltip>
          <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.submit' })}>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: isSubmitting ? 'rgba(200, 240, 96, 0.5)' : 'var(--lime)',
                color: '#0a0a0c',
                border: 'none',
                fontFamily: "'Geist', sans-serif",
                fontSize: '13px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 180ms ease',
                transform: 'translateY(0)',
                opacity: isSubmitting ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Task'}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', padding: '32px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {aiAssistEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--s1)' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--tx-md)' }}>🤖 AI Task Assist</label>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Describe task in plain language; AI fills title, status, priority, project, assignee"
              style={{
                width: '100%',
                minHeight: '72px',
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: 'var(--tx-hi)',
                fontFamily: "'Geist', sans-serif",
                fontSize: '13px',
                resize: 'vertical',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => void handleAiFill()}
                disabled={aiLoading}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: aiLoading ? 'var(--s3)' : 'var(--blue)',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: aiLoading ? 'not-allowed' : 'pointer',
                  opacity: aiLoading ? 0.7 : 1
                }}
              >
                {aiLoading ? 'Filling...' : 'Fill with AI'}
              </button>
              {aiError ? <span style={{ fontSize: '11px', color: 'var(--rose)' }}>{aiError}</span> : null}
            </div>
          </div>
          )}

          {/* Project Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '24px' }}>
            <label style={{
              fontSize: '11.5px',
              fontWeight: '500',
              color: 'var(--tx-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              Project <span style={{ color: 'var(--rose)', fontSize: '13px', lineHeight: 1 }}>•</span>
            </label>
            <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.project' })} className="tooltip-block" placement="right">
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  if (errors.project) setErrors(prev => ({ ...prev, project: '' }));
                }}
                style={{
                  width: '100%',
                  background: 'var(--s2)',
                  border: `1px solid ${errors.project ? 'var(--rose)' : 'var(--border)'}`,
                  borderRadius: '10px',
                  padding: '9px 13px',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: '13px',
                  color: 'var(--tx-hi)',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 180ms ease'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--blue)'}
                onBlur={(e) => e.currentTarget.style.borderColor = errors.project ? 'var(--rose)' : 'var(--border)'}
              >
                <option value="">Select a project</option>
                {Object.values(projects).map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Tooltip>
            {errors.project && (
              <span style={{ fontSize: '11px', color: 'var(--rose)' }}>{errors.project}</span>
            )}
          </div>

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '24px' }}>
            <label style={{
              fontSize: '11.5px',
              fontWeight: '500',
              color: 'var(--tx-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              Title <span style={{ color: 'var(--rose)', fontSize: '13px', lineHeight: 1 }}>•</span>
            </label>
            <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.title' })} className="tooltip-block" placement="right">
              <input
                type="text"
                value={formData.title}
                onChange={(e) => {
                  updateFormData('title', e.target.value);
                  updateCharCount(e.target);
                }}
                placeholder="What needs to be done?"
                maxLength={500}
                style={{
                  width: '100%',
                  background: 'var(--s1)',
                  border: `1px solid ${errors.title ? 'var(--rose)' : 'var(--border)'}`,
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: '16px',
                  fontWeight: '500',
                  color: 'var(--tx-hi)',
                  outline: 'none',
                  transition: 'all 180ms ease',
                  lineHeight: '1.5',
                  boxShadow: errors.title ? '0 0 0 3px rgba(255, 94, 122, 0.1)' : 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--lime)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200, 240, 96, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.title ? 'var(--rose)' : 'var(--border)';
                  e.currentTarget.style.boxShadow = errors.title ? '0 0 0 3px rgba(255, 94, 122, 0.1)' : 'none';
                }}
              />
            </Tooltip>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{
                fontSize: '11px',
                color: 'var(--rose)',
                display: errors.title ? 'flex' : 'none',
                alignItems: 'center',
                gap: '4px'
              }}>
                {errors.title}
              </span>
              <span className="char-count" style={{
                fontSize: '10.5px',
                fontFamily: "'Geist Mono', monospace",
                color: 'var(--tx-lo)',
                transition: 'color 180ms ease',
                marginLeft: 'auto'
              }}>
                {formData.title.length} / 500
              </span>
            </div>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '24px' }}>
            <label style={{
              fontSize: '11.5px',
              fontWeight: '500',
              color: 'var(--tx-md)'
            }}>
              Description
            </label>
            <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.description' })} className="tooltip-block" placement="right">
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder="Add context, acceptance criteria, links, or any other details…"
                rows={4}
                style={{
                  width: '100%',
                  background: 'var(--s2)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontFamily: "'Geist', sans-serif",
                  fontSize: '14px',
                  color: 'var(--tx-hi)',
                  outline: 'none',
                  transition: 'all 180ms ease',
                  resize: 'vertical',
                  minHeight: '100px',
                  lineHeight: '1.5'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--blue)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </Tooltip>
          </div>

          {/* Status and Priority in a row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: '500', color: 'var(--tx-md)' }}>
                Status
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'TODO', label: 'Todo', color: '#6b7280' },
                  { key: 'IN_PROGRESS', label: 'In Progress', color: 'var(--blue)' },
                  { key: 'IN_REVIEW', label: 'In Review', color: 'var(--amber)' },
                  { key: 'BLOCKED', label: 'Blocked', color: 'var(--rose)' },
                  { key: 'DONE', label: 'Done', color: 'var(--teal)' }
                ].map(status => (
                  <Tooltip key={status.key} content={intl.formatMessage({ id: 'tooltip.taskForm.status' })}>
                    <button
                      type="button"
                      onClick={() => updateFormData('status', status.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 13px',
                        borderRadius: '20px',
                        border: '1.5px solid var(--border)',
                        background: formData.status === status.key ? (
                          status.key === 'TODO' ? 'var(--s3)' :
                          status.key === 'IN_PROGRESS' ? 'rgba(79, 142, 255, 0.1)' :
                          status.key === 'IN_REVIEW' ? 'rgba(255, 184, 77, 0.1)' :
                          status.key === 'BLOCKED' ? 'rgba(255, 79, 122, 0.12)' :
                          'rgba(63, 221, 199, 0.1)'
                        ) : 'var(--s2)',
                        borderColor: formData.status === status.key ? (
                          status.key === 'TODO' ? 'var(--border2)' :
                          status.key === 'IN_PROGRESS' ? 'rgba(79, 142, 255, 0.35)' :
                          status.key === 'IN_REVIEW' ? 'rgba(255, 184, 77, 0.35)' :
                          status.key === 'BLOCKED' ? 'rgba(255, 79, 122, 0.35)' :
                          'rgba(63, 221, 199, 0.35)'
                        ) : 'var(--border)',
                        color: formData.status === status.key ? (
                          status.key === 'TODO' ? 'var(--tx-md)' :
                          status.key === 'IN_PROGRESS' ? 'var(--blue)' :
                          status.key === 'IN_REVIEW' ? 'var(--amber)' :
                          status.key === 'BLOCKED' ? 'var(--rose)' :
                          'var(--teal)'
                        ) : 'var(--tx-lo)',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 180ms ease'
                      }}
                    >
                      <span style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: status.color,
                        flexShrink: 0
                      }}></span>
                      {status.label}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: '500', color: 'var(--tx-md)' }}>
                Priority
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { key: 'CRITICAL', label: 'Critical', icon: '🔴' },
                  { key: 'HIGH', label: 'High', icon: '🟠' },
                  { key: 'MEDIUM', label: 'Medium', icon: '🔵' },
                  { key: 'LOW', label: 'Low', icon: '⚪' }
                ].map(priority => (
                  <Tooltip key={priority.key} content={intl.formatMessage({ id: 'tooltip.taskForm.priority' })}>
                    <button
                      type="button"
                      onClick={() => updateFormData('priority', priority.key)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--border)',
                        background: 'var(--s2)',
                        cursor: 'pointer',
                        fontFamily: "'Geist', sans-serif",
                        fontSize: '11px',
                        fontWeight: '500',
                        textAlign: 'center',
                        transition: 'all 180ms ease',
                        color: 'var(--tx-lo)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '3px',
                        transform: formData.priority === priority.key ? 'translateY(-1px)' : 'none'
                      }}
                      className={formData.priority === priority.key ? (
                        priority.key === 'CRITICAL' ? 'sel-c' :
                        priority.key === 'HIGH' ? 'sel-h' :
                        priority.key === 'MEDIUM' ? 'sel-m' : 'sel-l'
                      ) : ''}
                    >
                      <span style={{ fontSize: '14px', lineHeight: 1 }}>{priority.icon}</span>
                      {priority.label}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>

          {/* Scheduling Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-lo)', textTransform: 'uppercase', margin: '0 0 8px 0', letterSpacing: '0.07em' }}>
              Scheduling
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {/* Start Date */}
              <div style={{
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 14px'
              }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--tx-lo)',
                  marginBottom: '8px'
                }}>
                  Start Date
                </div>
                <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.startDate' })} className="tooltip-block" placement="right">
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => updateFormData('start_date', e.target.value)}
                    style={{
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      fontFamily: "'Geist', sans-serif",
                      fontSize: '14px',
                      color: 'var(--tx-hi)',
                      width: '100%',
                      cursor: 'pointer'
                    }}
                  />
                </Tooltip>
              </div>

              {/* Due Date */}
              <div style={{
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 14px'
              }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--tx-lo)',
                  marginBottom: '8px'
                }}>
                  Due Date
                </div>
                <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.dueDate' })} className="tooltip-block" placement="right">
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => updateFormData('due_date', e.target.value)}
                    style={{
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      fontFamily: "'Geist', sans-serif",
                      fontSize: '14px',
                      color: 'var(--tx-hi)',
                      width: '100%',
                      cursor: 'pointer'
                    }}
                  />
                </Tooltip>
              </div>

              {/* Estimated Hours */}
              <div style={{
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 14px'
              }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--tx-lo)',
                  marginBottom: '8px'
                }}>
                  Est. Hours
                </div>
                <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.estimated' })} className="tooltip-block" placement="right">
                  <input
                    type="number"
                    value={formData.estimated_hrs}
                    onChange={(e) => updateFormData('estimated_hrs', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.5"
                    style={{
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      fontFamily: "'Geist', sans-serif",
                      fontSize: '14px',
                      color: 'var(--tx-hi)',
                      width: '100%'
                    }}
                  />
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Assignment Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-lo)', textTransform: 'uppercase', margin: '0 0 8px 0', letterSpacing: '0.07em' }}>
              Assignments
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 14px'
              }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--tx-lo)',
                  marginBottom: '8px'
                }}>
                  Users
                </div>
                <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.users' })} className="tooltip-block" placement="right">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflow: 'auto' }}>
                    {users.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--tx-lo)' }}>No users available</span>
                    ) : (
                      users.map(user => (
                        <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--tx-hi)' }}>
                          <input
                            type="checkbox"
                            checked={formData.user_ids.includes(user.id)}
                            onChange={() => toggleUser(user.id)}
                            style={{ accentColor: 'var(--lime)' }}
                          />
                          <span style={{ fontWeight: '500' }}>{user.displayName || user.email}</span>
                          <span style={{ color: 'var(--tx-lo)', fontSize: '11px' }}>{user.role}</span>
                        </label>
                      ))
                    )}
                  </div>
                </Tooltip>
              </div>

              <div style={{
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 14px'
              }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--tx-lo)',
                  marginBottom: '8px'
                }}>
                  Groups
                </div>
                <Tooltip content={intl.formatMessage({ id: 'tooltip.taskForm.groups' })} className="tooltip-block" placement="right">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflow: 'auto' }}>
                    {groups.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--tx-lo)' }}>No groups available</span>
                    ) : (
                      groups.map(group => (
                        <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--tx-hi)' }}>
                          <input
                            type="checkbox"
                            checked={formData.group_ids.includes(group.id)}
                            onChange={() => toggleGroup(group.id)}
                            style={{ accentColor: 'var(--lime)' }}
                          />
                          <span style={{ fontWeight: '500' }}>{group.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </form>

      <style>
        {`
          .char-count.warn { color: var(--amber); }
          .char-count.limit { color: var(--rose); }

          .sel-c { background: rgba(255,94,122,.1) !important; border-color: rgba(255,94,122,.4) !important; color: var(--rose) !important; }
          .sel-h { background: rgba(255,184,77,.1) !important; border-color: rgba(255,184,77,.4) !important; color: var(--amber) !important; }
          .sel-m { background: rgba(79,142,255,.1) !important; border-color: rgba(79,142,255,.4) !important; color: var(--blue) !important; }
          .sel-l { background: var(--s3) !important; border-color: var(--border2) !important; color: var(--tx-md) !important; }
        `}
      </style>
    </div>
  );
};
