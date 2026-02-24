import { useState } from 'react';
import { useStore } from '../store';
import TaskDetail from './TaskDetail';

export const ProjectSection = () => {
  const { projects, tasks } = useStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Removed unused variable: intl

  // Convert projects object to array
  const projectList = Object.values(projects);

  // Filter tasks for selected project
  const filteredTasks = selectedProjectId
    ? Object.values(tasks).filter(task => task.projectId === selectedProjectId)
    : [];

  const selectedTask = selectedTaskId ? tasks[selectedTaskId] : null;

  return (
    <div className="project-section" style={{ display: 'flex', height: '100%' }}>
      <div className="project-list" style={{ flex: 1, borderRight: '1px solid #eee', minWidth: 200 }}>
        <h2 style={{ padding: '12px 16px 0 16px' }}>Projects</h2>
        {projectList.length === 0 && <div style={{ padding: 16 }}>No projects found.</div>}
        {projectList.map(project => (
          <div
            key={project.id}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              background: selectedProjectId === project.id ? '#f0f4ff' : undefined,
              fontWeight: selectedProjectId === project.id ? 'bold' : undefined
            }}
            onClick={() => {
              setSelectedProjectId(project.id);
              setSelectedTaskId(null);
            }}
          >
            {project.name}
          </div>
        ))}
      </div>
      <div className="task-list-section" style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ padding: '12px 16px 0 16px' }}>
          {selectedProjectId
            ? `Tasks for ${projectList.find(p => p.id === selectedProjectId)?.name || ''}`
            : 'Select a project to view tasks'}
        </h3>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredTasks.length === 0 && selectedProjectId && (
            <div style={{ padding: 16 }}>No tasks for this project.</div>
          )}
          {filteredTasks.map(task => (
            <div
              key={task.id}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                background: selectedTaskId === task.id ? '#e6f7ff' : undefined
              }}
              onClick={() => setSelectedTaskId(task.id)}
            >
              {task.title}
            </div>
          ))}
        </div>
      </div>
      <div className="task-detail-section" style={{ flex: 3, padding: '16px', borderLeft: '1px solid #eee', minWidth: 320 }}>
        {selectedTask ? (
          <TaskDetail onClose={() => setSelectedTaskId(null)} />
        ) : (
          <div style={{ color: '#888' }}>Select a task to see details.</div>
        )}
      </div>
    </div>
  );
};
