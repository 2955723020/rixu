import assert from 'node:assert/strict';
import test from 'node:test';

import { createTask, updateTask } from '../../src/domain/task.js';

const dependencies = {
  clock: () => new Date('2025-01-10T08:00:00.000Z'),
  idGenerator: () => 'task-org-001',
};

const minimalTask = {
  title: 'Organize release',
  dueDate: '2025-01-15',
};

test('a minimal task keeps organization attributes optional and receives their defaults', () => {
  const result = createTask(minimalTask, dependencies);

  assert.equal(result.ok, true);
  assert.equal(result.task.listId, null);
  assert.deepEqual(result.task.tags, []);
  assert.equal(result.task.priority, 'none');
  assert.equal(result.task.parentId, null);
});

test('a task accepts multiple unique non-empty tags and every supported priority', () => {
  for (const priority of ['none', 'low', 'medium', 'high', 'urgent']) {
    const result = createTask(
      { ...minimalTask, tags: ['release', 'focus'], priority },
      dependencies,
    );

    assert.equal(result.ok, true, `expected ${priority} to be accepted`);
    assert.deepEqual(result.task.tags, ['release', 'focus']);
    assert.equal(result.task.priority, priority);
  }
});

test('creation rejects malformed or duplicate tags with a tags correction action', () => {
  for (const tags of ['release', ['release', ''], ['release', 'release'], ['release', 2]]) {
    const input = { ...minimalTask, tags };
    const result = createTask(input, dependencies);

    assert.equal(result.ok, false);
    assert.deepEqual(result.input, input);
    assert.equal(result.errors.find((error) => error.field === 'tags')?.field, 'tags');
    assert.match(result.errors.find((error) => error.field === 'tags').action, /unique|non-empty|array/i);
  }
});

test('creation and update reject unsupported priorities with a priority correction action', () => {
  const created = createTask(minimalTask, dependencies).task;

  for (const priority of ['', 'critical', 1, null]) {
    const createdResult = createTask({ ...minimalTask, priority }, dependencies);
    const updatedResult = updateTask(created, { priority }, dependencies);

    assert.equal(createdResult.ok, false);
    assert.equal(createdResult.errors.find((error) => error.field === 'priority')?.field, 'priority');
    assert.match(
      createdResult.errors.find((error) => error.field === 'priority').action,
      /none.*low.*medium.*high.*urgent/i,
    );
    assert.equal(updatedResult.ok, false);
    assert.deepEqual(updatedResult.input, { priority });
    assert.equal(updatedResult.errors.find((error) => error.field === 'priority')?.field, 'priority');
    assert.equal(created.priority, 'none');
  }
});

test('an invalid tags update leaves the source task unchanged', () => {
  const created = createTask(
    { ...minimalTask, tags: ['release', 'focus'], priority: 'high' },
    dependencies,
  ).task;
  const before = structuredClone(created);
  const changes = { tags: ['release', 'release'] };

  const result = updateTask(created, changes, dependencies);

  assert.equal(result.ok, false);
  assert.deepEqual(result.input, changes);
  assert.equal(result.errors[0].field, 'tags');
  assert.deepEqual(created, before);
});
