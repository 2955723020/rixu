import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCompletedTasks,
  getFutureTasks,
  getOverdueTasks,
  getTasksForView,
  getTodayTasks,
} from '../../src/query/task-views.js';

function task(id, overrides = {}) {
  return {
    id,
    title: id,
    dueDate: '2025-03-02',
    startAt: null,
    endAt: null,
    timezone: 'UTC',
    status: 'pending',
    completedAt: null,
    recurrence: { frequency: 'weekly', weekdays: [1, 3] },
    listId: null,
    tags: [],
    priority: 'none',
    parentId: null,
    createdAt: '2025-02-01T00:00:00.000Z',
    updatedAt: '2025-02-01T00:00:00.000Z',
    ...overrides,
  };
}

const shanghaiContext = {
  now: '2025-03-01T16:30:00.000Z',
  timeZone: 'Asia/Shanghai',
};

test('today and future queries use the user local date and exclude undated or invalid tasks', () => {
  const tasks = [
    task('today'),
    task('past', { dueDate: '2025-03-01' }),
    task('future', { dueDate: '2025-03-03' }),
    task('completed-today', {
      status: 'completed',
      completedAt: '2025-03-01T15:00:00.000Z',
    }),
    task('missing-date', { dueDate: null }),
    task('invalid-date', { dueDate: '2025-02-30' }),
  ];

  assert.deepEqual(getTodayTasks(tasks, shanghaiContext).map(({ id }) => id), ['today']);
  assert.deepEqual(getFutureTasks(tasks, shanghaiContext).map(({ id }) => id), ['future']);
});

test('timed overdue queries compare now strictly with endAt and exclude completed tasks', () => {
  const options = { now: '2025-03-02T12:00:00.000Z', timeZone: 'UTC' };
  const tasks = [
    task('before', { endAt: '2025-03-02T11:59:59.999Z' }),
    task('boundary', { endAt: options.now }),
    task('after', { endAt: '2025-03-02T12:00:00.001Z' }),
    task('completed', {
      endAt: '2025-03-02T10:00:00.000Z',
      status: 'completed',
      completedAt: '2025-03-02T10:30:00.000Z',
    }),
    task('missing-date', {
      dueDate: null,
      endAt: '2025-03-02T10:00:00.000Z',
    }),
    task('invalid-date', {
      dueDate: '2025-02-30',
      endAt: '2025-03-02T10:00:00.000Z',
    }),
  ];

  assert.deepEqual(getOverdueTasks(tasks, options).map(({ id }) => id), ['before']);
});

test('untimed tasks become overdue only after the user local due date has ended', () => {
  const tasks = [task('untimed')];
  const atLocalDayEnd = {
    now: '2025-03-02T15:59:59.999Z',
    timeZone: 'Asia/Shanghai',
  };
  const afterLocalDayEnd = {
    now: '2025-03-02T16:00:00.000Z',
    timeZone: 'Asia/Shanghai',
  };

  assert.deepEqual(getOverdueTasks(tasks, atLocalDayEnd), []);
  assert.deepEqual(getOverdueTasks(tasks, afterLocalDayEnd).map(({ id }) => id), [
    'untimed',
  ]);
});

test('overdue tasks are stably sorted by effective deadline and include visual and semantic cues', () => {
  const tasks = [
    task('late', { endAt: '2025-03-02T12:00:00.000Z' }),
    task('equal-first', { endAt: '2025-03-02T10:00:00.000Z' }),
    task('all-day-first', { dueDate: '2025-03-01' }),
    task('equal-second', { endAt: '2025-03-02T10:00:00.000Z' }),
  ];

  const result = getOverdueTasks(tasks, {
    now: '2025-03-03T00:00:00.000Z',
    timeZone: 'UTC',
  });

  assert.deepEqual(result.map(({ id }) => id), [
    'all-day-first',
    'equal-first',
    'equal-second',
    'late',
  ]);
  for (const item of result) {
    assert.equal(item.isOverdue, true);
    assert.equal(item.highlightColor, 'red');
    assert.equal(item.overdueLabel, 'Overdue');
    assert.equal(item.overdueIcon, 'alert');
  }
});

test('completed tasks require completedAt, sort stably by completion time, and disappear after restore', () => {
  const restored = task('restored', {
    status: 'completed',
    completedAt: '2025-03-02T10:00:00.000Z',
  });
  const tasks = [
    restored,
    task('equal-first', {
      status: 'completed',
      completedAt: '2025-03-02T09:00:00.000Z',
    }),
    task('earliest', {
      status: 'completed',
      completedAt: '2025-03-01T20:00:00.000Z',
    }),
    task('equal-second', {
      status: 'completed',
      completedAt: '2025-03-02T09:00:00.000Z',
    }),
    task('missing-completion-time', { status: 'completed' }),
    task('pending-with-time', { completedAt: '2025-03-01T00:00:00.000Z' }),
  ];

  assert.deepEqual(getCompletedTasks(tasks).map(({ id }) => id), [
    'earliest',
    'equal-first',
    'equal-second',
    'restored',
  ]);

  restored.status = 'pending';
  restored.completedAt = null;

  assert.ok(!getCompletedTasks(tasks).some(({ id }) => id === 'restored'));
});

test('all task queries and view dispatch preserve the source task data deeply', () => {
  const tasks = [
    task('source', {
      dueDate: '2025-03-01',
      startAt: '2025-03-01T08:00:00.000Z',
      endAt: '2025-03-01T09:00:00.000Z',
      timezone: 'Asia/Shanghai',
      recurrence: {
        frequency: 'custom',
        interval: 2,
        unit: 'week',
        weekdays: [1, 5],
      },
    }),
  ];
  const before = structuredClone(tasks);
  const options = { now: '2025-03-02T12:00:00.000Z', timeZone: 'Asia/Shanghai' };

  getTodayTasks(tasks, options);
  getFutureTasks(tasks, options);
  const overdue = getOverdueTasks(tasks, options);
  getCompletedTasks(tasks);
  for (const view of ['today', 'future', 'overdue', 'completed']) {
    getTasksForView(tasks, view, options);
  }

  assert.deepEqual(tasks, before);
  assert.notStrictEqual(overdue[0], tasks[0]);
  assert.notStrictEqual(overdue[0].recurrence, tasks[0].recurrence);
});

test('date-sensitive views reject a now value that is not an absolute instant', () => {
  assert.throws(
    () =>
      getTodayTasks([task('today')], {
        now: '2025-03-02T12:00:00',
        timeZone: 'UTC',
      }),
    (error) => error.code === 'INVALID_INSTANT',
  );
});
