import React, { useState } from 'react';
import { TaskForm } from './TaskForm';

interface Task {
  id: string;
  title: string;
  assignees: { initials: string; color: string }[];
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Todo' | 'In Progress' | 'In Review' | 'Done';
  checked: boolean;
}

interface DetailPanelProps {
  selectedTask: Task | null;
  onTaskEdit?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskFilter?: (taskId: string) => void;
  onCommentAdd?: (taskId: string, comment: string) => void;
  editingTask?: Task | null;
  onTaskFormSubmit?: (taskData: any) => void;
  onTaskFormCancel?: () => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  selectedTask,
  onTaskEdit,
  onTaskDelete,
  onTaskFilter,
  onCommentAdd,
  editingTask,
  onTaskFormSubmit,
  onTaskFormCancel
}) => {
  const [commentText, setCommentText] = useState('');

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommentText(e.target.value);
  };

  const handleCommentSubmit = () => {
    if (commentText.trim() && selectedTask) {
      onCommentAdd?.(selectedTask.id, commentText.trim());
      setCommentText('');
    }
  };

  const handleCommentKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommentSubmit();
    }
  };

  if (!selectedTask) {
    return (
      <aside className="detail">
        <div className="detail-top">
          <span className="detail-label">Task Detail</span>
        </div>
        <div className="detail-body">
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-lo)' }}>
            Select a task to view details
          </div>
        </div>
      </aside>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress': return '#4f8eff';
      case 'Todo': return '#8a8a9a';
      case 'In Review': return '#ffb84d';
      case 'Done': return '#3fddc7';
      default: return '#8a8a9a';
    }
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

  return (
    <aside className="detail">
      {editingTask ? (
        <div className="task-form-container">
          <div className="detail-top">
            <span className="detail-label">Edit Task</span>
            <div className="detail-actions">
              <button className="ib" onClick={onTaskFormCancel} title="Cancel edit">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M13 2L3 14M3 2l10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="detail-body">
            <TaskForm
              onSubmit={onTaskFormSubmit || (() => {})}
              onCancel={onTaskFormCancel || (() => {})}
              initialData={{
                title: editingTask.title,
                description: '', // We don't have description in the Task interface
                status: editingTask.status === 'Todo' ? 'TODO' : 
                        editingTask.status === 'In Progress' ? 'IN_PROGRESS' : 
                        editingTask.status === 'In Review' ? 'IN_REVIEW' : 'DONE',
                priority: editingTask.priority === 'Critical' ? 'CRITICAL' :
                         editingTask.priority === 'High' ? 'HIGH' :
                         editingTask.priority === 'Medium' ? 'MEDIUM' : 'LOW'
              }}
              isEditing={true}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="detail-top">
            <span className="detail-label">Task Detail</span>
            <div className="detail-actions">
              <button className="ib" onClick={() => onTaskFilter?.(selectedTask.id)} title="Filter similar tasks">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <button className="ib" onClick={() => onTaskEdit?.(selectedTask.id)} title="Edit task">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M11 1l4 4-8 8H3v-4l8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="ib" onClick={() => onTaskDelete?.(selectedTask.id)} title="Delete task">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M13 2L3 14M3 2l10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="detail-body">
        <div>
          <div className="dt-title">{selectedTask.title}</div>
          <div className="dt-id">DS-042 · Created Feb 10, 2026</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          <div className="dr">
            <span className="dr-lbl">Status</span>
            <span className="dr-val">
              <span className="sdot" style={{background: getStatusColor(selectedTask.status)}}></span>
              <span style={{color: getStatusColor(selectedTask.status), fontSize:'12.5px', fontWeight:500}}>{selectedTask.status}</span>
            </span>
          </div>
          <div className="dr">
            <span className="dr-lbl">Priority</span>
            <span className="dr-val"><span className={`chip ${getPriorityClass(selectedTask.priority)}`}>{selectedTask.priority}</span></span>
          </div>
          <div className="dr">
            <span className="dr-lbl">Due Date</span>
            <span className="dr-val" style={{color:'#ffb84d', fontFamily:'Geist Mono', fontSize:'12px'}}>Feb 18, 2026</span>
          </div>
          <div className="dr">
            <span className="dr-lbl">Project</span>
            <span className="dr-val">
              <span className="pdot" style={{background:'#c8f060'}}></span>Design System
            </span>
          </div>
          <div className="dr">
            <span className="dr-lbl">Assignees</span>
            <span className="dr-val">
              <div className="assign">
                {selectedTask.assignees.map((assignee, idx) => (
                  <div key={idx} className="aav" style={{background: assignee.color, marginLeft: idx > 0 ? '-6px' : '0'}}>
                    {assignee.initials}
                  </div>
                ))}
              </div>
              <span style={{fontSize:'12px', color:'var(--tx-lo)'}}>Sarah K., Maya R.</span>
            </span>
          </div>
          <div className="dr">
            <span className="dr-lbl">Progress</span>
            <span className="dr-val">
              <div className="prog-wrap">
                <div className="prog-fill" style={{width:'62%'}}></div>
              </div>
              <span style={{fontSize:'11px', fontFamily:'Geist Mono', color:'var(--tx-lo)', whiteSpace:'nowrap'}}>62%</span>
            </span>
          </div>
          <div className="dr">
            <span className="dr-lbl">Est. Hours</span>
            <span className="dr-val" style={{fontFamily:'Geist Mono', fontSize:'12px'}}>6h / 10h</span>
          </div>
        </div>
        <div>
          <div style={{fontSize:'11px', fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--tx-lo)', marginBottom:'7px'}}>Description</div>
          <div className="desc-box">Review and update all typography tokens in the Figma Variables panel to align with the new 1.25 modular scale. Ensure heading levels, body sizes, and mono variants are mapped correctly to semantic tokens.</div>
        </div>
        <div>
          <div style={{fontSize:'11px', fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--tx-lo)', marginBottom:'10px'}}>Activity</div>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <div className="act-item">
              <div className="act-av" style={{background:'linear-gradient(135deg,#4f8eff,#9b72ff)'}}>SK</div>
              <div className="act-body">
                <span className="act-user">Sarah K.</span>
                <span style={{color:'var(--tx-lo)'}}> moved to </span>
                <span style={{color:'#4f8eff', fontSize:'12px'}}>In Progress</span>
                <div className="act-time">2h ago</div>
              </div>
            </div>
            <div className="act-item">
              <div className="act-av" style={{background:'linear-gradient(135deg,#3fddc7,#4f8eff)'}}>MR</div>
              <div className="act-body">
                <span className="act-user">Maya R.</span>
                <span style={{color:'var(--tx-lo)'}}> commented: "Started with H1–H6, will sync on mono sizes tomorrow."</span>
                <div className="act-time">5h ago</div>
              </div>
            </div>
            <div className="act-item">
              <div className="act-av" style={{background:'linear-gradient(135deg,#9b72ff,#ff6b6b)'}}>AL</div>
              <div className="act-body">
                <span className="act-user">Alex L.</span>
                <span style={{color:'var(--tx-lo)'}}> assigned </span>
                <span style={{color:'var(--tx-hi)', fontSize:'12px'}}>Maya R.</span>
                <div className="act-time">Yesterday</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="comment-row">
        <input
          className="comment-input"
          type="text"
          placeholder="Add a comment…"
          value={commentText}
          onChange={handleCommentChange}
          onKeyPress={handleCommentKeyPress}
        />
        <button
          className="send-btn"
          onClick={handleCommentSubmit}
          disabled={!commentText.trim()}
          title="Send comment"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M14 2L2 7l5 3 3 5 4-13z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
        </>
      )}
    </aside>
  );
};