---
id: "T-F001-1"
feature_id: "F-001"
slug: "task-model-and-repository"
title: "建立任务领域模型、时区规则与 CRUD 仓储"
status: "done"
depends_on: []
test_command: "npm test -- tests/domain/task.test.js tests/domain/timezone.test.js tests/storage/task-repository.test.js"
acceptance_criteria: ["package.json 提供 npm test 命令，并且领域测试可在无网络环境下重复运行。","创建任务要求非空标题和 YYYY-MM-DD 截止日期，生成稳定唯一 ID，并可按 ID 读取全部 Task 必需字段；初始状态为未完成，completedAt 为 null。","起始时间和结束时间均可省略；提供本地日期时间与 IANA 时区之间的转换，存储为 ISO 8601 绝对时刻并可按任务时区还原展示，切换展示时区不会改变绝对时刻。","同时提供起止时间且结束时间早于起始时间时，创建或更新返回定位到 endAt 的字段错误和明确修正动作，仓储保持不变且结果保留原始输入。","夏令时跳变造成的无效本地时间会返回对应时间字段错误，不得自动调整或保存；至少覆盖 America/New_York 的春季跳时用例。","更新允许修改业务字段并产生晚于原值的 updatedAt，同时保持 id 和 createdAt 不变。","删除必须传入显式确认；未确认时任务仍可读取，确认后仅目标任务被删除，重复删除不影响其他任务且不产生额外副作用。","自动化测试覆盖 TC-TASK-1、TC-TASK-2，以及创建、更新、删除隔离、确认边界、时区往返和无效夏令时时间。"]
files_hint: ["package.json","src/domain/task.js","src/domain/timezone.js","src/storage/task-repository.js","tests/domain/task.test.js","tests/domain/timezone.test.js","tests/storage/task-repository.test.js"]
---

# T-F001-1 — 建立任务领域模型、时区规则与 CRUD 仓储

在文档仓库中建立零外部依赖的 Node.js ESM 项目和可重复运行的 node:test 测试命令。实现 Task 领域模型、日期时间转换与本地仓储接口：Task 必须包含 id、title、dueDate、startAt、endAt、timezone、status、completedAt、recurrence、listId、tags、priority、parentId、createdAt、updatedAt；dueDate 使用 YYYY-MM-DD 保存本地日历日期，可选起止时间由本地日期时间和 IANA 时区转换为可比较的 ISO 8601 绝对时刻，展示时可转换回指定时区。创建和更新采用可注入的时钟及 ID 生成器以支持确定性测试，校验失败返回包含字段名、修正动作和原始输入的结果且不得写入仓储。删除 API 必须要求显式确认，未确认时拒绝删除，重复删除保持幂等。仅建立后续特性所需的数据字段，不实现完成切换、重复生成、组织管理或同步行为。

## Acceptance criteria

- [ ] package.json 提供 npm test 命令，并且领域测试可在无网络环境下重复运行。
- [ ] 创建任务要求非空标题和 YYYY-MM-DD 截止日期，生成稳定唯一 ID，并可按 ID 读取全部 Task 必需字段；初始状态为未完成，completedAt 为 null。
- [ ] 起始时间和结束时间均可省略；提供本地日期时间与 IANA 时区之间的转换，存储为 ISO 8601 绝对时刻并可按任务时区还原展示，切换展示时区不会改变绝对时刻。
- [ ] 同时提供起止时间且结束时间早于起始时间时，创建或更新返回定位到 endAt 的字段错误和明确修正动作，仓储保持不变且结果保留原始输入。
- [ ] 夏令时跳变造成的无效本地时间会返回对应时间字段错误，不得自动调整或保存；至少覆盖 America/New_York 的春季跳时用例。
- [ ] 更新允许修改业务字段并产生晚于原值的 updatedAt，同时保持 id 和 createdAt 不变。
- [ ] 删除必须传入显式确认；未确认时任务仍可读取，确认后仅目标任务被删除，重复删除不影响其他任务且不产生额外副作用。
- [ ] 自动化测试覆盖 TC-TASK-1、TC-TASK-2，以及创建、更新、删除隔离、确认边界、时区往返和无效夏令时时间。
