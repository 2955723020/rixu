# F-003 — Tasks

| ID | Title | Status | Depends on | Test |
| --- | --- | --- | --- | --- |
| T-F003-1 | 实现今日、未来、逾期和已完成任务查询 | ✅ done | — | npm test -- tests/query/task-views.test.js |
| T-F003-2 | 实现按截止日期分组的日历视图数据适配器 | ✅ done | T-F003-1 | npm test -- tests/query/calendar-view.test.js |

