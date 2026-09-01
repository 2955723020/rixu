import { CalendarDays, ChevronRight, Play, Tag } from 'lucide-react';

import { formatTaskDate } from '../lib/clock.js';

const priorityLabels = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
  none: '',
};

export default function TaskItem({ task, timeZone, onToggle, onEdit, onFocus }) {
  const completed = task.status === 'completed';
  return (
    <article className={`task-item ${completed ? 'completed' : ''} ${task.isOverdue ? 'overdue' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={completed}
        aria-label={`${completed ? '恢复' : '完成'}“${task.title}”`}
        className={`task-check priority-${task.priority}`}
        onClick={() => onToggle(task.id)}
      >
        <span />
      </button>
      <button type="button" className="task-body" onClick={() => onEdit(task)} aria-label={`编辑“${task.title}”`}>
        <span className="task-title-row">
          <strong>{task.title}</strong>
          {task.priority !== 'none' && <span className={`priority-label priority-${task.priority}`}>{priorityLabels[task.priority]}</span>}
        </span>
        <span className="task-meta">
          <span className={task.isOverdue ? 'overdue-date' : ''}>
            <CalendarDays size={13} /> {formatTaskDate(task.dueDate, timeZone)}
            {task.isOverdue && ' · 已逾期'}
          </span>
          {task.tags.map((tag) => <span key={tag}><Tag size={12} />{tag}</span>)}
        </span>
      </button>
      <button type="button" className="icon-button task-focus-button" aria-label={`专注“${task.title}”`} title="开始专注" onClick={() => onFocus(task)}><Play size={16} /></button>
      <ChevronRight size={17} className="task-chevron" aria-hidden="true" />
    </article>
  );
}
