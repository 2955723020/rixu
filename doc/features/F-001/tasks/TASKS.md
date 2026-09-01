# F-001 — Tasks

| ID | Title | Status | Depends on | Test |
| --- | --- | --- | --- | --- |
| T-F001-1 | 建立任务领域模型、时区规则与 CRUD 仓储 | ✅ done | — | npm test -- tests/domain/task.test.js tests/domain/timezone.test.js tests/storage/task-repository.test.js |
| T-F001-2 | 实现可确认的中文自然语言日期解析 | ✅ done | T-F001-1 | npm test -- tests/domain/date-parser.test.js |

