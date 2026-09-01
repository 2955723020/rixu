import { beforeEach, describe, expect, it } from 'vitest';

import { createFocusStore, FOCUS_STORAGE_KEY } from './focus-store.js';

describe('focus store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps one active session and persists one completed focus record', () => {
    let now = new Date('2026-08-31T08:00:00Z');
    const store = createFocusStore({
      clock: () => now,
      idGenerator: () => 'session-1',
      recordIdGenerator: () => 'record-1',
      persist: false,
    });

    expect(store.getState().startSession({ mode: 'pomodoro', subjectSnapshot: '写方案', focusMinutes: 1, breakMinutes: 5 }).ok).toBe(true);
    expect(store.getState().startSession({ mode: 'stopwatch', subjectSnapshot: '第二条' })).toMatchObject({
      ok: false,
      code: 'SESSION_ACTIVE',
      session: { id: 'session-1', subjectSnapshot: '写方案' },
    });
    now = new Date('2026-08-31T08:01:00Z');

    expect(store.getState().tick()).toMatchObject({ changed: true, sound: true });
    expect(store.getState().tick()).toMatchObject({ changed: false, sound: false });
    expect(store.getState().records).toHaveLength(1);
    expect(store.getState().activeSession.status).toBe('focus-complete');
  });

  it('rehydrates a running session as paused without adding closed-page time', () => {
    localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify({
      state: {
        settings: { focusMinutes: 25, breakMinutes: 5, lastMode: 'pomodoro' },
        activeSession: {
          id: 'session-1', mode: 'stopwatch', phase: 'focus', status: 'running', taskId: null,
          subjectSnapshot: '阅读', startedAt: '2026-08-31T08:00:00.000Z', accumulatedMs: 90000,
          resumedAt: '2026-08-31T08:01:30.000Z', targetMs: null, breakTargetMs: 300000, recordId: null,
        },
        records: [],
      },
      version: 0,
    }));

    const store = createFocusStore({ persist: true });

    expect(store.getState().activeSession).toMatchObject({ status: 'paused', accumulatedMs: 90000, resumedAt: null });
  });

  it('settles a due pomodoro before hiding and otherwise pauses running time', () => {
    let now = new Date('2026-08-31T08:00:00Z');
    const dueStore = createFocusStore({
      clock: () => now,
      idGenerator: () => 'due-session',
      recordIdGenerator: () => 'due-record',
      persist: false,
    });
    dueStore.getState().startSession({ mode: 'pomodoro', subjectSnapshot: '评审', focusMinutes: 1, breakMinutes: 5 });
    now = new Date('2026-08-31T08:01:05Z');

    expect(dueStore.getState().settleForHide()).toMatchObject({ changed: true, sound: true });
    expect(dueStore.getState().records).toHaveLength(1);

    const runningStore = createFocusStore({ clock: () => now, idGenerator: () => 'running-session', persist: false });
    runningStore.getState().startSession({ mode: 'stopwatch', subjectSnapshot: '阅读' });
    expect(runningStore.getState().settleForHide()).toMatchObject({ changed: true, sound: false });
    expect(runningStore.getState().activeSession.status).toBe('paused');
  });

  it('supports pause, resume, early finish, break controls, and completed cleanup', () => {
    let now = new Date('2026-08-31T08:00:00Z');
    let nextRecord = 0;
    const store = createFocusStore({
      clock: () => now,
      idGenerator: () => 'session-1',
      recordIdGenerator: () => `record-${++nextRecord}`,
      persist: false,
    });
    store.getState().startSession({ mode: 'pomodoro', subjectSnapshot: '方案', focusMinutes: 25, breakMinutes: 5 });
    now = new Date('2026-08-31T08:02:00Z');

    store.getState().pause();
    expect(store.getState().activeSession).toMatchObject({ status: 'paused', accumulatedMs: 120000 });
    store.getState().resume();
    expect(store.getState().finishEarly()).toMatchObject({ changed: true, record: { outcome: 'stopped-early' } });
    expect(store.getState().startBreak()).toMatchObject({ phase: 'break', status: 'running' });
    expect(store.getState().skipBreak()).toBeNull();
    expect(store.getState().activeSession).toBeNull();

    store.getState().startSession({ mode: 'stopwatch', subjectSnapshot: '阅读' });
    store.getState().finishEarly();
    expect(store.getState().clearCompleted()).toBeNull();
    expect(store.getState().activeSession).toBeNull();
    expect(store.getState().records).toHaveLength(2);
  });

  it('sanitizes persisted settings and records without overwriting the task store key', () => {
    localStorage.setItem('rixu:v1', 'task-data');
    localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify({
      state: {
        settings: { focusMinutes: 0, breakMinutes: 99, lastMode: 'invalid' },
        activeSession: { id: '', status: 'running' },
        records: [
          { id: 'valid', sessionId: 'session-1', taskId: null, subjectSnapshot: '阅读', mode: 'stopwatch', outcome: 'stopped-early', focusedMs: 5000, startedAt: '2026-08-31T08:00:00.000Z', endedAt: '2026-08-31T08:00:05.000Z' },
          { id: 'broken' },
        ],
      },
      version: 0,
    }));

    const store = createFocusStore({ persist: true });

    expect(store.getState().settings).toEqual({ focusMinutes: 25, breakMinutes: 5, lastMode: 'pomodoro' });
    expect(store.getState().activeSession).toBeNull();
    expect(store.getState().records.map((record) => record.id)).toEqual(['valid']);
    expect(localStorage.getItem('rixu:v1')).toBe('task-data');
  });
});
