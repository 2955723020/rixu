import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFocusStore } from './focus-store.js';
import { playFocusChime } from './focus-audio.js';
import FocusSession from './FocusSession.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FocusSession', () => {
  it('pauses with Space and exits immersive mode with Escape without ending', async () => {
    const user = userEvent.setup();
    const store = createFocusStore({ clock: () => new Date('2026-08-31T08:00:00Z'), persist: false });
    store.getState().startSession({ mode: 'stopwatch', subjectSnapshot: '阅读' });
    const onExitImmersive = vi.fn();
    render(<FocusSession storeHook={store} onExitImmersive={onExitImmersive} />);

    expect(screen.getByText('00:00')).toBeInTheDocument();
    await user.keyboard(' ');
    expect(store.getState().activeSession.status).toBe('paused');
    expect(screen.getByText('已暂停')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(onExitImmersive).toHaveBeenCalledOnce();
    expect(store.getState().activeSession).not.toBeNull();
  });

  it('confirms an early stopwatch finish, saves actual time, and offers no break', async () => {
    const user = userEvent.setup();
    let now = new Date('2026-08-31T08:00:00Z');
    const store = createFocusStore({ clock: () => now, recordIdGenerator: () => 'record-1', persist: false });
    store.getState().startSession({ mode: 'stopwatch', subjectSnapshot: '写作' });
    render(<FocusSession storeHook={store} onExitImmersive={() => {}} />);

    await user.click(screen.getByRole('button', { name: '提前结束' }));
    expect(screen.getByRole('alertdialog', { name: '确认提前结束' })).toBeInTheDocument();
    now = new Date('2026-08-31T08:02:05Z');
    await user.click(screen.getByRole('button', { name: '确认结束' }));

    expect(store.getState().records[0]).toMatchObject({ focusedMs: 125000, outcome: 'stopped-early' });
    expect(screen.getByText('本轮完成')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '开始休息' })).not.toBeInTheDocument();
  });

  it('completes one pomodoro and waits for the user to start a break', async () => {
    let now = new Date('2026-08-31T08:00:00Z');
    const store = createFocusStore({ clock: () => now, recordIdGenerator: () => 'record-1', persist: false });
    store.getState().startSession({ mode: 'pomodoro', subjectSnapshot: '评审', focusMinutes: 1, breakMinutes: 5 });
    render(<FocusSession storeHook={store} onExitImmersive={() => {}} />);
    now = new Date('2026-08-31T08:01:01Z');

    act(() => { store.getState().tick(); });
    expect(screen.getByText('本轮完成')).toBeInTheDocument();
    expect(store.getState().records).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: '开始休息' }));

    expect(screen.getByText('休息中')).toBeInTheDocument();
    expect(store.getState().records).toHaveLength(1);
  });

  it('silently resolves when the browser audio API cannot be constructed', async () => {
    vi.stubGlobal('AudioContext', class BrokenAudioContext {
      constructor() { throw new Error('blocked'); }
    });

    await expect(playFocusChime()).resolves.toBeUndefined();
  });
});
