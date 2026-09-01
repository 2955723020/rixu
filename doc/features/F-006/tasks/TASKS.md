# F-006 — Tasks

| ID | Title | Status | Depends on | Test |
| --- | --- | --- | --- | --- |
| T-F006-1 | 建立本地优先存储与幂等同步队列 | ✅ done | — | npm test -- tests/sync/local-store.test.js tests/sync/sync-queue.test.js |
| T-F006-2 | 实现确定性冲突解决与多设备收敛同步 | ✅ done | T-F006-1 | npm test -- tests/sync/conflict-resolver.test.js tests/sync/sync-coordinator.test.js |

