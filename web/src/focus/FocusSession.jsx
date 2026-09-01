import { ArrowLeft, Check, Coffee, LogOut, Pause, Play, Square, TimerReset } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getElapsedMs } from './focus-machine.js';
import { playFocusChime } from './focus-audio.js';

export function formatFocusTime(milliseconds, round = 'floor') {
  const seconds = Math.max(0, Math[round](milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const pair = (value) => String(value).padStart(2, '0');
  return hours > 0 ? `${pair(hours)}:${pair(minutes)}:${pair(remainingSeconds)}` : `${pair(minutes)}:${pair(remainingSeconds)}`;
}

export function getSessionDisplay(session, now) {
  const elapsedMs = getElapsedMs(session, now);
  const targetMs = session.phase === 'break' ? session.breakTargetMs : session.targetMs;
  const milliseconds = targetMs === null ? elapsedMs : Math.max(0, targetMs - elapsedMs);
  return {
    elapsedMs,
    text: formatFocusTime(milliseconds, targetMs === null ? 'floor' : 'ceil'),
    progress: targetMs ? Math.min(100, (elapsedMs / targetMs) * 100) : 0,
  };
}

function stateCopy(session) {
  if (session.status === 'focus-complete') return { eyebrow: '专注记录已保存', label: '本轮完成' };
  if (session.status === 'break-complete') return { eyebrow: '可以继续工作了', label: '休息完成' };
  if (session.status === 'paused') return { eyebrow: session.phase === 'break' ? '休息计时暂停' : '专注计时暂停', label: '已暂停' };
  if (session.phase === 'break') return { eyebrow: '放松一下', label: '休息中' };
  return { eyebrow: session.mode === 'pomodoro' ? '保持专注' : '按自己的节奏', label: session.mode === 'pomodoro' ? '专注中' : '自由专注' };
}

function FinishDialog({ elapsedMs, onConfirm, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.querySelector('button')?.focus();
    function trap(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const buttons = [...dialog.querySelectorAll('button')];
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
        event.preventDefault();
        buttons[0]?.focus();
      }
    }
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [onClose]);

  return (
    <div className="focus-confirm-backdrop">
      <section ref={dialogRef} className="confirm-dialog focus-finish-dialog" role="alertdialog" aria-modal="true" aria-labelledby="focus-finish-title">
        <h3 id="focus-finish-title">确认提前结束</h3>
        <p>将保存本次已专注的 {formatFocusTime(elapsedMs)}。</p>
        <div><button type="button" className="ghost-button" onClick={onClose}>取消</button><button type="button" className="danger-solid" onClick={onConfirm}>确认结束</button></div>
      </section>
    </div>
  );
}

export default function FocusSession({ storeHook, onExitImmersive }) {
  const session = storeHook((state) => state.activeSession);
  const pause = storeHook((state) => state.pause);
  const resume = storeHook((state) => state.resume);
  const tick = storeHook((state) => state.tick);
  const finishEarly = storeHook((state) => state.finishEarly);
  const startBreak = storeHook((state) => state.startBreak);
  const skipBreak = storeHook((state) => state.skipBreak);
  const clearCompleted = storeHook((state) => state.clearCompleted);
  const settleForHide = storeHook((state) => state.settleForHide);
  const readNow = storeHook((state) => state.readNow);
  const [displayNow, setDisplayNow] = useState(() => readNow());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    function update() {
      const result = tick();
      setDisplayNow(readNow());
      if (result.sound) void playFocusChime();
    }
    const interval = globalThis.setInterval(update, 1000);
    function settle() {
      const result = settleForHide();
      setDisplayNow(readNow());
      if (result.sound) void playFocusChime();
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') settle();
    }
    globalThis.addEventListener?.('pagehide', settle);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      globalThis.clearInterval(interval);
      globalThis.removeEventListener?.('pagehide', settle);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [readNow, settleForHide, tick]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (confirming) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onExitImmersive();
        return;
      }
      const tag = event.target?.tagName?.toLowerCase();
      if (event.key !== ' ' || ['input', 'select', 'textarea', 'button'].includes(tag)) return;
      if (session?.status === 'running') pause();
      if (session?.status === 'paused') resume();
      setDisplayNow(readNow());
      event.preventDefault();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirming, onExitImmersive, pause, readNow, resume, session?.status]);

  if (!session) return null;
  const display = getSessionDisplay(session, displayNow);
  const copy = stateCopy(session);
  const canToggle = session.status === 'running' || session.status === 'paused';

  function returnToTasks(action = clearCompleted) {
    action();
    onExitImmersive();
  }

  return (
    <section className={`focus-overlay focus-${session.phase}`} aria-label="专注模式">
      <header className="focus-session-header">
        <div className="focus-session-brand"><TimerReset size={20} /><span>日序专注</span></div>
        <button type="button" className="focus-icon-button" aria-label="退出沉浸模式" title="退出沉浸模式" onClick={onExitImmersive}><LogOut size={19} /></button>
      </header>
      <div className="focus-session-content">
        <p className="focus-state-label">{copy.eyebrow}</p>
        <h1>{session.subjectSnapshot}</h1>
        <div className="focus-timer-wrap" style={{ '--focus-progress': `${display.progress}%` }}>
          <div className="focus-progress" aria-hidden="true" />
          <time className="focus-timer">{display.text}</time>
        </div>
        <p className="focus-status">{copy.label}</p>

        <div className="focus-controls">
          {canToggle && <button type="button" className="focus-control primary" aria-label={session.status === 'running' ? '暂停' : '继续'} onClick={() => { session.status === 'running' ? pause() : resume(); setDisplayNow(readNow()); }}>
            {session.status === 'running' ? <Pause size={19} /> : <Play size={19} />}{session.status === 'running' ? '暂停' : '继续'}
          </button>}
          {canToggle && session.phase === 'focus' && <button type="button" className="focus-control" onClick={() => setConfirming(true)}><Square size={18} />提前结束</button>}
          {canToggle && session.phase === 'break' && <button type="button" className="focus-control" onClick={() => returnToTasks(skipBreak)}><ArrowLeft size={18} />跳过休息</button>}
          {session.status === 'focus-complete' && session.mode === 'pomodoro' && <button type="button" className="focus-control primary" onClick={() => { startBreak(); setDisplayNow(readNow()); }}><Coffee size={19} />开始休息</button>}
          {session.status === 'focus-complete' && <button type="button" className="focus-control" onClick={() => returnToTasks()}><ArrowLeft size={18} />返回任务</button>}
          {session.status === 'break-complete' && <button type="button" className="focus-control primary" onClick={() => returnToTasks()}><Check size={19} />返回任务</button>}
        </div>
      </div>
      {confirming && <FinishDialog elapsedMs={getElapsedMs(session, readNow())} onClose={() => setConfirming(false)} onConfirm={() => { finishEarly(); setConfirming(false); setDisplayNow(readNow()); }} />}
    </section>
  );
}
