---
id: "T-F006-2"
feature_id: "F-006"
slug: "deterministic-multi-device-convergence"
title: "实现确定性冲突解决与多设备收敛同步"
status: "done"
depends_on: ["T-F006-1"]
test_command: "npm test -- tests/sync/conflict-resolver.test.js tests/sync/sync-coordinator.test.js"
acceptance_criteria: ["Given two device replicas changing the same record, conflict resolution selects one deterministic winner using `updatedAt` and stable device identity, and both replicas contain byte-equivalent winning task/list data after synchronization.","Concurrent changes to task fields, completion status and completedAt, recurrence, and organization attributes are resolved as part of the same full-record snapshot rather than partially merged inconsistently.","A delete is represented by a durable tombstone/version, wins or loses by the same conflict ordering, and cannot be resurrected by an older retry or pull.","Running synchronization repeatedly with the same remote responses and queued operations is idempotent: no duplicate task, list, or recurrence instance is created.","The coordinator can process pending uploads, apply remote updates, and retry after transient adapter failures without discarding local changes."]
files_hint: ["src/sync/conflict-resolver.js","src/sync/sync-coordinator.js","src/storage/local-store.js","src/sync/cloud-adapter.js","tests/sync/conflict-resolver.test.js","tests/sync/sync-coordinator.test.js"]
---

# T-F006-2 — 实现确定性冲突解决与多设备收敛同步

Implement `ConflictResolver` and a sync coordinator that exchange task and list snapshots through the cloud adapter, apply remote changes to `LocalStore`, and continue until local pending work and remote pulls converge. Resolve concurrent versions deterministically by newest comparable `updatedAt`, then stable `deviceId` (and a stable operation/record tie-breaker when both are equal), always selecting the complete winning snapshot. Preserve tombstones for deletes, synchronize status/completedAt, recurrence, listId, tags, priority, parentId, and other task fields, and make push/pull application idempotent so retries cannot create duplicate tasks or repeated instances.

## Acceptance criteria

- [ ] Given two device replicas changing the same record, conflict resolution selects one deterministic winner using `updatedAt` and stable device identity, and both replicas contain byte-equivalent winning task/list data after synchronization.
- [ ] Concurrent changes to task fields, completion status and completedAt, recurrence, and organization attributes are resolved as part of the same full-record snapshot rather than partially merged inconsistently.
- [ ] A delete is represented by a durable tombstone/version, wins or loses by the same conflict ordering, and cannot be resurrected by an older retry or pull.
- [ ] Running synchronization repeatedly with the same remote responses and queued operations is idempotent: no duplicate task, list, or recurrence instance is created.
- [ ] The coordinator can process pending uploads, apply remote updates, and retry after transient adapter failures without discarding local changes.
