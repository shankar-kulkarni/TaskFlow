import { UserIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  createdBy: string;
  creator: {
    displayName: string;
  };
  userAssignments: any[];
  groupAssignments: any[];
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const priorityColors = {
  CRITICAL: 'text-red-700 bg-red-50 border-red-200',
  HIGH: 'text-orange-700 bg-orange-50 border-orange-200',
  MEDIUM: 'text-amber-700 bg-amber-50 border-amber-200',
  LOW: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  NONE: 'text-slate-600 bg-slate-50 border-slate-200',
};

const priorityIcons = {
  CRITICAL: ExclamationTriangleIcon,
  HIGH: ExclamationTriangleIcon,
  MEDIUM: ExclamationTriangleIcon,
  LOW: ExclamationTriangleIcon,
  NONE: null,
};

export const TaskCard = ({ task, onClick }: TaskCardProps) => {
  const PriorityIcon = priorityIcons[task.priority as keyof typeof priorityIcons];

  const assigneeCount = task.userAssignments.length +
    task.groupAssignments.reduce((sum, ga) => sum + (ga.group?.members?.length || 0), 0);

  return (
    <div
      onClick={onClick}
      className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl p-5 cursor-pointer hover:shadow-lg hover:bg-white transition-all duration-200 transform hover:-translate-y-1 group"
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-slate-900 text-sm line-clamp-2 group-hover:text-blue-700 transition-colors">
          {task.title}
        </h4>
        {PriorityIcon && (
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
            <PriorityIcon className="h-3 w-3 mr-1" />
            {task.priority.toLowerCase()}
          </div>
        )}
      </div>

      {task.description && (
        <p className="text-slate-600 text-sm mb-4 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-xs text-slate-500">
          <div className="flex items-center space-x-1">
            <UserIcon className="h-4 w-4" />
            <span className="font-medium">{assigneeCount}</span>
          </div>
          {task.dueDate && (
            <div className="flex items-center space-x-1">
              <ClockIcon className="h-4 w-4" />
              <span className="font-medium">{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
        <div className="text-xs text-slate-400 font-medium">
          {task.creator.displayName}
        </div>
      </div>
    </div>
  );
};