import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { buildCalendarIndex, selectCalendarDate } from '../../../src/query/calendar-view.js';
import { getLocalDateKey } from '../lib/clock.js';
import { useTaskStore } from '../store/task-store.js';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

function pad(value) { return String(value).padStart(2, '0'); }
function dateKey(year, month, day) { return `${year}-${pad(month + 1)}-${pad(day)}`; }

function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - offset));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      key: dateKey(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month,
    };
  });
}

function weekCells(selectedDate) {
  const selected = new Date(`${selectedDate}T00:00:00.000Z`);
  const offset = (selected.getUTCDay() + 6) % 7;
  selected.setUTCDate(selected.getUTCDate() - offset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selected);
    date.setUTCDate(selected.getUTCDate() + index);
    return {
      key: dateKey(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      day: date.getUTCDate(),
      inMonth: true,
    };
  });
}

export default function CalendarPage({ storeHook = useTaskStore, initialMonth, now = new Date().toISOString() }) {
  const tasks = storeHook((state) => state.tasks);
  const addTask = storeHook((state) => state.addTask);
  const timeZone = storeHook((state) => state.timeZone);
  const today = getLocalDateKey(now, timeZone);
  const initial = initialMonth || today.slice(0, 7);
  const [cursor, setCursor] = useState(() => ({ year: Number(initial.slice(0, 4)), month: Number(initial.slice(5, 7)) - 1 }));
  const [selectedDate, setSelectedDate] = useState(initialMonth ? `${cursor.year}-${pad(cursor.month + 1)}-01` : today);
  const [mode, setMode] = useState('month');
  const [title, setTitle] = useState('');
  const index = useMemo(() => buildCalendarIndex(tasks), [tasks]);
  const cells = useMemo(
    () => mode === 'month' ? monthCells(cursor.year, cursor.month) : weekCells(selectedDate),
    [cursor, mode, selectedDate],
  );
  const selected = selectCalendarDate(tasks, selectedDate);

  function moveMonth(delta) {
    const next = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    const nextCursor = { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    setCursor(nextCursor);
    setSelectedDate(`${nextCursor.year}-${pad(nextCursor.month + 1)}-01`);
  }

  function movePeriod(delta) {
    if (mode === 'month') return moveMonth(delta);
    const next = new Date(`${selectedDate}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + delta * 7);
    const key = dateKey(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
    setSelectedDate(key);
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  function showToday() {
    const [year, month] = today.split('-').map(Number);
    setCursor({ year, month: month - 1 });
    setSelectedDate(today);
  }

  function add(event) {
    event.preventDefault();
    const result = addTask({ title, dueDate: selectedDate, timezone: timeZone });
    if (result.ok) setTitle('');
  }

  return (
    <div className="page calendar-page">
      <header className="page-header calendar-header">
        <div><p className="eyebrow">按日期规划</p><h1>{cursor.year}年 {cursor.month + 1}月</h1></div>
        <div className="calendar-toolbar">
          <div className="segmented-control" aria-label="日历视图">
            <button type="button" aria-label="月视图" aria-pressed={mode === 'month'} className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>月</button>
            <button type="button" aria-label="周视图" aria-pressed={mode === 'week'} className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>周</button>
          </div>
          <div className="calendar-controls"><button type="button" className="icon-button" aria-label={mode === 'month' ? '上个月' : '上一周'} onClick={() => movePeriod(-1)}><ChevronLeft size={19} /></button><button type="button" className="ghost-button" onClick={showToday}>今天</button><button type="button" className="icon-button" aria-label={mode === 'month' ? '下个月' : '下一周'} onClick={() => movePeriod(1)}><ChevronRight size={19} /></button></div>
        </div>
      </header>
      <div className="calendar-layout">
        <section role="grid" className={`month-grid ${mode === 'week' ? 'week-grid' : ''}`} aria-label={`${cursor.year}年${cursor.month + 1}月${mode === 'week' ? '周' : ''}日历`}>
          {weekdays.map((weekday) => <div key={weekday} className="weekday">{weekday}</div>)}
          {cells.map((cell) => {
            const dateTasks = index[cell.key] || [];
            return <button type="button" key={cell.key} aria-label={`选择 ${cell.key}`} className={`calendar-cell ${cell.inMonth ? '' : 'outside'} ${cell.key === selectedDate ? 'selected' : ''} ${cell.key === today ? 'today' : ''}`} onClick={() => setSelectedDate(cell.key)}><span>{cell.day}</span>{dateTasks.length > 0 && <small>{dateTasks.length} 项</small>}<i>{dateTasks.slice(0, 3).map((task) => <b key={task.id} className={`priority-${task.priority}`} />)}</i></button>;
          })}
        </section>
        <aside className="day-panel">
          <p className="eyebrow">选中日期</p><h2>{selectedDate.slice(5, 7)}月{selectedDate.slice(8, 10)}日</h2>
          <div className="day-task-list">{selected.tasks.length ? selected.tasks.map((task) => <div key={task.id} className="day-task"><span className={`day-task-dot priority-${task.priority}`} /><span>{task.title}</span></div>) : <p className="day-empty">这一天还没有任务</p>}</div>
          <form className="day-add" onSubmit={add}><input aria-label={`在 ${selectedDate} 新建任务`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="在这天新建" /><button type="submit" aria-label={`添加到 ${selectedDate}`} disabled={!title.trim()}><Plus size={16} /></button></form>
        </aside>
      </div>
    </div>
  );
}
