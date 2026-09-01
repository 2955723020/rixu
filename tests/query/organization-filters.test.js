import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterByListId,
  filterByPriority,
  filterByTag,
  sortByPriority,
} from '../../src/query/organization-filters.js';

function task(id, { listId = null, tags = [], priority = 'none' } = {}) {
  return {
    id,
    title: id,
    dueDate: '2025-02-28',
    startAt: '2025-02-28T09:00:00.000Z',
    endAt: '2025-02-28T10:00:00.000Z',
    recurrence: { frequency: 'monthly', anchorDay: 31 },
    listId,
    tags,
    priority,
  };
}

test('filters tasks by list, one tag, or priority', () => {
  const tasks = [
    task('urgent-work', { listId: 'work', tags: ['release', 'focus'], priority: 'urgent' }),
    task('low-home', { listId: 'home', tags: ['chores'], priority: 'low' }),
    task('high-work', { listId: 'work', tags: ['release'], priority: 'high' }),
  ];

  assert.deepEqual(filterByListId(tasks, 'work').map(({ id }) => id), [
    'urgent-work',
    'high-work',
  ]);
  assert.deepEqual(filterByTag(tasks, 'focus').map(({ id }) => id), ['urgent-work']);
  assert.deepEqual(filterByPriority(tasks, 'low').map(({ id }) => id), ['low-home']);
});

test('TC-ORG-3 sorts priorities in fixed order and preserves input order within a level', () => {
  const tasks = [
    task('low-1', { priority: 'low' }),
    task('urgent-1', { priority: 'urgent' }),
    task('high-1', { priority: 'high' }),
    task('urgent-2', { priority: 'urgent' }),
    task('none-1'),
    task('medium-1', { priority: 'medium' }),
    task('high-2', { priority: 'high' }),
  ];

  assert.deepEqual(sortByPriority(tasks).map(({ id }) => id), [
    'urgent-1',
    'urgent-2',
    'high-1',
    'high-2',
    'medium-1',
    'low-1',
    'none-1',
  ]);
  for (const priority of ['low', 'medium', 'high', 'urgent']) {
    assert.ok(filterByPriority(tasks, priority).every((item) => item.priority === priority));
  }
});

test('filtering and sorting do not mutate task dates, recurrence, or organization attributes', () => {
  const tasks = [
    task('first', { listId: 'work', tags: ['release', 'focus'], priority: 'low' }),
    task('second', { listId: 'home', tags: ['chores'], priority: 'urgent' }),
  ];
  const before = structuredClone(tasks);

  filterByListId(tasks, 'work');
  filterByTag(tasks, 'release');
  filterByPriority(tasks, 'urgent');
  sortByPriority(tasks);

  assert.deepEqual(tasks, before);
});
