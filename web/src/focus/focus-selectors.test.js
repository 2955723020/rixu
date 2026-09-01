import { describe, expect, it } from 'vitest';

import { getFocusSummary } from './focus-selectors.js';

describe('focus selectors', () => {
  it('groups records by the user local day and Monday-based week', () => {
    const records = [
      {
        id: 'a',
        taskId: 'task-1',
        subjectSnapshot: '评审',
        mode: 'pomodoro',
        outcome: 'completed',
        focusedMs: 1500000,
        endedAt: '2026-08-31T16:30:00.000Z',
      },
      {
        id: 'b',
        taskId: null,
        subjectSnapshot: '阅读',
        mode: 'stopwatch',
        outcome: 'stopped-early',
        focusedMs: 300000,
        endedAt: '2026-08-30T15:30:00.000Z',
      },
    ];

    const summary = getFocusSummary(records, {
      now: '2026-08-31T17:00:00.000Z',
      timeZone: 'Asia/Shanghai',
    });

    expect(summary.todayMs).toBe(1500000);
    expect(summary.todayPomodoros).toBe(1);
    expect(summary.weekMs).toBe(1500000);
    expect(summary.lastSevenDays.at(-1)).toEqual({ date: '2026-09-01', focusedMs: 1500000 });
    expect(summary.bySubject[0]).toMatchObject({ key: 'task:task-1', subject: '评审', focusedMs: 1500000 });
  });

  it('uses the newest task snapshot, keeps temporary subjects separate, and does not mutate records', () => {
    const records = [
      { id: 'old', taskId: 'task-1', subjectSnapshot: '旧标题', mode: 'pomodoro', outcome: 'completed', focusedMs: 60000, endedAt: '2026-08-29T08:00:00.000Z' },
      { id: 'new', taskId: 'task-1', subjectSnapshot: '新标题', mode: 'pomodoro', outcome: 'stopped-early', focusedMs: 120000, endedAt: '2026-08-31T08:00:00.000Z' },
      { id: 'topic', taskId: null, subjectSnapshot: '新标题', mode: 'stopwatch', outcome: 'stopped-early', focusedMs: 30000, endedAt: '2026-08-30T08:00:00.000Z' },
    ];
    const originalOrder = records.map((record) => record.id);

    const summary = getFocusSummary(records, { now: '2026-08-31T12:00:00.000Z', timeZone: 'UTC' });

    expect(summary.bySubject).toEqual([
      { key: 'task:task-1', subject: '新标题', focusedMs: 180000 },
      { key: 'subject:新标题', subject: '新标题', focusedMs: 30000 },
    ]);
    expect(summary.recent.map((record) => record.id)).toEqual(['new', 'topic', 'old']);
    expect(records.map((record) => record.id)).toEqual(originalOrder);
  });
});
