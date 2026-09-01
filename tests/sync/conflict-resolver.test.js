import assert from 'node:assert/strict';
import test from 'node:test';

import { ConflictResolver, resolveConflict } from '../../src/sync/conflict-resolver.js';

test('selects a deterministic complete snapshot by updatedAt then deviceId', () => {
  const older = { entityType: 'task', entityId: 't1', updatedAt: '2025-01-01T00:00:00.000Z', deviceId: 'z', payload: { title: 'old', status: 'pending' } };
  const newer = { entityType: 'task', entityId: 't1', updatedAt: '2025-01-02T00:00:00.000Z', deviceId: 'a', payload: { title: 'new', status: 'completed', completedAt: '2025-01-02T00:00:00.000Z', recurrence: { frequency: 'weekly' }, listId: 'l1', tags: ['x'], priority: 'high', parentId: null } };
  assert.deepEqual(resolveConflict(older, newer), newer);
  assert.deepEqual(new ConflictResolver().resolve(newer, older), newer);
});

test('uses tombstones as full versions and resolves equal timestamps deterministically', () => {
  const task = { entityType: 'task', entityId: 't1', updatedAt: '2025-01-02T00:00:00.000Z', deviceId: 'a', operationId: 'op-a', payload: { id: 't1', title: 'keep' } };
  const tombstone = { entityType: 'task', entityId: 't1', updatedAt: '2025-01-02T00:00:00.000Z', deviceId: 'b', operationId: 'op-b', tombstone: { entityId: 't1' } };
  assert.deepEqual(resolveConflict(task, tombstone), tombstone);
  assert.deepEqual(resolveConflict(tombstone, task), tombstone);
});

test('uses canonical snapshot content as the final order-independent tie breaker', () => {
  const left = { entityType: 'task', entityId: 't1', updatedAt: '2025-01-02T00:00:00.000Z', deviceId: 'a', operationId: 'same', payload: { id: 't1', title: 'Alpha' } };
  const right = { entityType: 'task', entityId: 't1', updatedAt: '2025-01-02T00:00:00.000Z', deviceId: 'a', operationId: 'same', payload: { id: 't1', title: 'Zulu' } };
  assert.deepEqual(resolveConflict(left, right), resolveConflict(right, left));
});

test('remains order-independent when malformed versions have equally invalid timestamps', () => {
  const left = { entityType: 'task', entityId: 't1', updatedAt: 'invalid', deviceId: 'a', payload: { id: 't1', title: 'Alpha' } };
  const right = { entityType: 'task', entityId: 't1', updatedAt: 'invalid', deviceId: 'b', payload: { id: 't1', title: 'Zulu' } };
  assert.deepEqual(resolveConflict(left, right), resolveConflict(right, left));
});
