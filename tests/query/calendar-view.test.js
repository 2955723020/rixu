import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCalendarIndex,
  getCalendarTasks,
  selectCalendarDate,
} from '../../src/query/calendar-view.js';

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

test('builds a date index and reads only the selected date in input order', () => {
  const tasks = [
    task('first', { dueDate: '2025-03-03' }),
    task('second', { dueDate: '2025-03-02' }),
    task('third', { dueDate: '2025-03-03' }),
  ];

  const index = buildCalendarIndex(tasks);

  assert.deepEqual(Object.keys(index), ['2025-03-03', '2025-03-02']);
  assert.deepEqual(index['2025-03-03'].map(({ id }) => id), ['first', 'third']);
  assert.deepEqual(getCalendarTasks(tasks, '2025-03-02').map(({ id }) => id), ['second']);
  assert.deepEqual(getCalendarTasks(tasks, '2025-03-04'), []);
});

test('keeps completed and pending tasks together and preserves task fields', () => {
  const completed = task('completed', {
    status: 'completed',
    completedAt: '2025-03-02T12:00:00.000Z',
    recurrence: { frequency: 'monthly', anchorDay: 31 },
  });
  const pending = task('pending');
  const result = getCalendarTasks([completed, pending], '2025-03-02');

  assert.deepEqual(result.map(({ id }) => id), ['completed', 'pending']);
  assert.deepEqual(result[0], completed);
  assert.notStrictEqual(result[0], completed);
  assert.notStrictEqual(result[0].recurrence, completed.recurrence);
});

test('selecting a date returns tasks and a creation draft, including empty cells', () => {
  const tasks = [task('existing')];

  assert.deepEqual(selectCalendarDate(tasks, '2025-03-02'), {
    date: '2025-03-02',
    tasks: [tasks[0]],
    canCreate: true,
    createTaskInput: { dueDate: '2025-03-02' },
  });
  assert.deepEqual(selectCalendarDate(tasks, '2025-03-05'), {
    date: '2025-03-05',
    tasks: [],
    canCreate: true,
    createTaskInput: { dueDate: '2025-03-05' },
  });
});

test('excludes missing and invalid due dates from every calendar date', () => {
  const tasks = [
    task('valid'),
    task('missing', { dueDate: null }),
    task('empty', { dueDate: '' }),
    task('invalid-day', { dueDate: '2025-02-30' }),
    task('invalid-format', { dueDate: '2025-3-02' }),
  ];

  const index = buildCalendarIndex(tasks);

  assert.deepEqual(Object.keys(index), ['2025-03-02']);
  assert.deepEqual(index['2025-03-02'].map(({ id }) => id), ['valid']);
  assert.deepEqual(getCalendarTasks(tasks, '2025-02-30'), []);
});

test('indexing and selection do not mutate source tasks or their nested fields', () => {
  const tasks = [
    task('first', {
      dueDate: '2025-03-01',
      startAt: '2025-03-01T08:00:00.000Z',
      endAt: '2025-03-01T09:00:00.000Z',
      recurrence: { frequency: 'custom', interval: 2, unit: 'week' },
      status: 'pending',
    }),
  ];
  const before = structuredClone(tasks);

  const index = buildCalendarIndex(tasks);
  const selected = selectCalendarDate(tasks, '2025-03-01');
  index['2025-03-01'][0].dueDate = '2025-04-01';
  selected.tasks[0].recurrence.interval = 4;

  assert.deepEqual(tasks, before);
});
