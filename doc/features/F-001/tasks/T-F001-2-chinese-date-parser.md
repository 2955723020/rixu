---
id: "T-F001-2"
feature_id: "F-001"
slug: "chinese-date-parser"
title: "实现可确认的中文自然语言日期解析"
status: "done"
depends_on: ["T-F001-1"]
test_command: "npm test -- tests/domain/date-parser.test.js"
acceptance_criteria: ["在固定当前时刻和 Asia/Shanghai 时区下解析“明天下午3点”，返回 success、下一本地日的 YYYY-MM-DD、15:00 和 null 的重复规则，覆盖 TC-TASK-3。","相同绝对当前时刻在不同时区解析时，以各自本地日期计算“明天”，不得使用进程默认时区。","解析返回值包含原始文本及独立的结构化日期、时间、重复信息和状态，调用方可修改该草稿后再提交，解析器本身不写入任务仓储。","仅识别到部分日期时间信息时返回 partial，明确列出需要手动补充的字段，不升级为 success。","无法识别的输入返回 failure、manual-date-time 下一步动作以及空的日期和时间结果，不生成默认日期，覆盖 TC-TASK-4。","日期解析测试通过注入当前时刻保持确定性，并覆盖 success、partial、failure 三种状态。"]
files_hint: ["src/domain/date-parser.js","src/domain/timezone.js","tests/domain/date-parser.test.js"]
---

# T-F001-2 — 实现可确认的中文自然语言日期解析

基于前置任务的本地日期和时区工具实现纯领域日期解析器。解析接口接收原始中文文本、可注入的当前绝对时刻和 IANA 时区，返回结构化的 dueDate、可选时间、结构化 recurrence、原始文本以及 success、partial、failure 三态状态。至少识别“明天下午3点”：先将当前时刻转换为给定时区的本地日期，再得到下一日 15:00。解析结果只形成可由调用方展示和编辑的草稿，不直接创建或保存任务。信息不完整时返回 partial 并列出待补字段；无法识别时返回 failure 和手动日期时间输入动作，日期、时间及重复信息均不得由猜测产生。

## Acceptance criteria

- [ ] 在固定当前时刻和 Asia/Shanghai 时区下解析“明天下午3点”，返回 success、下一本地日的 YYYY-MM-DD、15:00 和 null 的重复规则，覆盖 TC-TASK-3。
- [ ] 相同绝对当前时刻在不同时区解析时，以各自本地日期计算“明天”，不得使用进程默认时区。
- [ ] 解析返回值包含原始文本及独立的结构化日期、时间、重复信息和状态，调用方可修改该草稿后再提交，解析器本身不写入任务仓储。
- [ ] 仅识别到部分日期时间信息时返回 partial，明确列出需要手动补充的字段，不升级为 success。
- [ ] 无法识别的输入返回 failure、manual-date-time 下一步动作以及空的日期和时间结果，不生成默认日期，覆盖 TC-TASK-4。
- [ ] 日期解析测试通过注入当前时刻保持确定性，并覆盖 success、partial、failure 三种状态。
