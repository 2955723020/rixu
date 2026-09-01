import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Globe2,
  Inbox,
  ListTodo,
  Plus,
  Tag,
  TimerReset,
} from 'lucide-react';
import { useMemo, useState } from 'react';

const smartViews = [
  { id: 'today', label: '今天', icon: ListTodo },
  { id: 'future', label: '未来', icon: Clock3 },
  { id: 'overdue', label: '逾期', icon: AlertCircle },
  { id: 'completed', label: '已完成', icon: CheckCircle2 },
];

const pageViews = [
  { id: 'calendar', label: '日历', icon: CalendarDays },
  { id: 'stats', label: '统计', icon: BarChart3 },
  { id: 'focus-stats', label: '专注统计', icon: TimerReset },
];

const priorities = [
  { id: 'urgent', label: '紧急' },
  { id: 'high', label: '高' },
  { id: 'medium', label: '中' },
  { id: 'low', label: '低' },
];

const supportedTimeZones = ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles'];

export default function Sidebar({ tasks, lists, filter, timeZone, onFilter, onAddList, onTimeZone }) {
  const [listName, setListName] = useState('');
  const [addingList, setAddingList] = useState(false);
  const tags = useMemo(() => [...new Set(tasks.flatMap((task) => task.tags || []))].sort(), [tasks]);

  function selectView(view) {
    onFilter({ view, listId: null, tag: null, priority: null, search: '' });
  }

  function selectSingle(changes) {
    onFilter({ view: 'all', listId: null, tag: null, priority: null, search: '', ...changes });
  }

  function submitList(event) {
    event.preventDefault();
    const result = onAddList({ name: listName });
    if (result.ok) {
      setListName('');
      setAddingList(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand-mark"><span className="brand-glyph">日</span><span>日序</span></div>
      <nav className="sidebar-scroll" aria-label="主导航">
        <div className="nav-group">
          <p className="nav-heading">智能清单</p>
          {smartViews.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} aria-label={label} className={`nav-item ${filter.view === id && !filter.listId && !filter.tag && !filter.priority ? 'active' : ''}`} onClick={() => selectView(id)}>
              <Icon size={17} /><span>{label}</span>
              <em>{id === 'completed' ? tasks.filter((task) => task.status === 'completed').length : id === 'overdue' ? '' : ''}</em>
            </button>
          ))}
          {pageViews.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} aria-label={label} className={`nav-item ${filter.view === id ? 'active' : ''}`} onClick={() => selectView(id)}><Icon size={17} /><span>{label}</span></button>
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-heading-row"><p className="nav-heading">我的清单</p><button type="button" className="mini-icon-button" aria-label="新建清单" onClick={() => setAddingList((value) => !value)}><Plus size={15} /></button></div>
          {addingList && <form className="new-list-form" onSubmit={submitList}><input autoFocus value={listName} onChange={(event) => setListName(event.target.value)} aria-label="清单名称" placeholder="清单名称" /><button type="submit" aria-label="保存清单"><Plus size={14} /></button></form>}
          {lists.length === 0 && <p className="sidebar-empty">还没有自定义清单</p>}
          {lists.map((list) => (
            <button type="button" key={list.id} aria-label={`清单 ${list.name}`} className={`nav-item ${filter.listId === list.id ? 'active' : ''}`} onClick={() => selectSingle({ listId: list.id })}>
              <Inbox size={16} /><span>{list.name}</span><em>{tasks.filter((task) => task.listId === list.id).length}</em>
            </button>
          ))}
        </div>

        {tags.length > 0 && <div className="nav-group compact-group"><p className="nav-heading">标签</p>{tags.map((tag) => <button type="button" key={tag} aria-label={`标签 ${tag}`} className={`nav-item ${filter.tag === tag ? 'active' : ''}`} onClick={() => selectSingle({ tag })}><Tag size={15} /><span>{tag}</span></button>)}</div>}
        <details className="priority-group"><summary><span>优先级</span><ChevronDown size={14} /></summary>{priorities.map((priority) => <button type="button" key={priority.id} aria-label={`优先级 ${priority.label}`} className={`nav-item ${filter.priority === priority.id ? 'active' : ''}`} onClick={() => selectSingle({ priority: priority.id })}><Circle size={12} className={`priority-dot priority-${priority.id}`} /><span>{priority.label}</span></button>)}</details>
      </nav>
      <label className="sidebar-timezone"><Globe2 size={15} /><span>时区</span><select aria-label="用户时区" value={timeZone} onChange={(event) => onTimeZone(event.target.value)}>{[...new Set([timeZone, ...supportedTimeZones])].map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label>
    </aside>
  );
}
