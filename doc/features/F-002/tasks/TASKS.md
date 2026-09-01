# F-002 — Tasks

| ID | Title | Status | Depends on | Test |
| --- | --- | --- | --- | --- |
| T-F002-1 | 实现结构化重复规则与下一期日期计算 | ✅ done | — | npm test -- tests/domain/recurrence.test.js |
| T-F002-2 | 实现完成状态机、重复实例生成与即时反馈 | ✅ done | T-F002-1 | npm test -- tests/application/completion.test.js tests/domain/recurrence.test.js tests/domain/task.test.js tests/storage/task-repository.test.js |

