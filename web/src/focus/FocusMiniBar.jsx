import { Expand, Pause, Play, TimerReset } from 'lucide-react';
import { useEffect, useState } from 'react';

import { playFocusChime } from './focus-audio.js';
import { getSessionDisplay } from './FocusSession.jsx';

export default function FocusMiniBar({ storeHook, onOpenImmersive }) {
  const session = storeHook((state) => state.activeSession);
  const pause = storeHook((state) => state.pause);
  const resume = storeHook((state) => state.resume);
  const tick = storeHook((state) => state.tick);
  const settleForHide = storeHook((state) => state.settleForHide);
  const readNow = storeHook((state) => state.readNow);
  const [displayNow, setDisplayNow] = useState(() => readNow());

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

  if (!session) return null;
  const display = getSessionDisplay(session, displayNow);
  const complete = session.status === 'focus-complete' || session.status === 'break-complete';
  const status = complete ? '等待处理' : session.status === 'paused' ? '已暂停' : session.phase === 'break' ? '休息中' : '专注中';

  return (
    <aside className="focus-mini" aria-label="活动专注计时">
      <TimerReset size={18} />
      <div className="focus-mini-copy"><strong title={session.subjectSnapshot}>{session.subjectSnapshot}</strong><span>{status}</span></div>
      <time>{display.text}</time>
      {!complete && <button type="button" className="focus-mini-button" aria-label={session.status === 'running' ? '暂停' : '继续'} onClick={() => { session.status === 'running' ? pause() : resume(); setDisplayNow(readNow()); }}>{session.status === 'running' ? <Pause size={16} /> : <Play size={16} />}</button>}
      <button type="button" className="focus-mini-button" aria-label="进入专注模式" title="进入专注模式" onClick={onOpenImmersive}><Expand size={17} /></button>
    </aside>
  );
}
