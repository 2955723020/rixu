import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkSubtaskCompletion,
  validateParentRelation,
} from '../../src/domain/subtask.js';

const task = (id, parentId = null, status = 'pending') => ({
  id,
  parentId,
  status,
});

test('validates a missing, self, and cyclic parent relation with field actions', () => {
  const tasks = new Map([
    ['parent', task('parent')],
    ['child', task('child', 'parent')],
    ['grandchild', task('grandchild', 'child')],
  ]);
  const getTask = (id) => tasks.get(id) ?? null;

  for (const [taskId, parentId, code] of [
    ['new', 'missing', 'PARENT_NOT_FOUND'],
    ['parent', 'parent', 'SELF_PARENT'],
    ['parent', 'grandchild', 'PARENT_CYCLE'],
  ]) {
    const result = validateParentRelation({ taskId, parentId, getTask });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].field, 'parentId');
    assert.equal(result.errors[0].code, code);
    assert.ok(result.errors[0].action.length > 0);
  }
});

test('allows completion when there are no incomplete direct children', () => {
  assert.deepEqual(
    checkSubtaskCompletion(task('parent'), []),
    { ok: true, allowed: true, incompleteSubtaskIds: [] },
  );
  assert.deepEqual(
    checkSubtaskCompletion(task('parent'), [task('child', 'parent', 'completed')]),
    { ok: true, allowed: true, incompleteSubtaskIds: [] },
  );
});

test('blocks completion and identifies incomplete direct children', () => {
  const result = checkSubtaskCompletion(task('parent'), [
    task('first', 'parent', 'pending'),
    task('done', 'parent', 'completed'),
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'INCOMPLETE_SUBTASKS');
  assert.deepEqual(result.incompleteSubtaskIds, ['first']);
  assert.equal(result.errors[0].field, 'parentId');
  assert.match(result.errors[0].action, /complete|reassign|remove/i);
});
