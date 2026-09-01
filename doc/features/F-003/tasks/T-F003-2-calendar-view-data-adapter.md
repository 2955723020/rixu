---
id: "T-F003-2"
feature_id: "F-003"
slug: "calendar-view-data-adapter"
title: "实现按截止日期分组的日历视图数据适配器"
status: "done"
depends_on: ["T-F003-1"]
test_command: "npm test -- tests/query/calendar-view.test.js"
acceptance_criteria: ["给定多条不同截止日期任务时，日历索引为每个 `YYYY-MM-DD` 日期生成任务集合；选择某日期只返回该日期任务，其他日期任务不混入。","日历索引和日期选择保留任务原始字段及输入顺序，并允许已完成与未完成任务同时按截止日期展示。","选择有效日期返回可创建标志和带有该日期的创建草稿；读取空日期单元格时返回空任务集合但仍允许创建。","无截止日期或无效截止日期任务不会出现在任何日历日期集合中。","构建索引、读取日期和切换选择日期不会改变输入任务数组以及任务的 `dueDate`、`startAt`、`endAt`、`recurrence` 或 `status`。"]
files_hint: ["src/query/calendar-view.js","tests/query/calendar-view.test.js","src/query/task-views.js"]
---

# T-F003-2 — 实现按截止日期分组的日历视图数据适配器

新增 `src/query/calendar-view.js`，实现纯数据适配函数 `buildCalendarIndex(tasks)`、`getCalendarTasks(tasks, dueDate)` 和 `selectCalendarDate(tasks, dueDate)`。日历索引使用可序列化的对象或等价明确结构，将所有具有有效非空 `dueDate` 的任务映射到对应日期键，保留输入顺序并包含已完成和未完成任务；无截止日期或无效日期的任务不得进入索引。按日期读取时只返回该日期任务的副本。选择日期必须返回 `{ date, tasks, canCreate: true, createTaskInput: { dueDate: date } }` 形式的数据，使调用方既能进入该日期任务详情，也能以该日期进入创建流程。不得引入 DOM、框架或路由依赖，并且任何索引、筛选或选择操作都不能修改源任务的状态、日期、时间或重复规则。

## Acceptance criteria

- [ ] 给定多条不同截止日期任务时，日历索引为每个 `YYYY-MM-DD` 日期生成任务集合；选择某日期只返回该日期任务，其他日期任务不混入。
- [ ] 日历索引和日期选择保留任务原始字段及输入顺序，并允许已完成与未完成任务同时按截止日期展示。
- [ ] 选择有效日期返回可创建标志和带有该日期的创建草稿；读取空日期单元格时返回空任务集合但仍允许创建。
- [ ] 无截止日期或无效截止日期任务不会出现在任何日历日期集合中。
- [ ] 构建索引、读取日期和切换选择日期不会改变输入任务数组以及任务的 `dueDate`、`startAt`、`endAt`、`recurrence` 或 `status`。
