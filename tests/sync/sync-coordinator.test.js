import assert from 'node:assert/strict';
import test from 'node:test';

import { TaskRepository } from '../../src/storage/task-repository.js';
import { LocalStore } from '../../src/storage/local-store.js';
import { ListRepository } from '../../src/storage/list-repository.js';
import { SyncQueue } from '../../src/sync/sync-queue.js';
import { SyncCoordinator } from '../../src/sync/sync-coordinator.js';
import { resolveConflict } from '../../src/sync/conflict-resolver.js';

function taskRepository(id = 't1') {
  return new TaskRepository({ idGenerator: () => id, clock: () => new Date('2025-01-01T00:00:00.000Z') });
}

test('applies remote full snapshots and tombstones idempotently', async () => {
  const repository = taskRepository();
  const adapter = { upload: async () => {}, pull: async () => ({ changes: [
    { entityType: 'task', entityId: 'remote', updatedAt: '2025-01-02T00:00:00.000Z', deviceId: 'device-b', payload: { id: 'remote', title: 'Remote', dueDate: '2025-01-03', startAt: null, endAt: null, timezone: 'UTC', status: 'completed', completedAt: '2025-01-02T00:00:00.000Z', recurrence: { frequency: 'daily' }, listId: 'list-1', tags: ['tag'], priority: 'high', parentId: null, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z' } },
    { entityType: 'task', entityId: 'deleted', updatedAt: '2025-01-03T00:00:00.000Z', deviceId: 'device-b', tombstone: { entityId: 'deleted' } },
  ]}) };
  const queue = new SyncQueue({ accountId: 'a', deviceId: 'device-a', adapter });
  const store = new LocalStore({ taskRepository: repository, syncQueue: queue });
  const coordinator = new SyncCoordinator({ localStore: store, adapter, queue });
  await coordinator.sync();
  await coordinator.sync();
  assert.equal(repository.getById('remote').title, 'Remote');
  assert.equal(repository.getById('remote').status, 'completed');
  assert.equal(repository.getById('deleted'), null);
  assert.deepEqual(repository.getAll().filter((task) => task.id === 'remote').length, 1);
});

test('retries transient upload failure without discarding local changes', async () => {
  let online = false;
  const adapter = { upload: async () => { if (!online) throw new Error('offline'); }, pull: async () => [] };
  const repository = taskRepository();
  const queue = new SyncQueue({ accountId: 'a', deviceId: 'device-a', adapter });
  const store = new LocalStore({ taskRepository: repository, syncQueue: queue });
  store.createTask({ title: 'Local', dueDate: '2025-01-03' });
  const coordinator = new SyncCoordinator({ localStore: store, adapter, queue });
  await coordinator.sync();
  assert.equal(repository.getById('t1').title, 'Local');
  assert.equal(queue.diagnostics()[0].status, 'failed');
  online = true;
  await coordinator.retry();
  assert.equal(queue.diagnostics()[0].status, 'succeeded');
});

test('reports a transient pull failure and succeeds on retry without losing local data', async () => {
  let pulls = 0;
  const adapter = { upload: async () => {}, pull: async () => { if (pulls++ === 0) throw new Error('offline'); return []; } };
  const repository = taskRepository();
  const queue = new SyncQueue({ accountId: 'a', deviceId: 'device-a', adapter });
  const store = new LocalStore({ taskRepository: repository, syncQueue: queue });
  store.createTask({ title: 'Local', dueDate: '2025-01-03' });
  const coordinator = new SyncCoordinator({ localStore: store, adapter, queue });
  const failed = await coordinator.sync();
  assert.equal(failed.ok, false);
  assert.equal(repository.getById('t1').title, 'Local');
  const retried = await coordinator.retry();
  assert.equal(retried.ok, true);
});

test('continues cursor-based pulls until every remote page is applied', async () => {
  const pages = [
    { changes: [{ entityType: 'task', entityId: 'one', updatedAt: '2025-01-02T00:00:00.000Z', deviceId: 'b', payload: { id: 'one', title: 'One' } }], hasMore: true, cursor: 'next' },
    { changes: [{ entityType: 'task', entityId: 'two', updatedAt: '2025-01-02T00:00:00.000Z', deviceId: 'b', payload: { id: 'two', title: 'Two' } }], hasMore: false, cursor: 'done' },
  ];
  const adapter = { upload: async () => {}, pull: async () => pages.shift() };
  const repository = taskRepository();
  const queue = new SyncQueue({ accountId: 'a', deviceId: 'device-a', adapter });
  const store = new LocalStore({ taskRepository: repository, syncQueue: queue });
  await new SyncCoordinator({ localStore: store, adapter, queue }).sync();
  assert.equal(repository.getById('one').title, 'One');
  assert.equal(repository.getById('two').title, 'Two');
});

test('local deletion gets a version newer than the deleted snapshot', () => {
  const repository = taskRepository();
  const adapter = { upload: async () => {}, pull: async () => [] };
  const queue = new SyncQueue({ accountId: 'a', deviceId: 'device-a', adapter });
  const store = new LocalStore({ taskRepository: repository, syncQueue: queue });
  const created = store.createTask({ title: 'Local', dueDate: '2025-01-03' }).task;
  store.deleteTask(created.id, { confirmed: true });
  const deletion = queue.operations().find((operation) => operation.operationType === 'delete');
  assert.ok(Date.parse(deletion.updatedAt) > Date.parse(created.updatedAt));
});

test('two device replicas converge to the byte-equivalent winning full task snapshot', async () => {
  const cloud = new Map();
  const adapter = {
    upload: async (operation) => {
      const version = { ...structuredClone(operation), entityType: 'task' };
      cloud.set(operation.entityId, resolveConflict(cloud.get(operation.entityId), version));
    },
    pull: async () => Array.from(cloud.values(), (version) => structuredClone(version)),
  };
  const makeReplica = (deviceId) => {
    const repository = taskRepository();
    const queue = new SyncQueue({ accountId: 'a', deviceId, adapter });
    const store = new LocalStore({ taskRepository: repository, syncQueue: queue });
    const coordinator = new SyncCoordinator({ localStore: store, adapter, queue });
    return { repository, store, coordinator };
  };
  const deviceA = makeReplica('device-a');
  const deviceB = makeReplica('device-b');
  const input = { title: 'Original', dueDate: '2025-01-03', recurrence: { frequency: 'daily' }, listId: 'list-old', tags: ['old'], priority: 'low' };
  deviceA.store.createTask(input);
  deviceB.store.createTask(input);
  deviceA.store.updateTask('t1', { recurrence: { frequency: 'weekly', weekdays: [1] }, listId: 'list-a', tags: ['a'], priority: 'high' });
  deviceB.store.completeTask('t1');
  await deviceA.coordinator.sync();
  await deviceB.coordinator.sync();
  await deviceA.coordinator.sync();
  assert.deepEqual(deviceA.repository.getById('t1'), deviceB.repository.getById('t1'));
  assert.equal(deviceA.repository.getById('t1').status, 'completed');
  assert.deepEqual(deviceA.repository.getById('t1').recurrence, { frequency: 'daily' });
  assert.equal(deviceA.repository.getById('t1').listId, 'list-old');
});

test('list deletion queues full snapshots for tasks changed by its retention policy', () => {
  const repository = taskRepository();
  const listRepository = new ListRepository({ taskRepository: repository, idGenerator: () => 'list-1', clock: () => new Date('2025-01-01T00:00:00.000Z') });
  const adapter = { upload: async () => {}, pull: async () => [] };
  const queue = new SyncQueue({ accountId: 'a', deviceId: 'device-a', adapter });
  const store = new LocalStore({ taskRepository: repository, listRepository, syncQueue: queue });
  store.createList({ name: 'List' });
  store.createTask({ title: 'Assigned', dueDate: '2025-01-03', listId: 'list-1' });
  store.deleteList('list-1', { strategy: 'unassign' });
  const taskUpdates = queue.operations().filter((operation) => operation.operationType === 'update');
  assert.equal(taskUpdates.length, 1);
  assert.equal(taskUpdates[0].payload.listId, null);
});

test('a durable tombstone prevents an older pull from resurrecting a task after coordinator restart', async () => {
  const payload = { id: 'remote', title: 'Remote', updatedAt: '2025-01-02T00:00:00.000Z' };
  let changes = [{ entityType: 'task', entityId: 'remote', updatedAt: payload.updatedAt, deviceId: 'b', payload }];
  const adapter = { upload: async () => {}, pull: async () => changes };
  const repository = taskRepository();
  const queue = new SyncQueue({ accountId: 'a', deviceId: 'device-a', adapter });
  const store = new LocalStore({ taskRepository: repository, syncQueue: queue });
  await new SyncCoordinator({ localStore: store, adapter, queue }).sync();
  changes = [{ entityType: 'task', entityId: 'remote', updatedAt: '2025-01-03T00:00:00.000Z', deviceId: 'b', tombstone: { entityId: 'remote' } }];
  await new SyncCoordinator({ localStore: store, adapter, queue }).sync();
  assert.equal(repository.getById('remote'), null);
  changes = [{ entityType: 'task', entityId: 'remote', updatedAt: payload.updatedAt, deviceId: 'z', payload }];
  await new SyncCoordinator({ localStore: store, adapter, queue }).sync();
  assert.equal(repository.getById('remote'), null);
});
