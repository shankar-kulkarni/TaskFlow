import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useIntl } from 'react-intl';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';
import { canCommentOnTasks, canCreateOrEditTasks } from '../auth/permissions';

interface TaskDetailProps {
  onClose: () => void;
  aiAssistEnabled?: boolean;
}

interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  isEdited?: boolean;
  author?: { id: string; displayName?: string; email?: string };
  replies?: TaskComment[];
}

interface TaskAiSummary {
  currentStatus: string;
  keyDecisions: string[];
  blockers: string[];
  suggestedNextAction: string;
  meta?: {
    generatedAt?: string;
  };
}

export const TaskDetail = ({ onClose, aiAssistEnabled = true }: TaskDetailProps) => {
  const { selectedTaskId, tasks, openEditTaskForm, deleteTask } = useStore();
  const { user } = useAuth();
  const intl = useIntl();
  const task = selectedTaskId ? tasks[selectedTaskId] : null;

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [aiSummary, setAiSummary] = useState<TaskAiSummary | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  // All hooks must be declared before any conditional returns
  useEffect(() => {
    if (!task) return;

    let isActive = true;

    const loadComments = async () => {
      try {
        const data = await apiClient.getTaskComments(task.id);
        if (isActive) {
          setComments(data);
        }
      } catch (err) {
        console.error('Failed to load comments:', err);
        if (isActive) {
          setCommentError('Failed to load comments.');
        }
      }
    };

    const loadAiSummary = async () => {
      setAiSummaryLoading(true);
      setAiSummaryError(null);
      try {
        const response = await apiClient.aiTaskSummarise({ taskId: task.id });
        if (isActive) {
          setAiSummary(response?.data ?? null);
        }
      } catch (err: unknown) {
        console.error('Failed to load AI summary:', err);
        if (isActive) {
          setAiSummaryError((err as Error)?.message || 'Failed to load AI summary.');
        }
      } finally {
        if (isActive) {
          setAiSummaryLoading(false);
        }
      }
    };

    void loadComments();
    if (aiAssistEnabled) {
      void loadAiSummary();
    }

    return () => {
      isActive = false;
    };
  }, [aiAssistEnabled, task]);

  // Safe to return null after all hooks
  if (!task) return null;

  const commentCount = comments.length;
  const allowTaskEdit = canCreateOrEditTasks(user?.role);
  const allowComment = canCommentOnTasks(user?.role);

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  };

  const formatCommentTime = (value?: string | null) => {
    if (!value) return '';
    return new Date(value).toLocaleString();
  };

  const renderAssignees = () => {
    if (!task.userAssignments || task.userAssignments.length === 0) return 'Unassigned';
    return task.userAssignments
      .map((a) => a.displayName || a.email || a.userId || 'Unknown')
      .join(', ');
  };

  const getAvatarInitials = (name?: string, email?: string) => {
    const source = name || email || '?';
    return source
      .split(' ')
      .map((part) => part[0] ?? '')
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  };

  const handleAddComment = async () => {
    if (!commentInput.trim()) return;
    setIsSavingComment(true);
    setCommentError(null);
    try {
      const newComment = await apiClient.addTaskComment(task.id, commentInput.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentInput('');
    } catch (err: unknown) {
      console.error('Failed to add comment:', err);
      setCommentError((err as Error)?.message || 'Failed to add comment.');
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleStartEdit = (comment: TaskComment) => {
    setEditingId(comment.id);
    setEditingBody(comment.body);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingBody('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editingBody.trim()) return;
    setIsSavingComment(true);
    setCommentError(null);
    try {
      const updated = await apiClient.updateTaskComment(commentId, editingBody.trim());
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...updated, isEdited: true } : c))
      );
      setEditingId(null);
      setEditingBody('');
    } catch (err: unknown) {
      console.error('Failed to update comment:', err);
      setCommentError((err as Error)?.message || 'Failed to update comment.');
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setCommentError(null);
    try {
      await apiClient.deleteTaskComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: unknown) {
      console.error('Failed to delete comment:', err);
      setCommentError((err as Error)?.message || 'Failed to delete comment.');
    }
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    onClose();
  };

  const handleRefreshAiSummary = async () => {
    setAiSummaryLoading(true);
    setAiSummaryError(null);
    try {
      const response = await apiClient.aiTaskSummarise({ taskId: task.id });
      setAiSummary(response?.data ?? null);
    } catch (err: unknown) {
      console.error('Failed to refresh AI summary:', err);
      setAiSummaryError((err as Error)?.message || 'Failed to refresh AI summary.');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  return (
    <div className="task-detail">
      <div className="detail-header">
        <div>
          <Tooltip content={intl.formatMessage({ id: 'tooltip.taskDetail.edit' })}>
            <button className="ib" onClick={() => allowTaskEdit && openEditTaskForm(task.id)} disabled={!allowTaskEdit}>
              ✎
            </button>
          </Tooltip>
          <Tooltip content={intl.formatMessage({ id: 'tooltip.taskDetail.delete' })}>
            <button className="ib" onClick={() => allowTaskEdit && void handleDelete()} disabled={!allowTaskEdit}>
              🗑️
            </button>
          </Tooltip>
          <Tooltip content={intl.formatMessage({ id: 'tooltip.taskDetail.close' })}>
            <button className="ib" onClick={onClose}>
              ✕
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="detail-body">
        <div className="dt-title">{task.title}</div>
        <div className="dt-id">#{task.id.slice(-8)}</div>

        <div className="dr">
          <div className="dr-lbl">Status</div>
          <div className="dr-val">
            <span
              className="sdot"
              style={{
                background:
                  task.status === 'DONE'
                    ? 'var(--teal)'
                    : task.status === 'IN_PROGRESS'
                    ? 'var(--blue)'
                    : task.status === 'IN_REVIEW'
                    ? 'var(--amber)'
                    : 'var(--tx-lo)',
              }}
            />
            {task.status.replace('_', ' ')}
          </div>
        </div>

        <div className="dr">
          <div className="dr-lbl">Priority</div>
          <div className="dr-val">
            <span
              className={`chip chip-${
                task.priority === 'CRITICAL'
                  ? 'c'
                  : task.priority === 'HIGH'
                  ? 'h'
                  : task.priority === 'MEDIUM'
                  ? 'm'
                  : 'l'
              }`}
            >
              {task.priority}
            </span>
          </div>
        </div>

        <div className="dr">
          <div className="dr-lbl">Assignees</div>
          <div className="dr-val">{renderAssignees()}</div>
        </div>

        <div className="dr">
          <div className="dr-lbl">Project</div>
          <div className="dr-val">{task.project?.name || 'No project'}</div>
        </div>

        <div className="dr">
          <div className="dr-lbl">Start Date</div>
          <div className="dr-val">{formatDateTime(task.startDate)}</div>
        </div>

        <div className="dr">
          <div className="dr-lbl">Due Date</div>
          <div className="dr-val">{formatDateTime(task.dueDate)}</div>
        </div>

        <div className="dr">
          <div className="dr-lbl">Estimated</div>
          <div className="dr-val">{task.estimatedHrs ? `${task.estimatedHrs} hrs` : '—'}</div>
        </div>

        <div className="dr">
          <div className="dr-lbl">Created</div>
          <div className="dr-val">{formatDateTime(task.createdAt)}</div>
        </div>

        <div className="dr">
          <div className="dr-lbl">Updated</div>
          <div className="dr-val">{formatDateTime(task.updatedAt)}</div>
        </div>

        <div className="dr">
          <div className="dr-lbl">Creator</div>
          <div className="dr-val">
            {task.creator?.displayName || task.creator?.email || task.createdBy}
          </div>
        </div>

        {task.description && <div className="desc-box">{task.description}</div>}

        {/* AI Summary */}
        {aiAssistEnabled && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            background: 'var(--s2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx-hi)' }}>AI Summary</div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => void handleRefreshAiSummary()}
              disabled={aiSummaryLoading}
            >
              {aiSummaryLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {aiSummaryError && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--rose)' }}>
              {aiSummaryError}
            </div>
          )}

          {!aiSummaryError && aiSummaryLoading && !aiSummary && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--tx-lo)' }}>
              Generating summary…
            </div>
          )}

          {!aiSummaryError && aiSummary && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--tx-md)' }}>{aiSummary.currentStatus}</div>
              <div style={{ fontSize: '12px', color: 'var(--tx-md)' }}>
                <strong>Decisions:</strong>{' '}
                {aiSummary.keyDecisions?.slice(0, 2).join(' • ') || 'None'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--tx-md)' }}>
                <strong>Blockers:</strong>{' '}
                {aiSummary.blockers?.slice(0, 2).join(' • ') || 'None'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--tx-hi)' }}>
                <strong>Next:</strong> {aiSummary.suggestedNextAction}
              </div>
            </div>
          )}
        </div>
        )}

        {/* Comments */}
        <div className="act-item">
          <div className="act-av" style={{ background: 'var(--blue)' }}>
            💬
          </div>
          <div className="act-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--tx-hi)' }}>
                Comments {commentCount > 0 ? `(${commentCount})` : ''}
              </div>
              <HelpSection
                titleId="help.taskDetail.title"
                items={['help.taskDetail.item1', 'help.taskDetail.item2', 'help.taskDetail.item3']}
              />
            </div>

            {comments.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--tx-lo)' }}>No comments yet.</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {comments.map((comment) => {
                const isOwner = Boolean(user?.id && comment.author?.id === user.id);
                return (
                  <div key={comment.id} style={{ display: 'flex', gap: '12px' }}>
                    <div
                      className="act-av"
                      style={{ background: 'linear-gradient(135deg, var(--blue), #9b72ff)' }}
                    >
                      {getAvatarInitials(comment.author?.displayName, comment.author?.email)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--tx-hi)' }}>
                            {comment.author?.displayName || comment.author?.email || 'Unknown'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--tx-lo)' }}>
                            {formatCommentTime(comment.createdAt)}
                            {comment.isEdited ? ' · edited' : ''}
                          </span>
                        </div>
                        {isOwner && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <Tooltip content={intl.formatMessage({ id: 'tooltip.taskDetail.editComment' })}>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                                onClick={() => handleStartEdit(comment)}
                              >
                                Edit
                              </button>
                            </Tooltip>
                            <Tooltip content={intl.formatMessage({ id: 'tooltip.taskDetail.deleteComment' })}>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                                onClick={() => void handleDeleteComment(comment.id)}
                              >
                                Delete
                              </button>
                            </Tooltip>
                          </div>
                        )}
                      </div>

                      {editingId === comment.id && isOwner ? (
                        <div>
                          <textarea
                            value={editingBody}
                            onChange={(e) => setEditingBody(e.target.value)}
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              color: 'var(--tx-hi)',
                              fontSize: '13px',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                            }}
                          />
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: '8px',
                              marginTop: '8px',
                            }}
                          >
                            <Tooltip content={intl.formatMessage({ id: 'tooltip.common.cancel' })}>
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: '12px', padding: '6px 12px' }}
                                onClick={handleCancelEdit}
                              >
                                Cancel
                              </button>
                            </Tooltip>
                            <Tooltip content={intl.formatMessage({ id: 'tooltip.taskDetail.saveComment' })}>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '12px', padding: '6px 12px' }}
                                onClick={() => void handleSaveEdit(comment.id)}
                                disabled={isSavingComment || !editingBody.trim()}
                              >
                                {isSavingComment ? 'Saving...' : 'Save'}
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      ) : (
                        <p
                          style={{
                            fontSize: '13px',
                            color: 'var(--tx-md)',
                            lineHeight: '1.4',
                            margin: 0,
                          }}
                        >
                          {comment.body}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {commentError && (
              <div className="status-error" style={{ marginTop: '10px' }}>
                {commentError}
              </div>
            )}

            {/* New comment input */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="act-av" style={{ background: 'var(--lime)' }}>
                  You
                </div>
                <div style={{ flex: 1 }}>
                  <Tooltip
                    content={intl.formatMessage({ id: 'tooltip.taskDetail.addComment' })}
                    className="tooltip-block"
                    placement="top"
                  >
                    <textarea
                      placeholder="Add a comment..."
                      rows={2}
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      disabled={!allowComment}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--tx-hi)',
                        fontSize: '13px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </Tooltip>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <Tooltip content={intl.formatMessage({ id: 'tooltip.taskDetail.postComment' })}>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                        onClick={() => void handleAddComment()}
                        disabled={!allowComment || isSavingComment || !commentInput.trim()}
                      >
                        {isSavingComment ? 'Saving...' : 'Comment'}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;
