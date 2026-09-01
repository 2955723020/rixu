import { Minus, Plus, Timer, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

function durationError(value, minimum, maximum, message) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? null : message;
}

export default function FocusSetupDialog({ tasks, initialTask = null, settings, onStart, onClose }) {
  const dialogRef = useRef(null);
  const topLevelTasks = useMemo(() => tasks.filter((task) => !task.parentId), [tasks]);
  const [mode, setMode] = useState(settings.lastMode === 'stopwatch' ? 'stopwatch' : 'pomodoro');
  const [taskId, setTaskId] = useState(initialTask?.id ?? '');
  const [subject, setSubject] = useState(initialTask?.title ?? '');
  const [focusMinutes, setFocusMinutes] = useState(String(settings.focusMinutes));
  const [breakMinutes, setBreakMinutes] = useState(String(settings.breakMinutes));
  const [errors, setErrors] = useState({});
  const selectedTask = topLevelTasks.find((task) => task.id === taskId) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    const first = dialog?.querySelector('button, input, select');
    first?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
      if (!focusable.length) return;
      const firstItem = focusable[0];
      const lastItem = focusable.at(-1);
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function step(setter, current, delta, minimum, maximum) {
    const value = Number(current);
    setter(String(Math.min(maximum, Math.max(minimum, (Number.isFinite(value) ? value : minimum) + delta))));
  }

  function submit(event) {
    event.preventDefault();
    const subjectSnapshot = subject.trim() || selectedTask?.title?.trim() || '';
    const nextErrors = {
      subject: subjectSnapshot ? null : '请输入专注主题',
      focusMinutes: mode === 'pomodoro' ? durationError(focusMinutes, 1, 180, '专注时长应为 1 至 180 分钟') : null,
      breakMinutes: mode === 'pomodoro' ? durationError(breakMinutes, 1, 60, '休息时长应为 1 至 60 分钟') : null,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const input = {
      mode,
      taskId: selectedTask?.id ?? null,
      subjectSnapshot,
      ...(mode === 'pomodoro' ? { focusMinutes: Number(focusMinutes), breakMinutes: Number(breakMinutes) } : {}),
    };
    const result = onStart(input);
    if (!result?.ok) {
      const machineErrors = Object.fromEntries((result?.errors ?? []).map((error) => [error.field, error.message]));
      setErrors((current) => ({ ...current, ...machineErrors }));
    }
  }

  return (
    <div className="modal-backdrop focus-setup-backdrop">
      <section ref={dialogRef} className="task-editor focus-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="focus-setup-title">
        <header className="editor-header">
          <div className="focus-dialog-title"><span><Timer size={18} /></span><div><p className="eyebrow">进入专注</p><h2 id="focus-setup-title">开始一段专注</h2></div></div>
          <button type="button" className="icon-button" aria-label="关闭专注设置" onClick={onClose}><X size={19} /></button>
        </header>
        <form className="editor-form focus-setup-form" onSubmit={submit} noValidate>
          <div className="segmented-control focus-mode-control" aria-label="计时模式">
            <button type="button" className={mode === 'pomodoro' ? 'active' : ''} aria-pressed={mode === 'pomodoro'} onClick={() => setMode('pomodoro')}>番茄钟</button>
            <button type="button" className={mode === 'stopwatch' ? 'active' : ''} aria-pressed={mode === 'stopwatch'} onClick={() => setMode('stopwatch')}>自由计时</button>
          </div>

          <label>关联任务
            <select aria-label="关联任务" value={taskId} onChange={(event) => { const value = event.target.value; setTaskId(value); const task = topLevelTasks.find((item) => item.id === value); if (task && !subject.trim()) setSubject(task.title); }}>
              <option value="">不关联任务</option>
              {topLevelTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
          </label>
          <label>专注主题
            <input aria-label="专注主题" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={selectedTask ? selectedTask.title : '例如：阅读、写作或复盘'} />
            {errors.subject && <span className="field-error">{errors.subject}</span>}
          </label>

          {mode === 'pomodoro' && <div className="focus-duration-grid">
            <div className="focus-duration-field">
              <label htmlFor="focus-minutes">专注分钟</label>
              <span className="number-stepper">
                <button type="button" aria-label="减少专注分钟" onClick={() => step(setFocusMinutes, focusMinutes, -1, 1, 180)}><Minus size={16} /></button>
                <input id="focus-minutes" type="number" min="1" max="180" value={focusMinutes} onChange={(event) => setFocusMinutes(event.target.value)} />
                <button type="button" aria-label="增加专注分钟" onClick={() => step(setFocusMinutes, focusMinutes, 1, 1, 180)}><Plus size={16} /></button>
              </span>
              {errors.focusMinutes && <span className="field-error">{errors.focusMinutes}</span>}
            </div>
            <div className="focus-duration-field">
              <label htmlFor="break-minutes">休息分钟</label>
              <span className="number-stepper">
                <button type="button" aria-label="减少休息分钟" onClick={() => step(setBreakMinutes, breakMinutes, -1, 1, 60)}><Minus size={16} /></button>
                <input id="break-minutes" type="number" min="1" max="60" value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} />
                <button type="button" aria-label="增加休息分钟" onClick={() => step(setBreakMinutes, breakMinutes, 1, 1, 60)}><Plus size={16} /></button>
              </span>
              {errors.breakMinutes && <span className="field-error">{errors.breakMinutes}</span>}
            </div>
          </div>}

          <div className="focus-setup-actions">
            <button type="button" className="ghost-button" onClick={onClose}>取消</button>
            <button type="submit" className="primary-button"><Timer size={17} />开始专注</button>
          </div>
        </form>
      </section>
    </div>
  );
}
