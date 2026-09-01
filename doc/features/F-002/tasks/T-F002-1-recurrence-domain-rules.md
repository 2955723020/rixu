---
id: "T-F002-1"
feature_id: "F-002"
slug: "recurrence-domain-rules"
title: "实现结构化重复规则与下一期日期计算"
status: "done"
depends_on: []
test_command: "npm test -- tests/domain/recurrence.test.js"
acceptance_criteria: ["calculateNextOccurrence 能正确计算 daily、weekly、monthly 和 custom(day/week/month) 的下一期日期。","weekly 规则能按 weekdays 选择下一指定星期，并支持 interval。","从 2025-01-31 计算 monthly 下一期得到 2025-02-28，再用同一结构化规则计算得到 2025-03-31；recurrence.anchorDay 始终为 31。","返回的 recurrence 是结构化对象而非展示文本，输入对象不会被修改。","无效 interval、unit、weekdays 或日期时返回可定位字段和明确修正动作的失败结果。","自动化测试覆盖每日、每周、每月、自定义周期以及月末锚点回归场景。"]
files_hint: ["src/domain/recurrence.js","tests/domain/recurrence.test.js"]
---

# T-F002-1 — 实现结构化重复规则与下一期日期计算

新增纯领域模块 src/domain/recurrence.js，基于现有 YYYY-MM-DD 任务日期实现每日、每周、每月和自定义重复规则。导出 calculateNextOccurrence({ dueDate, recurrence })，返回 { dueDate, recurrence }；规则使用结构化字段，daily 默认 interval=1，weekly 支持非空 weekdays 数组和可选 interval，monthly 保存 anchorDay，自定义必须包含正整数 interval 与 unit(day|week|month)。月度及按月自定义规则必须以原始 anchorDay 计算目标月份，目标月份不存在该日期时使用该月最后一天，但不得覆盖 anchorDay。对非法规则返回包含字段、错误码和修正动作的失败结果，不得猜测或静默修正。

## Acceptance criteria

- [ ] calculateNextOccurrence 能正确计算 daily、weekly、monthly 和 custom(day/week/month) 的下一期日期。
- [ ] weekly 规则能按 weekdays 选择下一指定星期，并支持 interval。
- [ ] 从 2025-01-31 计算 monthly 下一期得到 2025-02-28，再用同一结构化规则计算得到 2025-03-31；recurrence.anchorDay 始终为 31。
- [ ] 返回的 recurrence 是结构化对象而非展示文本，输入对象不会被修改。
- [ ] 无效 interval、unit、weekdays 或日期时返回可定位字段和明确修正动作的失败结果。
- [ ] 自动化测试覆盖每日、每周、每月、自定义周期以及月末锚点回归场景。
