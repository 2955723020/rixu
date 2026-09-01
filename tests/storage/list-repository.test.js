import assert from 'node:assert/strict';
import test from 'node:test';

import { ListRepository } from '../../src/storage/list-repository.js';
import { TaskRepository } from '../../src/storage/task-repository.js';

function sequence(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function createRepositories() {
  const taskRepository = new TaskRepository({
    clock: sequence([
      new Date('2025-01-10T08:00:00.000Z'),
      new Date('2025-01-10T08:01:00.000Z'),
      new Date('2025-01-10T08:02:00.000Z'),
      new Date('2025-01-11T08:00:00.000Z'),
      new Date('2025-01-11T08:01:00.000Z'),
    ]),
    idGenerator: sequence(['task-work-1', 'task-work-2', 'task-home', 'task-free']),
  });
  const listRepository = new ListRepository({
    taskRepository,
    clock: sequence([
      new Date('2025-01-10T07:00:00.000Z'),
      new Date('2025-01-10T07:01:00.000Z'),
      new Date('2025-01-11T07:00:00.000Z'),
    ]),
    idGenerator: sequence(['work', 'home', 'later']),
  });
  return { listRepository, taskRepository };
}

function seedListsAndTasks() {
  const repositories = createRepositories();
  repositories.listRepository.create({ name: 'Work' });
  repositories.listRepository.create({ name: 'Home' });
  repositories.taskRepository.create({
    title: 'First work task',
    dueDate: '2025-01-15',
    listId: 'work',
    tags: ['focus'],
  });
  repositories.taskRepository.create({
    title: 'Second work task',
    dueDate: '2025-01-16',
    listId: 'work',
  });
  repositories.taskRepository.create({
    title: 'Home task',
    dueDate: '2025-01-17',
    listId: 'home',
  });
  repositories.taskRepository.create({
    title: 'Unassigned task',
    dueDate: '2025-01-18',
  });
  return repositories;
}

test('TC-ORG-1 creates, reads, and renames a list without changing its stable fields', () => {
  const { listRepository } = createRepositories();
  const created = listRepository.create({ name: 'Work' });

  assert.equal(created.ok, true);
  assert.equal(created.list.id, 'work');
  assert.deepEqual(listRepository.getById('work'), created.list);

  const renamed = listRepository.rename('work', 'Focused work');
  assert.equal(renamed.ok, true);
  assert.equal(renamed.list.id, created.list.id);
  assert.equal(renamed.list.createdAt, created.list.createdAt);
  assert.equal(renamed.list.updatedAt, '2025-01-10T07:01:00.000Z');
  assert.equal(renamed.list.name, 'Focused work');
});

test('deleting an assigned list without a policy leaves the list and every task unchanged', () => {
  const { listRepository, taskRepository } = seedListsAndTasks();
  const listsBefore = listRepository.getAll();
  const tasksBefore = taskRepository.getAll();

  const result = listRepository.delete('work');

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].field, 'strategy');
  assert.equal(result.errors[0].code, 'POLICY_REQUIRED');
  assert.match(result.errors[0].action, /unassign.*move/i);
  assert.deepEqual(listRepository.getAll(), listsBefore);
  assert.deepEqual(taskRepository.getAll(), tasksBefore);
});

test('unassign deletes the list and preserves its tasks with a null listId', () => {
  const { listRepository, taskRepository } = seedListsAndTasks();
  const unrelatedBefore = taskRepository.getById('task-home');

  const result = listRepository.delete('work', { strategy: 'unassign' });

  assert.deepEqual(result, { ok: true, deleted: true, id: 'work' });
  assert.equal(listRepository.getById('work'), null);
  assert.equal(taskRepository.getById('task-work-1').listId, null);
  assert.equal(taskRepository.getById('task-work-2').listId, null);
  assert.deepEqual(taskRepository.getById('task-home'), unrelatedBefore);
  assert.ok(listRepository.getById('home'));
});

test('move deletes the source list and migrates every assigned task to an existing target', () => {
  const { listRepository, taskRepository } = seedListsAndTasks();
  const unrelatedBefore = taskRepository.getById('task-free');

  const result = listRepository.delete('work', {
    strategy: 'move',
    targetListId: 'home',
  });

  assert.deepEqual(result, { ok: true, deleted: true, id: 'work' });
  assert.equal(listRepository.getById('work'), null);
  assert.equal(taskRepository.getById('task-work-1').listId, 'home');
  assert.equal(taskRepository.getById('task-work-2').listId, 'home');
  assert.equal(taskRepository.getById('task-home').listId, 'home');
  assert.deepEqual(taskRepository.getById('task-free'), unrelatedBefore);
});

test('invalid deletion strategies and move targets fail atomically', () => {
  for (const options of [
    { strategy: 'archive' },
    { strategy: 'move', targetListId: 'missing' },
    { strategy: 'move', targetListId: 'work' },
  ]) {
    const { listRepository, taskRepository } = seedListsAndTasks();
    const listsBefore = listRepository.getAll();
    const tasksBefore = taskRepository.getAll();

    const result = listRepository.delete('work', options);

    assert.equal(result.ok, false);
    assert.ok(result.errors[0].action.length > 0);
    assert.deepEqual(listRepository.getAll(), listsBefore);
    assert.deepEqual(taskRepository.getAll(), tasksBefore);
  }
});

test('repeating the same deletion is idempotent and does not modify migrated tasks again', () => {
  const { listRepository, taskRepository } = seedListsAndTasks();
  const options = { strategy: 'move', targetListId: 'home' };
  listRepository.delete('work', options);
  const listsAfterFirstDelete = listRepository.getAll();
  const tasksAfterFirstDelete = taskRepository.getAll();

  const repeated = listRepository.delete('work', options);

  assert.deepEqual(repeated, { ok: true, deleted: false, id: 'work' });
  assert.deepEqual(listRepository.getAll(), listsAfterFirstDelete);
  assert.deepEqual(taskRepository.getAll(), tasksAfterFirstDelete);
});

test('a deleted list ID is never reused, so an old deletion retry cannot affect a new list', () => {
  const taskRepository = new TaskRepository({
    idGenerator: sequence(['old-task', 'new-task']),
  });
  const listRepository = new ListRepository({
    taskRepository,
    idGenerator: sequence(['work', 'home', 'work', 'later']),
  });
  listRepository.create({ name: 'Work' });
  listRepository.create({ name: 'Home' });
  taskRepository.create({ title: 'Old task', dueDate: '2025-01-15', listId: 'work' });
  const deleteOptions = { strategy: 'move', targetListId: 'home' };
  listRepository.delete('work', deleteOptions);

  const replacement = listRepository.create({ name: 'Later' });
  taskRepository.create({
    title: 'New task',
    dueDate: '2025-01-16',
    listId: replacement.list.id,
  });
  const listsBeforeRetry = listRepository.getAll();
  const tasksBeforeRetry = taskRepository.getAll();

  assert.equal(replacement.list.id, 'later');
  assert.deepEqual(listRepository.delete('work', deleteOptions), {
    ok: true,
    deleted: false,
    id: 'work',
  });
  assert.deepEqual(listRepository.getAll(), listsBeforeRetry);
  assert.deepEqual(taskRepository.getAll(), tasksBeforeRetry);
});
