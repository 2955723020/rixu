import assert from 'node:assert/strict';
import test from 'node:test';

import { SyncQueue } from '../../src/sync/sync-queue.js';

test('acknowledges successful uploads and exposes non-pending diagnostics', async () => {
  const uploaded = [];
  const queue = new SyncQueue({
    accountId: 'account-1',
    deviceId: 'device-a',
    adapter: { upload: async (operation) => uploaded.push(operation) },
  });
  const operation = {
    entityId: 'task-1',
    operationType: 'update',
    payload: { title: 'Sensitive title' },
    updatedAt: '2025-01-10T08:00:00.000Z',
  };
  await queue.enqueue(operation);
  await queue.process();
  assert.equal(uploaded.length, 1);
  assert.equal(queue.diagnostics()[0].status, 'succeeded');
  assert.equal(queue.diagnostics()[0].pending, false);
});

test('retains failed uploads as retryable and diagnostics never contain task content', async () => {
  let online = false;
  const queue = new SyncQueue({
    accountId: 'account-1',
    deviceId: 'device-a',
    adapter: {
      upload: async () => {
        if (!online) throw new Error('offline');
      },
    },
  });
  await queue.enqueue({
    entityId: 'task-1',
    operationType: 'update',
    payload: { title: 'Sensitive title', tags: ['secret'] },
    updatedAt: '2025-01-10T08:00:00.000Z',
  });
  await queue.process();
  const failed = queue.diagnostics()[0];
  assert.equal(failed.status, 'failed');
  assert.equal(failed.retryable, true);
  assert.match(failed.action, /retry|connect|network/i);
  assert.ok(!JSON.stringify(queue.serializeDiagnostics()).includes('Sensitive title'));
  assert.ok(!JSON.stringify(queue.serializeDiagnostics()).includes('secret'));

  online = true;
  await queue.retry(failed.idempotencyKey);
  assert.equal(queue.diagnostics()[0].status, 'succeeded');
});
