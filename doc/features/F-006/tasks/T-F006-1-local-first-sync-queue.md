---
id: "T-F006-1"
feature_id: "F-006"
slug: "local-first-sync-queue"
title: "建立本地优先存储与幂等同步队列"
status: "done"
depends_on: []
test_command: "npm test -- tests/sync/local-store.test.js tests/sync/sync-queue.test.js"
acceptance_criteria: ["With an adapter that is offline or throws, task create, edit, delete, and complete calls return the locally committed result immediately and remain readable from `LocalStore`.","Each local mutation creates exactly one pending queue entry keyed by a stable idempotency key; submitting or retrying the same operation again does not add another entry.","When the adapter succeeds, the queue operation is acknowledged and removed or marked succeeded, and its diagnostic status is no longer pending.","When upload fails, the local record is unchanged, the queue entry remains retryable with an actionable failure state, and a later retry can process it after connectivity returns.","Queue diagnostics distinguish pending, succeeded, and failed operations and serialized diagnostics contain no task title or other task-content fields."]
files_hint: ["src/storage/local-store.js","src/sync/sync-queue.js","src/sync/cloud-adapter.js","tests/sync/local-store.test.js","tests/sync/sync-queue.test.js"]
---

# T-F006-1 — 建立本地优先存储与幂等同步队列

Implement `LocalStore` as the offline-capable write facade over the existing task/list repositories, preserving their validation, cloning, timestamps, completion state, recurrence, and organization fields. Every successful create, update, delete, or completion mutation must be committed locally before enqueueing a sync operation containing account ID, stable device ID, entity ID, operation type, payload or tombstone, updatedAt, and a deterministic idempotency key. Implement `SyncQueue` and a transport-neutral `CloudAdapter` contract with pending, succeeded, and failed diagnostics, asynchronous processing, automatic/manual retry, failure retention, and deduplication of repeated operation submissions or retries. Keep logs free of task titles and other sensitive payload fields.

## Acceptance criteria

- [ ] With an adapter that is offline or throws, task create, edit, delete, and complete calls return the locally committed result immediately and remain readable from `LocalStore`.
- [ ] Each local mutation creates exactly one pending queue entry keyed by a stable idempotency key; submitting or retrying the same operation again does not add another entry.
- [ ] When the adapter succeeds, the queue operation is acknowledged and removed or marked succeeded, and its diagnostic status is no longer pending.
- [ ] When upload fails, the local record is unchanged, the queue entry remains retryable with an actionable failure state, and a later retry can process it after connectivity returns.
- [ ] Queue diagnostics distinguish pending, succeeded, and failed operations and serialized diagnostics contain no task title or other task-content fields.
