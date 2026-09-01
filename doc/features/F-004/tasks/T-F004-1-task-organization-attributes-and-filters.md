---
id: "T-F004-1"
feature_id: "F-004"
slug: "task-organization-attributes-and-filters"
title: "完善任务组织属性与筛选排序"
status: "done"
depends_on: []
test_command: "npm test -- tests/domain/task-organization.test.js tests/query/organization-filters.test.js tests/domain/task.test.js tests/storage/task-repository.test.js"
acceptance_criteria: ["不传 listId、tags、priority、parentId 时，现有最小任务输入仍可一次 create 调用成功保存，并得到 null、空数组和 none 默认值。","同一任务可保存至少两个标签；添加已有标签不产生重复值，移除标签后按该标签筛选不再返回任务。","非法标签集合或非法优先级在创建和更新时返回对应字段及修正动作，更新失败时仓储内容保持不变。","low、medium、high、urgent 四级优先级均可保存和筛选；优先级排序顺序固定为 urgent、high、medium、low、none，等级相同时保持原输入顺序。","按 listId、标签或优先级筛选及排序不会改变源任务的 dueDate、startAt、endAt、recurrence 或组织属性。"]
files_hint: ["src/domain/task.js","src/storage/task-repository.js","src/query/organization-filters.js","tests/domain/task-organization.test.js","tests/query/organization-filters.test.js","tests/storage/task-repository.test.js"]
---

# T-F004-1 — 完善任务组织属性与筛选排序

基于现有 Task 模型和 TaskRepository 完善可选组织属性。创建和更新任务时校验 tags 为不重复的非空字符串数组，priority 仅允许 none、low、medium、high、urgent，其中 low、medium、high、urgent 构成四级有效优先级，listId 和 parentId 保持可选；不提供任何组织属性时继续沿用 listId=null、tags=[]、priority=none、parentId=null 的快速创建流程。提供幂等的标签添加和移除能力，并新增纯查询模块，支持按 listId、单个标签和优先级筛选，以及按 urgent、high、medium、low、none 排序；同优先级任务保持输入顺序，查询不得修改任务、日期或重复规则。覆盖 TC-ORG-2、TC-ORG-3 以及无组织属性创建回归测试。

## Acceptance criteria

- [ ] 不传 listId、tags、priority、parentId 时，现有最小任务输入仍可一次 create 调用成功保存，并得到 null、空数组和 none 默认值。
- [ ] 同一任务可保存至少两个标签；添加已有标签不产生重复值，移除标签后按该标签筛选不再返回任务。
- [ ] 非法标签集合或非法优先级在创建和更新时返回对应字段及修正动作，更新失败时仓储内容保持不变。
- [ ] low、medium、high、urgent 四级优先级均可保存和筛选；优先级排序顺序固定为 urgent、high、medium、low、none，等级相同时保持原输入顺序。
- [ ] 按 listId、标签或优先级筛选及排序不会改变源任务的 dueDate、startAt、endAt、recurrence 或组织属性。
