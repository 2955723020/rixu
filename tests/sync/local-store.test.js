import assert from 'node:assert/strict';
import test from 'node:test';

import { TaskRepository } from '../../src/storage/task-repository.js';
import { LocalStore } from '../../src/storage/local-store.js';
import { SyncQueue } from '../../src/sync/sync-queue.js';

function sequence(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function createStore(adapter = { upload: async () => { throw new Error('offline'); } }) {
  const repository = new TaskRepository({
    clock: sequence([
      new Date('2025-01-10T08:00:00.000Z'),
      new Date('2025-01-10T08:01:00.000Z'),
      new Date('2025-01-10T08:02:00.000Z'),
      new Date('2025-01-10T08:03:00.000Z'),
    ]),
    idGenerator: () => 'task-001',
  });
  const queue = new SyncQueue({ accountId: 'account-1', deviceId: 'device-a', adapter });
  return { store: new LocalStore({ taskRepository: repository, syncQueue: queue }), queue };
}

test('commits task create, edit, complete, and delete locally while adapter is offline', async () => {
  const { store, queue } = createStore();
  const created = await store.createTask({ title: 'Private title', dueDate: '2025-01-15' });
  assert.equal(created.ok, true);
  assert.equal(store.getTask(created.task.id).title, 'Private title');

  const edited = await store.updateTask(created.task.id, { title: 'Edited title' });
  assert.equal(edited.ok, true);
  assert.equal(store.getTask(created.task.id).title, 'Edited title');

  const completed = await store.completeTask(created.task.id);
  assert.equal(completed.ok, true);
  assert.equal(store.getTask(created.task.id).status, 'completed');
  assert.ok(store.getTask(created.task.id).completedAt);

  const deleted = await store.deleteTask(created.task.id, { confirmed: true });
  assert.equal(deleted.ok, true);
  assert.equal(store.getTask(created.task.id), null);
  assert.equal(queue.diagnostics().filter((entry) => entry.status === 'pending').length, 4);
});

test('local mutation queue entries are deduplicated by stable idempotency key', async () => {
  const { store, queue } = createStore();
  const created = await store.createTask({ title: 'Task', dueDate: '2025-01-15' });
  const first = queue.diagnostics();
  await queue.retry(first[0].idempotencyKey);
  await queue.enqueue(first[0]);
  assert.equal(queue.diagnostics().length, 1);
  assert.equal(queue.diagnostics()[0].idempotencyKey, first[0].idempotencyKey);
  assert.equal(created.ok, true);
});
