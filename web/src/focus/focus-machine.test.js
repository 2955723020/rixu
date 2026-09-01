import { describe, expect, it } from 'vitest';

import {
  completeBreakIfDue,
  completeDuePhase,
  createFocusSession,
  finishFocus,
  getElapsedMs,
  normalizeHydratedSession,
  pauseSession,
  resumeSession,
  startBreak,
} from './focus-machine.js';

const at = (value) => new Date(value);

describe('focus machine', () => {
  it('creates a pomodoro session with timestamp-based focus and break targets', () => {
    const result = createFocusSession(
      { mode: 'pomodoro', taskId: 'task-1', subjectSnapshot: '评审', focusMinutes: 25, breakMinutes: 5 },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );

    expect(result).toEqual({
      ok: true,
      session: {
        id: 'session-1',
        mode: 'pomodoro',
        phase: 'focus',
        status: 'running',
        taskId: 'task-1',
        subjectSnapshot: '评审',
        startedAt: '2026-08-31T08:00:00.000Z',
        resumedAt: '2026-08-31T08:00:00.000Z',
        accumulatedMs: 0,
        targetMs: 1500000,
        breakTargetMs: 300000,
        recordId: null,
      },
    });
  });

  it('creates a stopwatch session without a focus target', () => {
    const result = createFocusSession(
      { mode: 'stopwatch', subjectSnapshot: '阅读' },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );

    expect(result.session).toMatchObject({ mode: 'stopwatch', targetMs: null, breakTargetMs: 300000 });
  });

  it('rejects an empty subject and invalid pomodoro durations', () => {
    const emptySubject = createFocusSession(
      { mode: 'stopwatch', subjectSnapshot: '   ' },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );
    const invalidFocus = createFocusSession(
      { mode: 'pomodoro', subjectSnapshot: '评审', focusMinutes: 0, breakMinutes: 5 },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );
    const invalidBreak = createFocusSession(
      { mode: 'pomodoro', subjectSnapshot: '评审', focusMinutes: 25, breakMinutes: 61 },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );

    expect(emptySubject).toMatchObject({ ok: false, errors: [{ field: 'subjectSnapshot', code: 'REQUIRED' }] });
    expect(invalidFocus).toMatchObject({ ok: false, errors: [{ field: 'focusMinutes', code: 'OUT_OF_RANGE' }] });
    expect(invalidBreak).toMatchObject({ ok: false, errors: [{ field: 'breakMinutes', code: 'OUT_OF_RANGE' }] });
  });

  it('calculates elapsed time from timestamps across pause and resume', () => {
    const created = createFocusSession(
      { mode: 'stopwatch', subjectSnapshot: '阅读' },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );
    const paused = pauseSession(created.session, at('2026-08-31T08:05:00Z'));
    const resumed = resumeSession(paused, at('2026-08-31T08:10:00Z'));

    expect(getElapsedMs(resumed, at('2026-08-31T08:12:00Z'))).toBe(420000);
  });

  it('does not reduce elapsed time when the system clock moves backward', () => {
    const created = createFocusSession(
      { mode: 'stopwatch', subjectSnapshot: '阅读' },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );

    expect(getElapsedMs(created.session, at('2026-08-31T07:59:00Z'))).toBe(0);
    expect(pauseSession(created.session, at('2026-08-31T07:59:00Z'))).toMatchObject({ accumulatedMs: 0, resumedAt: null });
  });

  it('completes one pomodoro record idempotently', () => {
    const { session } = createFocusSession(
      { mode: 'pomodoro', subjectSnapshot: '评审', focusMinutes: 1, breakMinutes: 5 },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );
    const first = completeDuePhase(session, {
      now: at('2026-08-31T08:01:05Z'),
      recordIdGenerator: () => 'record-1',
    });
    const second = completeDuePhase(first.session, {
      now: at('2026-08-31T08:02:00Z'),
      recordIdGenerator: () => 'record-2',
    });

    expect(first).toMatchObject({
      changed: true,
      sound: true,
      record: {
        id: 'record-1',
        sessionId: 'session-1',
        focusedMs: 60000,
        outcome: 'completed',
        endedAt: '2026-08-31T08:01:05.000Z',
      },
      session: { status: 'focus-complete', accumulatedMs: 60000, resumedAt: null, recordId: 'record-1' },
    });
    expect(second).toMatchObject({ record: null, changed: false, sound: false });
  });

  it('records actual elapsed time when focus is finished early', () => {
    const { session } = createFocusSession(
      { mode: 'pomodoro', subjectSnapshot: '方案', focusMinutes: 25, breakMinutes: 5 },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );

    const result = finishFocus(session, {
      now: at('2026-08-31T08:03:30Z'),
      outcome: 'stopped-early',
      recordIdGenerator: () => 'record-1',
    });

    expect(result).toMatchObject({
      changed: true,
      record: { id: 'record-1', focusedMs: 210000, outcome: 'stopped-early' },
      session: { recordId: 'record-1', status: 'focus-complete', accumulatedMs: 210000, resumedAt: null },
    });
  });

  it('starts and completes a manual break without creating another focus record', () => {
    const { session } = createFocusSession(
      { mode: 'pomodoro', subjectSnapshot: '评审', focusMinutes: 1, breakMinutes: 1 },
      { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
    );
    const completed = completeDuePhase(session, {
      now: at('2026-08-31T08:01:00Z'),
      recordIdGenerator: () => 'record-1',
    });
    const breaking = startBreak(completed.session, at('2026-08-31T08:02:00Z'));
    const ended = completeBreakIfDue(breaking, at('2026-08-31T08:03:01Z'));

    expect(breaking).toMatchObject({ phase: 'break', status: 'running', accumulatedMs: 0, resumedAt: '2026-08-31T08:02:00.000Z', recordId: 'record-1' });
    expect(ended).toMatchObject({ changed: true, sound: true, session: { phase: 'break', status: 'break-complete', accumulatedMs: 60000, resumedAt: null } });
  });

  it('hydrates a running session as paused without adding closed-page time', () => {
    const running = { status: 'running', accumulatedMs: 120000, resumedAt: '2026-08-31T08:02:00.000Z' };

    expect(normalizeHydratedSession(running)).toMatchObject({ status: 'paused', accumulatedMs: 120000, resumedAt: null });
    expect(normalizeHydratedSession(null)).toBeNull();
  });
});
