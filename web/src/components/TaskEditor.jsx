import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Clock3, Globe2, Plus, Repeat2, Trash2, X } from 'lucide-react';

import { instantToLocalDateTime } from '../../../src/domain/timezone.js';

function localTime(instant, timeZone) {
  if (!instant) return '';
  try {
    return instantToLocalDateTime(instant, timeZone).slice(11, 16);
  } catch {
    return '';
  }
}

export default function TaskEditor({ task, lists, subtasks, onSave, onAddSubtask, onToggleSubtask, onDelete, onClose }) {
  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const confirmRef = useRef(null);
  const previousFocusRef = useRef(document.activeElement);
  const [form, setForm] = useState({
    title: task.title,
    dueDate: task.dueDate,
    startTime: localTime(task.startAt, task.timezone),
    endTime: localTime(task.endAt, task.timezone),
    timezone: task.timezone,
    priority: task.priority,
    listId: task.listId || '',
    tags: task.tags.join(', '),
    recurrence: task.recurrence?.frequency || 'none',
  });
  const [errors, setErrors] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');

  useEffect(() => {
    titleRef.current?.focus();
    return () => previousFocusRef.current?.focus?.();
  }, []);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (confirming) {
          setConfirming(false);
          titleRef.current?.focus();
        } else {
          onClose();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const container = confirming ? confirmRef.current?.closest('.confirm-dialog') : editorRef.current;
      const focusable = [...(container?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirming, onClose]);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function save(event) {
    event.preventDefault();
    const result = onSave(task.id, {
      title: form.title,
      dueDate: form.dueDate,
      startAt: form.startTime ? `${form.dueDate}T${form.startTime}` : null,
      endAt: form.endTime ? `${form.dueDate}T${form.endTime}` : null,
      timezone: form.timezone,
      priority: form.priority,
      listId: form.listId || null,
      tags: form.tags.split(',').map((value) => value.trim()).filter(Boolean),
      recurrence: form.recurrence === 'none'
        ? null
        : form.recurrence === 'weekly'
          ? { frequency: 'weekly', weekdays: [1] }
          : { frequency: form.recurrence },
    });
    if (!result.ok) return setErrors(result.errors || []);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={editorRef} className="task-editor" role="dialog" aria-modal={confirming ? undefined : 'true'} aria-hidden={confirming ? 'true' : undefined} inert={confirming ? '' : undefined} aria-label="编辑任务">
        <header className="editor-header">
          <div><p className="eyebrow">任务详情</p><h2>编辑任务</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭编辑器"><X size={19} /></button>
        </header>
        <form onSubmit={save} className="editor-form">
          <label>标题<input ref={titleRef} value={form.title} onChange={(event) => change('title', event.target.value)} /></label>
          <div className="form-grid">
            <label>截止日期<span className="input-with-icon"><CalendarDays size={16} /><input type="date" value={form.dueDate} onChange={(event) => change('dueDate', event.target.value)} /></span></label>
            <label>优先级<select value={form.priority} onChange={(event) => change('priority', event.target.value)}><option value="none">无</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="urgent">紧急</option></select></label>
          </div>
          <div className="form-grid">
            <label>开始时间<span className="input-with-icon"><Clock3 size={16} /><input aria-label="开始时间" type="time" value={form.startTime} onChange={(event) => change('startTime', event.target.value)} /></span></label>
            <label>结束时间<span className="input-with-icon"><Clock3 size={16} /><input aria-label="结束时间" type="time" value={form.endTime} onChange={(event) => change('endTime', event.target.value)} /></span></label>
          </div>
          <label>时区<span className="input-with-icon"><Globe2 size={16} /><input aria-label="时区" value={form.timezone} onChange={(event) => change('timezone', event.target.value)} placeholder="Asia/Shanghai" /></span></label>
          <label>清单<select value={form.listId} onChange={(event) => change('listId', event.target.value)}><option value="">未归类</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
          <label>重复规则<span className="input-with-icon"><Repeat2 size={16} /><select aria-label="重复规则" value={form.recurrence} onChange={(event) => change('recurrence', event.target.value)}><option value="none">不重复</option><option value="daily">每天</option><option value="weekly">每周一</option><option value="monthly">每月</option></select></span></label>
          <label>标签<input value={form.tags} onChange={(event) => change('tags', event.target.value)} placeholder="多个标签用逗号分隔" /></label>
          <section className="subtask-editor">
            <div className="subtask-heading"><span>子任务</span><small>{subtasks.filter((item) => item.status === 'completed').length}/{subtasks.length}</small></div>
            {subtasks.map((item) => <div className="subtask-row" key={item.id}><button type="button" className={`subtask-check ${item.status === 'completed' ? 'completed' : ''}`} aria-label={`${item.status === 'completed' ? '恢复' : '完成'}子任务：${item.title}`} onClick={() => { const result = onToggleSubtask?.(item.id); if (result && !result.ok) setErrors(result.errors || []); }}>{item.status === 'completed' && <Check size={12} />}</button><span className={item.status === 'completed' ? 'done' : ''}>{item.title}</span></div>)}
            <div className="subtask-add"><input aria-label="新子任务标题" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="添加一个步骤" /><button type="button" aria-label="添加子任务" onClick={() => { const result = onAddSubtask({ title: subtaskTitle, dueDate: task.dueDate, timezone: task.timezone, parentId: task.id }); if (result.ok) setSubtaskTitle(''); else setErrors(result.errors || []); }} disabled={!subtaskTitle.trim()}><Plus size={16} /></button></div>
          </section>
          {errors.map((error) => <p className="field-error" key={`${error.field}:${error.code}`}>{error.message} {error.action}</p>)}
          <footer className="editor-actions">
            <button type="button" className="danger-button" onClick={() => setConfirming(true)}><Trash2 size={16} />删除任务</button>
            <div><button type="button" className="ghost-button" onClick={onClose}>取消</button><button type="submit" className="primary-button">保存更改</button></div>
          </footer>
        </form>
      </section>
      {confirming && (
        <section className="confirm-dialog" role="dialog" aria-modal="true" aria-label="确认删除">
          <h3>删除这项任务？</h3>
          <p>此操作会从当前设备移除任务。</p>
          <div><button ref={confirmRef} type="button" className="ghost-button" onClick={() => { setConfirming(false); titleRef.current?.focus(); }}>保留任务</button><button type="button" className="danger-solid" onClick={() => { onDelete(task.id); onClose(); }}>确认删除</button></div>
        </section>
      )}
    </div>
  );
}
