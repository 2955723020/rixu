import assert from 'node:assert/strict';
import test from 'node:test';

import { TaskRepository } from '../../src/storage/task-repository.js';

function sequence(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function createRepository(overrides = {}) {
  return new TaskRepository({
    clock: sequence([
      new Date('2025-01-10T08:00:00.000Z'),
      new Date('2025-01-11T08:00:00.000Z'),
      new Date('2025-01-12T08:00:00.000Z'),
    ]),
    idGenerator: sequence(['task-001', 'task-002', 'task-003']),
    ...overrides,
  });
}

test('TC-TASK-1 creates and reads a task by its stable unique ID', () => {
  const repository = createRepository();
  const created = repository.create({
    title: 'Prepare release',
    dueDate: '2025-01-15',
    startAt: '2025-01-15T09:30',
    endAt: '2025-01-15T10:45',
    timezone: 'America/New_York',
  });

  assert.equal(created.ok, true);
  assert.equal(created.task.id, 'task-001');
  assert.deepEqual(repository.getById('task-001'), {
    id: 'task-001',
    title: 'Prepare release',
    dueDate: '2025-01-15',
    startAt: '2025-01-15T14:30:00.000Z',
    endAt: '2025-01-15T15:45:00.000Z',
    timezone: 'America/New_York',
    status: 'pending',
    completedAt: null,
    recurrence: null,
    listId: null,
    tags: [],
    priority: 'none',
    parentId: null,
    createdAt: '2025-01-10T08:00:00.000Z',
    updatedAt: '2025-01-10T08:00:00.000Z',
  });
});

test('TC-TASK-2 rejects endAt before startAt without writing a task', () => {
  const repository = createRepository();
  const input = {
    title: 'Time conflict',
    dueDate: '2025-01-15',
    startAt: '2025-01-15T11:00',
    endAt: '2025-01-15T10:00',
    timezone: 'UTC',
  };

  const result = repository.create(input);

  assert.equal(result.ok, false);
  assert.deepEqual(result.input, input);
  assert.equal(result.errors[0].field, 'endAt');
  assert.match(result.errors[0].action, /endAt.*startAt/i);
  assert.equal(repository.getById('task-001'), null);
});

test('failed update is atomic and retains the original stored task', () => {
  const repository = createRepository();
  repository.create({
    title: 'Original',
    dueDate: '2025-01-15',
    startAt: '2025-01-15T09:00',
    endAt: '2025-01-15T10:00',
    timezone: 'UTC',
  });
  const before = repository.getById('task-001');
  const changes = { endAt: '2025-01-15T08:00' };

  const result = repository.update('task-001', changes);

  assert.equal(result.ok, false);
  assert.deepEqual(result.input, changes);
  assert.equal(result.errors[0].field, 'endAt');
  assert.deepEqual(repository.getById('task-001'), before);
});

test('successful update changes business fields and updatedAt but not identity fields', () => {
  const repository = createRepository();
  const created = repository.create({
    title: 'Original',
    dueDate: '2025-01-15',
    timezone: 'UTC',
  }).task;

  const result = repository.update('task-001', {
    title: 'Updated',
    dueDate: '2025-01-16',
    priority: 'high',
  });

  assert.equal(result.ok, true);
  assert.equal(result.task.id, created.id);
  assert.equal(result.task.createdAt, created.createdAt);
  assert.equal(result.task.updatedAt, '2025-01-11T08:00:00.000Z');
  assert.equal(result.task.title, 'Updated');
  assert.equal(result.task.dueDate, '2025-01-16');
  assert.equal(result.task.priority, 'high');
});

test('repository reads and write results cannot mutate stored tasks', () => {
  const repository = createRepository();
  const result = repository.create({
    title: 'Protected',
    dueDate: '2025-01-15',
    timezone: 'UTC',
    tags: ['one'],
  });
  result.task.title = 'Changed outside';
  result.task.tags.push('two');
  const firstRead = repository.getById('task-001');
  firstRead.title = 'Changed read';
  firstRead.tags.push('three');

  const stored = repository.getById('task-001');
  assert.equal(stored.title, 'Protected');
  assert.deepEqual(stored.tags, ['one']);
});

test('explicit confirmation gates deletion and confirmed deletion is isolated and idempotent', () => {
  const repository = createRepository();
  repository.create({ title: 'First', dueDate: '2025-01-15', timezone: 'UTC' });
  repository.create({ title: 'Second', dueDate: '2025-01-16', timezone: 'UTC' });

  const refused = repository.delete('task-001', { confirmed: false });
  assert.equal(refused.ok, false);
  assert.equal(refused.errors[0].field, 'confirmation');
  assert.equal(refused.errors[0].code, 'CONFIRMATION_REQUIRED');
  assert.ok(repository.getById('task-001'));

  assert.deepEqual(repository.delete('task-001', { confirmed: true }), {
    ok: true,
    deleted: true,
    id: 'task-001',
  });
  assert.equal(repository.getById('task-001'), null);
  assert.ok(repository.getById('task-002'));
  assert.deepEqual(repository.delete('task-001', { confirmed: true }), {
    ok: true,
    deleted: false,
    id: 'task-001',
  });
  assert.ok(repository.getById('task-002'));
});

test('retries an injected duplicate ID so different tasks remain uniquely addressable', () => {
  const repository = createRepository({
    idGenerator: sequence(['same-id', 'same-id', 'unique-id']),
  });

  const first = repository.create({ title: 'First', dueDate: '2025-01-15' });
  const second = repository.create({ title: 'Second', dueDate: '2025-01-16' });

  assert.equal(first.task.id, 'same-id');
  assert.equal(second.task.id, 'unique-id');
  assert.equal(repository.getById('same-id').title, 'First');
  assert.equal(repository.getById('unique-id').title, 'Second');
});

test('TC-ORG-2 adds and removes tags idempotently', () => {
  const repository = createRepository();
  repository.create({
    title: 'Tagged task',
    dueDate: '2025-01-15',
    tags: ['release'],
  });

  const added = repository.addTag('task-001', 'focus');
  assert.equal(added.ok, true);
  assert.deepEqual(added.task.tags, ['release', 'focus']);

  const duplicate = repository.addTag('task-001', 'focus');
  assert.equal(duplicate.ok, true);
  assert.deepEqual(duplicate.task.tags, ['release', 'focus']);

  const removed = repository.removeTag('task-001', 'release');
  assert.equal(removed.ok, true);
  assert.deepEqual(removed.task.tags, ['focus']);

  const absent = repository.removeTag('task-001', 'release');
  assert.equal(absent.ok, true);
  assert.deepEqual(absent.task.tags, ['focus']);
});

test('invalid organization updates are atomic in the repository', () => {
  const repository = createRepository();
  repository.create({
    title: 'Protected organization',
    dueDate: '2025-01-15',
    tags: ['release', 'focus'],
    priority: 'high',
  });
  const before = repository.getById('task-001');

  for (const changes of [
    { tags: ['release', 'release'] },
    { priority: 'critical' },
  ]) {
    const result = repository.update('task-001', changes);

    assert.equal(result.ok, false);
    assert.deepEqual(result.input, changes);
    assert.equal(result.errors[0].field, Object.keys(changes)[0]);
    assert.ok(result.errors[0].action.length > 0);
    assert.deepEqual(repository.getById('task-001'), before);
  }
});

test('reassignList updates every matching task and leaves unrelated tasks unchanged', () => {
  const repository = createRepository();
  repository.create({
    title: 'First work task',
    dueDate: '2025-01-15',
    listId: 'work',
  });
  repository.create({
    title: 'Second work task',
    dueDate: '2025-01-16',
    listId: 'work',
  });
  repository.create({
    title: 'Home task',
    dueDate: '2025-01-17',
    listId: 'home',
  });
  const unrelatedBefore = repository.getById('task-003');

  const result = repository.reassignList('work', 'home');

  assert.deepEqual(result, { ok: true, updated: 2 });
  assert.equal(repository.getById('task-001').listId, 'home');
  assert.equal(repository.getById('task-002').listId, 'home');
  assert.deepEqual(repository.getById('task-003'), unrelatedBefore);
});

test('reassignList commits no tasks when preparing one of the updates fails', () => {
  let clockCalls = 0;
  const repository = createRepository({
    clock: () => {
      clockCalls += 1;
      return clockCalls === 4
        ? new Date('invalid')
        : new Date(`2025-01-${String(10 + clockCalls).padStart(2, '0')}T08:00:00.000Z`);
    },
  });
  repository.create({ title: 'First', dueDate: '2025-01-15', listId: 'work' });
  repository.create({ title: 'Second', dueDate: '2025-01-16', listId: 'work' });
  const before = repository.getAll();

  assert.throws(
    () => repository.reassignList('work', 'home'),
    /clock must return a valid date or timestamp/i,
  );
  assert.deepEqual(repository.getAll(), before);
});

test('creates and reads direct parent-child relations without changing task attributes', () => {
  const repository = createRepository();
  const parent = repository.create({
    title: 'Parent',
    dueDate: '2025-01-15',
    recurrence: { frequency: 'weekly', weekdays: [1] },
    listId: 'work',
    tags: ['focus'],
    priority: 'high',
  }).task;

  const childResult = repository.createSubtask(parent.id, {
    title: 'Child',
    dueDate: '2025-01-16',
  });

  assert.equal(childResult.ok, true);
  assert.equal(childResult.task.parentId, parent.id);
  assert.deepEqual(repository.getChildren(parent.id).map((task) => task.id), [childResult.task.id]);
  assert.equal(repository.getSubtasks(parent.id)[0].parentId, parent.id);
  assert.equal(repository.getParent(childResult.task.id).id, parent.id);
  assert.deepEqual(repository.getById(parent.id), parent);
});

test('rejects invalid parent relations atomically', () => {
  const repository = createRepository();
  const parent = repository.create({ title: 'Parent', dueDate: '2025-01-15' }).task;
  const child = repository.createSubtask(parent.id, {
    title: 'Child',
    dueDate: '2025-01-16',
  }).task;
  const before = repository.getAll();

  for (const result of [
    repository.createSubtask('missing', { title: 'No parent', dueDate: '2025-01-17' }),
    repository.createSubtask(null, { title: 'No parent', dueDate: '2025-01-17' }),
    repository.createSubtask(undefined, { title: 'No parent', dueDate: '2025-01-17' }),
    repository.update(child.id, { parentId: 'missing' }),
    repository.update(parent.id, { parentId: parent.id }),
    repository.update(parent.id, { parentId: child.id }),
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].field, 'parentId');
    assert.ok(result.errors[0].action.length > 0);
    assert.deepEqual(repository.getAll(), before);
  }
});

test('completion check blocks only when direct children are incomplete and never mutates the parent', () => {
  const repository = createRepository();
  const parent = repository.create({
    title: 'Parent',
    dueDate: '2025-01-15',
    recurrence: { frequency: 'daily' },
    listId: 'work',
    tags: ['focus'],
    priority: 'urgent',
  }).task;
  const child = repository.createSubtask(parent.id, {
    title: 'Child',
    dueDate: '2025-01-16',
  }).task;
  const before = repository.getById(parent.id);

  const blocked = repository.checkCompletion(parent.id);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'INCOMPLETE_SUBTASKS');
  assert.deepEqual(blocked.incompleteSubtaskIds, [child.id]);
  assert.deepEqual(repository.getById(parent.id), before);

  repository.update(child.id, { parentId: null });
  assert.deepEqual(repository.canComplete(parent.id), {
    ok: true,
    allowed: true,
    incompleteSubtaskIds: [],
  });
});
