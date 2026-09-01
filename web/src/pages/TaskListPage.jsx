import { useMemo, useState } from 'react';
import { CircleAlert, Inbox } from 'lucide-react';

import { getTasksForView } from '../../../src/query/task-views.js';
import { filterByListId, filterByPriority, filterByTag, sortByPriority } from '../../../src/query/organization-filters.js';
import QuickAdd from '../components/QuickAdd.jsx';
import TaskEditor from '../components/TaskEditor.jsx';
import TaskItem from '../components/TaskItem.jsx';
import { useTaskStore } from '../store/task-store.js';

const viewCopy = {
  all: { title: '全部任务', eyebrow: '跨日期筛选', empty: '没有符合条件的任务' },
  today: { title: '今天', eyebrow: '专注当下', empty: '今天还没有安排' },
  future: { title: '未来', eyebrow: '提前一步', empty: '未来任务都已安排妥当' },
  overdue: { title: '逾期', eyebrow: '及时收尾', empty: '没有逾期任务' },
  completed: { title: '已完成', eyebrow: '回顾进展', empty: '完成第一项任务后，会在这里留下记录' },
};

export default function TaskListPage({ storeHook = useTaskStore, now = new Date().toISOString(), onFocusTask = () => {} }) {
  const tasks = storeHook((state) => state.tasks);
  const lists = storeHook((state) => state.lists);
  const filter = storeHook((state) => state.filter);
  const timeZone = storeHook((state) => state.timeZone);
  const addTask = storeHook((state) => state.addTask);
  const editTask = storeHook((state) => state.editTask);
  const toggleComplete = storeHook((state) => state.toggleComplete);
  const removeTask = storeHook((state) => state.removeTask);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);
  const currentView = viewCopy[filter.view] ? filter.view : 'today';
  const copy = viewCopy[currentView];

  const visible = useMemo(() => {
    let queried = currentView === 'all' ? [...tasks] : getTasksForView(tasks, currentView, { now, timeZone });
    if (filter.listId) queried = filterByListId(queried, filter.listId);
    if (filter.tag) queried = filterByTag(queried, filter.tag);
    if (filter.priority) queried = filterByPriority(queried, filter.priority);
    if (filter.search.trim()) {
      const needle = filter.search.trim().toLocaleLowerCase();
      queried = queried.filter((task) => task.title.toLocaleLowerCase().includes(needle) || task.tags.some((tag) => tag.toLocaleLowerCase().includes(needle)));
    }
    return sortByPriority(queried).filter((task) => !task.parentId);
  }, [currentView, filter.listId, filter.priority, filter.search, filter.tag, now, tasks, timeZone]);

  function handleToggle(id) {
    const result = toggleComplete(id);
    setNotice(result.ok ? null : result.errors?.[0]?.code === 'INCOMPLETE_SUBTASKS'
      ? `请先完成 ${result.incompleteSubtaskIds.length} 个子任务`
      : result.errors?.[0]?.action);
  }

  return (
    <div className="page task-list-page">
      <header className="page-header">
        <div><p className="eyebrow">{filter.listId || filter.tag || filter.priority || filter.search ? '筛选结果' : copy.eyebrow}</p><h1>{copy.title}</h1></div>
        <span className="task-total">{visible.length} 项</span>
      </header>
      <QuickAdd onAdd={addTask} timeZone={timeZone} now={now} />
      {notice && <div className="notice error-notice" role="alert"><CircleAlert size={17} />{notice}</div>}
      <section className="task-section" aria-label={`${copy.title}任务`}>
        {visible.length > 0 ? visible.map((task) => (
          <TaskItem key={task.id} task={task} timeZone={timeZone} onToggle={handleToggle} onEdit={setEditing} onFocus={onFocusTask} />
        )) : (
          <div className="list-empty"><span><Inbox size={24} /></span><h2>{copy.empty}</h2><p>用上方输入框添加任务，或从其他视图继续处理。</p></div>
        )}
      </section>
      {editing && <TaskEditor task={editing} lists={lists} subtasks={tasks.filter((task) => task.parentId === editing.id)} onSave={editTask} onAddSubtask={addTask} onToggleSubtask={toggleComplete} onDelete={(id) => removeTask(id, { confirmed: true })} onClose={() => setEditing(null)} />}
    </div>
  );
}
