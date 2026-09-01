import assert from 'node:assert/strict';
import test from 'node:test';

import { createTask, updateTask } from '../../src/domain/task.js';

const fixedDependencies = {
  clock: () => new Date('2025-01-10T08:00:00.000Z'),
  idGenerator: () => 'task-001',
};

test('creates a task with every required field and converts optional local times', () => {
  const recurrence = { frequency: 'weekly', weekdays: [1, 3] };
  const result = createTask(
    {
      title: '  Prepare release  ',
      dueDate: '2025-01-15',
      startAt: '2025-01-15T09:30',
      endAt: '2025-01-15T10:45',
      timezone: 'America/New_York',
      recurrence,
      listId: 'work',
      tags: ['release', 'focus'],
      priority: 'high',
      parentId: 'parent-1',
    },
    fixedDependencies,
  );

  assert.deepEqual(result, {
    ok: true,
    task: {
      id: 'task-001',
      title: 'Prepare release',
      dueDate: '2025-01-15',
      startAt: '2025-01-15T14:30:00.000Z',
      endAt: '2025-01-15T15:45:00.000Z',
      timezone: 'America/New_York',
      status: 'pending',
      completedAt: null,
      recurrence: { frequency: 'weekly', weekdays: [1, 3] },
      listId: 'work',
      tags: ['release', 'focus'],
      priority: 'high',
      parentId: 'parent-1',
      createdAt: '2025-01-10T08:00:00.000Z',
      updatedAt: '2025-01-10T08:00:00.000Z',
    },
  });
  recurrence.weekdays.push(5);
  assert.deepEqual(result.task.recurrence.weekdays, [1, 3]);
});

test('allows startAt and endAt to both be omitted', () => {
  const result = createTask(
    { title: 'Untimed task', dueDate: '2025-01-15', timezone: 'UTC' },
    fixedDependencies,
  );

  assert.equal(result.ok, true);
  assert.equal(result.task.startAt, null);
  assert.equal(result.task.endAt, null);
  assert.equal(result.task.recurrence, null);
  assert.equal(result.task.listId, null);
  assert.deepEqual(result.task.tags, []);
  assert.equal(result.task.priority, 'none');
  assert.equal(result.task.parentId, null);
});

test('rejects an empty title and an invalid YYYY-MM-DD due date', () => {
  const input = { title: '   ', dueDate: '2025-02-30', timezone: 'UTC' };
  const result = createTask(input, fixedDependencies);

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map(({ field, code }) => ({ field, code })),
    [
      { field: 'title', code: 'REQUIRED' },
      { field: 'dueDate', code: 'INVALID_DATE' },
    ],
  );
  assert.deepEqual(result.input, input);
  assert.match(result.errors[0].action, /title/i);
  assert.match(result.errors[1].action, /YYYY-MM-DD/);
});

test('rejects endAt before startAt and preserves the submitted input', () => {
  const input = {
    title: 'Time conflict',
    dueDate: '2025-01-15',
    startAt: '2025-01-15T11:00',
    endAt: '2025-01-15T10:00',
    timezone: 'UTC',
  };
  const result = createTask(input, fixedDependencies);

  assert.equal(result.ok, false);
  assert.deepEqual(result.input, input);
  assert.deepEqual(result.errors.map(({ field, code }) => ({ field, code })), [
    { field: 'endAt', code: 'END_BEFORE_START' },
  ]);
  assert.match(result.errors[0].action, /endAt.*startAt/i);
});

test('returns the corresponding field error for a local time in a DST gap', () => {
  const input = {
    title: 'DST gap',
    dueDate: '2025-03-09',
    startAt: '2025-03-09T02:30',
    timezone: 'America/New_York',
  };
  const result = createTask(input, fixedDependencies);

  assert.equal(result.ok, false);
  assert.deepEqual(result.input, input);
  assert.deepEqual(result.errors.map(({ field, code }) => ({ field, code })), [
    { field: 'startAt', code: 'INVALID_LOCAL_DATETIME' },
  ]);
  assert.match(result.errors[0].action, /startAt/);
});

test('updates business fields with a later timestamp while preserving identity and creation time', () => {
  const created = createTask(
    {
      title: 'Original',
      dueDate: '2025-01-15',
      startAt: '2025-01-15T09:00',
      timezone: 'UTC',
    },
    fixedDependencies,
  ).task;

  const result = updateTask(
    created,
    { title: 'Updated', tags: ['edited'], timezone: 'Asia/Shanghai' },
    { clock: () => new Date('2025-01-10T08:00:00.000Z') },
  );

  assert.equal(result.ok, true);
  assert.equal(result.task.id, 'task-001');
  assert.equal(result.task.createdAt, '2025-01-10T08:00:00.000Z');
  assert.equal(result.task.updatedAt, '2025-01-10T08:00:00.001Z');
  assert.equal(result.task.title, 'Updated');
  assert.deepEqual(result.task.tags, ['edited']);
  assert.equal(result.task.timezone, 'Asia/Shanghai');
  assert.equal(result.task.startAt, '2025-01-15T09:00:00.000Z');
  assert.equal(created.title, 'Original');
  assert.deepEqual(created.tags, []);
});

test('a failed update returns the patch and leaves the source task unchanged', () => {
  const created = createTask(
    {
      title: 'Original',
      dueDate: '2025-01-15',
      startAt: '2025-01-15T09:00',
      endAt: '2025-01-15T10:00',
      timezone: 'UTC',
    },
    fixedDependencies,
  ).task;
  const changes = { endAt: '2025-01-15T08:00' };

  const result = updateTask(created, changes, {
    clock: () => new Date('2025-01-11T08:00:00.000Z'),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.input, changes);
  assert.equal(result.errors[0].field, 'endAt');
  assert.equal(created.endAt, '2025-01-15T10:00:00.000Z');
  assert.equal(created.updatedAt, '2025-01-10T08:00:00.000Z');
});
