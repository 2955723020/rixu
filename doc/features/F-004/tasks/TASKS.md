# F-004 — Tasks

| ID | Title | Status | Depends on | Test |
| --- | --- | --- | --- | --- |
| T-F004-1 | 完善任务组织属性与筛选排序 | ✅ done | — | npm test -- tests/domain/task-organization.test.js tests/query/organization-filters.test.js tests/domain/task.test.js tests/storage/task-repository.test.js |
| T-F004-2 | 实现个人清单生命周期与显式删除策略 | ✅ done | T-F004-1 | npm test -- tests/domain/organization.test.js tests/storage/list-repository.test.js tests/storage/task-repository.test.js |
| T-F004-3 | 实现子任务关系与父任务完成门禁 | ✅ done | T-F004-1 | npm test -- tests/domain/subtask.test.js tests/storage/task-repository.test.js |

