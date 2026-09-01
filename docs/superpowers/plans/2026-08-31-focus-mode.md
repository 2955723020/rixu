# 日序专注模式实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为日序 Web 前端实现可关联任务或临时主题的番茄钟、自由计时、沉浸界面、暂停恢复、手动休息和独立专注统计。

**Architecture:** 新建 `web/src/focus/` 独立模块，纯状态机负责所有时间与转换规则，独立 Zustand Store 使用 `rixu-focus:v1` 持久化设置、活动会话与历史。现有任务 Store 不增加专注字段，应用层只通过可选 `taskId` 和标题快照连接两个模块。

**Tech Stack:** React、Zustand persist、Vitest、React Testing Library、Playwright、Lucide React、Web Audio API、现有 Tailwind/CSS 体系。

**Spec:** `docs/superpowers/specs/2026-08-31-focus-mode-design.md`

## Global Constraints

- 只修改 `web/`、`README.md` 与本计划的勾选状态，不修改根目录 `src/` 和 `tests/`。
- 专注 Store 固定使用 `rixu-focus:v1`；现有任务 Store 继续使用 `rixu:v1`。
- 同一时间最多一个活动会话；重复开始必须返回并打开现有会话。
- 刷新恢复为暂停，关闭期间不计时；计时依据绝对时间戳，不按 interval 次数累加。
- 专注记录不自动修改任务完成状态，删除任务不删除专注历史。
- 番茄专注时长为 1 至 180 分钟，休息时长为 1 至 60 分钟。
- 提示音失败不得影响状态转换或记录保存。
- 不新增第三方依赖，不使用浏览器 Fullscreen API，不申请系统通知权限。
- 所有行为变更严格执行 RED → GREEN；每个任务完成后运行对应测试。
- 当前目录不是有效 Git 仓库，计划中的提交步骤改为记录验证结果，不执行 `git commit`。

---

## 文件结构与职责

**新增文件**

- `web/src/focus/focus-machine.js`：纯状态转换、时间计算、输入校验和记录创建。
- `web/src/focus/focus-machine.test.js`：状态机边界与幂等测试。
- `web/src/focus/focus-selectors.js`：按用户时区计算专注汇总。
- `web/src/focus/focus-selectors.test.js`：日期、周和主题分布测试。
- `web/src/focus/focus-store.js`：独立 Zustand Store、持久化、刷新归一化。
- `web/src/focus/focus-store.test.js`：Store 动作和持久化测试。
- `web/src/focus/FocusSetupDialog.jsx`：开始前模式、主题、任务和时长配置。
- `web/src/focus/FocusSetupDialog.test.jsx`：配置弹窗交互测试。
- `web/src/focus/FocusSession.jsx`：沉浸式专注、完成结果、休息和确认框。
- `web/src/focus/FocusSession.test.jsx`：会话控制与键盘测试。
- `web/src/focus/FocusMiniBar.jsx`：退出沉浸模式后的活动会话条。
- `web/src/focus/focus-audio.js`：Web Audio 双音提示。
- `web/src/focus/FocusStatsPage.jsx`：独立专注统计页。
- `web/src/focus/FocusStatsPage.test.jsx`：统计页面渲染测试。

**修改文件**

- `web/src/App.jsx`、`web/src/App.test.jsx`：协调专注弹窗、沉浸层、迷你条和统计页。
- `web/src/components/Topbar.jsx`：无任务专注入口。
- `web/src/components/TaskItem.jsx`：关联任务的专注入口。
- `web/src/pages/TaskListPage.jsx`：把任务专注事件传回 App。
- `web/src/components/Sidebar.jsx`：专注统计导航。
- `web/src/styles.css`：专注模块的桌面、移动、暗色与 reduced-motion 样式。
- `web/e2e/app.spec.js`：桌面番茄与移动自由计时流程。
- `README.md`：专注模式使用说明与数据位置。

---

### Task 1: 纯专注状态机

**Files:**
- Create: `web/src/focus/focus-machine.js`
- Test: `web/src/focus/focus-machine.test.js`

**Interfaces:**
- Produces: `DEFAULT_FOCUS_SETTINGS`
- Produces: `createFocusSession(input, deps) -> { ok, session } | { ok:false, errors }`
- Produces: `getElapsedMs(session, now) -> number`
- Produces: `pauseSession(session, now) -> session`
- Produces: `resumeSession(session, now) -> session`
- Produces: `finishFocus(session, { now, outcome, recordIdGenerator }) -> { session, record, changed }`
- Produces: `completeDuePhase(session, { now, recordIdGenerator }) -> { session, record, changed, sound }`
- Produces: `startBreak(session, now) -> session`
- Produces: `completeBreakIfDue(session, now) -> { session, changed, sound }`
- Produces: `normalizeHydratedSession(session) -> session | null`

- [x] **Step 1: 写状态机失败测试**

测试使用字面量时间和固定 ID，覆盖：番茄创建、自由计时、主题/时长校验、暂停继续、系统时间回退、番茄到点只产一条记录、提前结束、手动休息及刷新归一化。

```js
import { describe, expect, it } from 'vitest';
import {
  completeDuePhase,
  createFocusSession,
  getElapsedMs,
  normalizeHydratedSession,
  pauseSession,
  resumeSession,
  startBreak,
} from './focus-machine.js';

const at = (value) => new Date(value);

it('calculates elapsed time from timestamps across pause and resume', () => {
  const created = createFocusSession(
    { mode: 'stopwatch', subjectSnapshot: '阅读' },
    { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
  );
  const paused = pauseSession(created.session, at('2026-08-31T08:05:00Z'));
  const resumed = resumeSession(paused, at('2026-08-31T08:10:00Z'));
  expect(getElapsedMs(resumed, at('2026-08-31T08:12:00Z'))).toBe(420000);
});

it('completes one pomodoro record idempotently', () => {
  const { session } = createFocusSession(
    { mode: 'pomodoro', subjectSnapshot: '评审', focusMinutes: 1, breakMinutes: 5 },
    { now: at('2026-08-31T08:00:00Z'), idGenerator: () => 'session-1' },
  );
  const first = completeDuePhase(session, {
    now: at('2026-08-31T08:01:05Z'),
    recordIdGenerator: () => 'record-1',
  });
  const second = completeDuePhase(first.session, {
    now: at('2026-08-31T08:02:00Z'),
    recordIdGenerator: () => 'record-2',
  });
  expect(first.record).toMatchObject({ id: 'record-1', focusedMs: 60000, outcome: 'completed' });
  expect(second).toMatchObject({ record: null, changed: false });
});

it('hydrates a running session as paused without adding closed-page time', () => {
  const running = { status: 'running', accumulatedMs: 120000, resumedAt: '2026-08-31T08:02:00.000Z' };
  expect(normalizeHydratedSession(running)).toMatchObject({ status: 'paused', accumulatedMs: 120000, resumedAt: null });
});
```

- [x] **Step 2: 运行测试确认 RED**

Run: `cd web && npm test -- --run src/focus/focus-machine.test.js`

Expected: FAIL，提示无法解析 `./focus-machine.js`。

- [x] **Step 3: 实现最小纯状态机**

实现要点：

```js
export const DEFAULT_FOCUS_SETTINGS = Object.freeze({
  focusMinutes: 25,
  breakMinutes: 5,
  lastMode: 'pomodoro',
});

export function getElapsedMs(session, now) {
  const base = Math.max(0, Number(session.accumulatedMs) || 0);
  if (session.status !== 'running' || !session.resumedAt) return base;
  return base + Math.max(0, new Date(now).getTime() - Date.parse(session.resumedAt));
}
```

创建会话时把 `startedAt`、`resumedAt` 写为相同 ISO 时间；番茄 `targetMs = focusMinutes * 60000`，自由计时为 `null`。`finishFocus` 用 `recordId` 判重，并保存 `subjectSnapshot`、`sessionId`、`taskId`、`startedAt`、`endedAt`、`focusedMs`、`mode`、`outcome`。

- [x] **Step 4: 运行状态机测试确认 GREEN**

Run: `cd web && npm test -- --run src/focus/focus-machine.test.js`

Expected: 所有状态机测试 PASS，无控制台错误。

- [x] **Step 5: 记录任务验证结果**

已完成：状态机测试 9/9 通过；完整 Web 回归测试 30/30 通过。不执行提交，因为当前目录不是 Git 仓库。

---

### Task 2: 专注统计选择器

**Files:**
- Create: `web/src/focus/focus-selectors.js`
- Test: `web/src/focus/focus-selectors.test.js`
- Read: `web/src/lib/clock.js`

**Interfaces:**
- Consumes: 历史记录 `{ id, taskId, subjectSnapshot, mode, endedAt, focusedMs, outcome }[]`
- Produces: `getFocusSummary(records, { now, timeZone })`
- Returns: `{ todayMs, todayPomodoros, weekMs, lastSevenDays, bySubject, recent }`

- [x] **Step 1: 写跨时区统计失败测试**

```js
it('groups focus records by the user local day and Monday-based week', () => {
  const records = [
    { id: 'a', taskId: 'task-1', subjectSnapshot: '评审', mode: 'pomodoro', outcome: 'completed', focusedMs: 1500000, endedAt: '2026-08-31T16:30:00.000Z' },
    { id: 'b', taskId: null, subjectSnapshot: '阅读', mode: 'stopwatch', outcome: 'stopped-early', focusedMs: 300000, endedAt: '2026-08-30T15:30:00.000Z' },
  ];
  const summary = getFocusSummary(records, {
    now: '2026-08-31T17:00:00.000Z',
    timeZone: 'Asia/Shanghai',
  });
  expect(summary.todayMs).toBe(1500000);
  expect(summary.todayPomodoros).toBe(1);
  expect(summary.weekMs).toBe(1500000);
  expect(summary.lastSevenDays.at(-1)).toEqual({ date: '2026-09-01', focusedMs: 1500000 });
  expect(summary.bySubject[0]).toMatchObject({ key: 'task:task-1', subject: '评审', focusedMs: 1500000 });
});
```

- [x] **Step 2: 运行测试确认 RED**

Run: `cd web && npm test -- --run src/focus/focus-selectors.test.js`

Expected: FAIL，提示统计模块不存在。

- [x] **Step 3: 实现统计选择器**

使用 `getLocalDateKey` 和 `shiftDateKey` 生成连续七天；用本地日期的 UTC weekday 计算周一日期：

```js
const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
const monday = shiftDateKey(today, -((weekday + 6) % 7));
```

`bySubject` 的 key 对任务为 `task:${taskId}`，临时主题为 `subject:${subjectSnapshot}`；按 `focusedMs` 降序。`recent` 按 `endedAt` 降序，不修改输入数组。

- [x] **Step 4: 运行统计测试确认 GREEN**

Run: `cd web && npm test -- --run src/focus/focus-selectors.test.js`

Expected: PASS。

- [x] **Step 5: 记录任务验证结果**

已完成：统计选择器测试 2/2 通过，覆盖用户时区日期、周一周界、七日连续数据、稳定主题分组、最新任务标题快照与输入不变性。

---

### Task 3: 独立 Focus Store 与持久化

**Files:**
- Create: `web/src/focus/focus-store.js`
- Test: `web/src/focus/focus-store.test.js`

**Interfaces:**
- Consumes: Task 1 的全部状态机函数。
- Produces: `FOCUS_STORAGE_KEY = 'rixu-focus:v1'`
- Produces: `createFocusStore({ clock, idGenerator, recordIdGenerator, persist })`
- Produces: `useFocusStore`
- Store actions: `startSession`, `pause`, `resume`, `tick`, `finishEarly`, `startBreak`, `skipBreak`, `clearCompleted`, `settleForHide`

- [x] **Step 1: 写 Store 行为和刷新失败测试**

```js
it('keeps one active session and persists completed focus history', () => {
  let now = new Date('2026-08-31T08:00:00Z');
  const store = createFocusStore({
    clock: () => now,
    idGenerator: () => 'session-1',
    recordIdGenerator: () => 'record-1',
    persist: false,
  });
  expect(store.getState().startSession({ mode: 'pomodoro', subjectSnapshot: '写方案', focusMinutes: 1, breakMinutes: 5 }).ok).toBe(true);
  expect(store.getState().startSession({ mode: 'stopwatch', subjectSnapshot: '第二条' })).toMatchObject({ ok: false, code: 'SESSION_ACTIVE' });
  now = new Date('2026-08-31T08:01:00Z');
  store.getState().tick();
  expect(store.getState().records).toHaveLength(1);
  expect(store.getState().activeSession.status).toBe('focus-complete');
});

it('rehydrates a running session as paused', () => {
  localStorage.setItem('rixu-focus:v1', JSON.stringify({
    state: {
      settings: { focusMinutes: 25, breakMinutes: 5, lastMode: 'pomodoro' },
      activeSession: { id: 'session-1', status: 'running', phase: 'focus', accumulatedMs: 90000, resumedAt: '2026-08-31T08:01:30.000Z' },
      records: [],
    },
    version: 0,
  }));
  const store = createFocusStore({ persist: true });
  expect(store.getState().activeSession).toMatchObject({ status: 'paused', accumulatedMs: 90000, resumedAt: null });
});
```

- [x] **Step 2: 运行 Store 测试确认 RED**

Run: `cd web && npm test -- --run src/focus/focus-store.test.js`

Expected: FAIL，提示 Store 模块不存在。

- [x] **Step 3: 实现 Zustand Store**

使用 `persist` 和 `createJSONStorage(() => localStorage)`。`tick` 在专注阶段调用 `completeDuePhase`，若返回 record 则追加；休息阶段调用 `completeBreakIfDue`。`partialize` 只保存 `settings`、`activeSession` 和 `records`。

持久化合并必须对数据做安全归一化：

```js
merge(persisted, current) {
  const state = persisted && typeof persisted === 'object' ? persisted : {};
  return {
    ...current,
    settings: sanitizeSettings(state.settings),
    activeSession: normalizeHydratedSession(state.activeSession),
    records: Array.isArray(state.records) ? state.records.filter(isValidRecord) : [],
  };
}
```

`settleForHide` 对 running 状态调用 `pauseSession` 后持久化；若番茄已到点则走 `tick`，保证完成记录不丢失。

- [x] **Step 4: 运行 Focus Store 与现有任务 Store 测试**

Run: `cd web && npm test -- --run src/focus/focus-store.test.js src/store/task-store.test.js`

Expected: 两组测试全部 PASS；`rixu:v1` 与 `rixu-focus:v1` 互不覆盖。

- [x] **Step 5: 记录任务验证结果**

已完成：Focus Store 与现有任务 Store 联合测试 12/12 通过；覆盖单活动会话、到点幂等、刷新暂停、隐藏结算、暂停继续、提前结束、休息清理、损坏数据清洗与存储键隔离。

---

### Task 4: 开始专注弹窗与三个入口

**Files:**
- Create: `web/src/focus/FocusSetupDialog.jsx`
- Test: `web/src/focus/FocusSetupDialog.test.jsx`
- Modify: `web/src/components/Topbar.jsx`
- Modify: `web/src/components/TaskItem.jsx`
- Modify: `web/src/pages/TaskListPage.jsx`
- Modify: `web/src/components/Sidebar.jsx`
- Modify: `web/src/App.jsx`
- Modify: `web/src/App.test.jsx`

**Interfaces:**
- Consumes: `focusStoreHook((state) => state.startSession/settings/activeSession)`
- Produces: `FocusSetupDialog({ tasks, initialTask, settings, onStart, onClose })`
- App prop becomes: `App({ storeHook = useTaskStore, focusStoreHook = useFocusStore, now })`
- Task list prop becomes: `TaskListPage({ storeHook, now, onFocusTask })`

- [x] **Step 1: 写设置弹窗和入口失败测试**

覆盖两种模式、临时主题必填、任务标题回退、时长范围、成功开始，以及顶栏/任务行/侧栏入口。

```jsx
it('starts a temporary stopwatch and hides pomodoro duration controls', async () => {
  const user = userEvent.setup();
  const onStart = vi.fn(() => ({ ok: true }));
  render(<FocusSetupDialog tasks={[]} settings={{ focusMinutes: 25, breakMinutes: 5, lastMode: 'pomodoro' }} onStart={onStart} onClose={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: '自由计时' }));
  expect(screen.queryByLabelText('专注分钟')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('专注主题'), '阅读');
  await user.click(screen.getByRole('button', { name: '开始专注' }));
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ mode: 'stopwatch', taskId: null, subjectSnapshot: '阅读' }));
});
```

- [x] **Step 2: 运行组件测试确认 RED**

Run: `cd web && npm test -- --run src/focus/FocusSetupDialog.test.jsx src/App.test.jsx`

Expected: FAIL，提示弹窗不存在或入口按钮缺失。

- [x] **Step 3: 实现 FocusSetupDialog**

用现有模态样式与焦点管理模式；分段控件选择模式，`number` 输入配减/加图标按钮并带 `min/max`。任务选择器只列出顶层任务；有关联任务且主题为空时提交其标题，无任务时空主题显示字段错误。

- [x] **Step 4: 接入顶栏、任务行、侧栏和 App**

- Topbar 新增 `Timer` 图标按钮，`aria-label="开始专注"`。
- TaskItem 新增 `Play` 图标按钮，`aria-label="专注“${task.title}”"`，不得嵌入现有编辑按钮。
- Sidebar 新增 `{ id: 'focus-stats', label: '专注统计', icon: TimerReset }`。
- App 管理 `setupTask` 与 `immersiveOpen`；成功开始后关闭设置并打开沉浸层。
- 已有 `activeSession` 时点击开始入口只设置 `immersiveOpen = true`。

- [x] **Step 5: 运行入口与回归测试**

Run: `cd web && npm test -- --run src/focus/FocusSetupDialog.test.jsx src/App.test.jsx src/pages/TaskListPage.test.jsx`

Expected: 全部 PASS，现有编辑和完成行为不回归。

- [x] **Step 6: 记录任务验证结果**

已完成：设置弹窗、App 与任务列表入口测试 11/11 通过；覆盖模式切换、主题/时长校验、标题回退、顶栏、任务行、侧栏入口和模态焦点隔离。

---

### Task 5: 沉浸式会话、提示音与迷你计时条

**Files:**
- Create: `web/src/focus/FocusSession.jsx`
- Create: `web/src/focus/FocusSession.test.jsx`
- Create: `web/src/focus/FocusMiniBar.jsx`
- Create: `web/src/focus/focus-audio.js`
- Modify: `web/src/App.jsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes Store actions: `pause`, `resume`, `tick`, `finishEarly`, `startBreak`, `skipBreak`, `clearCompleted`, `settleForHide`.
- Produces: `FocusSession({ storeHook, onExitImmersive })`
- Produces: `FocusMiniBar({ storeHook, onOpenImmersive })`
- Produces: `playFocusChime() -> Promise<void>`，失败时 resolve，不向调用方抛错。

- [x] **Step 1: 写沉浸会话失败测试**

测试假时钟下的时间文字、暂停继续、Escape、空格、提前结束确认、番茄完成后的手动休息和自由计时无休息按钮。

```jsx
it('pauses with Space and exits immersive mode with Escape without ending', async () => {
  const user = userEvent.setup();
  const store = createFocusStore({ clock: () => new Date('2026-08-31T08:00:00Z'), persist: false });
  store.getState().startSession({ mode: 'stopwatch', subjectSnapshot: '阅读' });
  const onExitImmersive = vi.fn();
  render(<FocusSession storeHook={store} onExitImmersive={onExitImmersive} />);
  await user.keyboard(' ');
  expect(store.getState().activeSession.status).toBe('paused');
  await user.keyboard('{Escape}');
  expect(onExitImmersive).toHaveBeenCalledOnce();
  expect(store.getState().activeSession).not.toBeNull();
});
```

- [x] **Step 2: 运行会话测试确认 RED**

Run: `cd web && npm test -- --run src/focus/FocusSession.test.jsx`

Expected: FAIL，提示会话组件不存在。

- [x] **Step 3: 实现 FocusSession 和每秒 tick**

组件用 `useEffect` 建立 1000ms interval，只更新本地 `displayNow` 并调用 `tick()`；卸载清理 interval。添加 `pagehide` 和 `visibilitychange` 监听，隐藏时调用 `settleForHide()`。状态转换返回 `sound: true` 时调用 `playFocusChime()`。

时间格式：番茄与休息用向上取整的剩余秒数，自由计时用向下取整的累计秒数；统一 `HH:MM:SS` 或 `MM:SS`，数字容器使用 `font-variant-numeric: tabular-nums`。

- [x] **Step 4: 实现提前结束确认与焦点规则**

确认框打开后焦点移入并限制 Tab；`Escape` 先关闭确认框。确认调用 `finishEarly()`，取消不暂停计时。空格只在 `event.target` 不是 input、select、textarea、button 时切换暂停。

- [x] **Step 5: 实现迷你条与 App 挂载**

只在 `activeSession && !immersiveOpen` 时渲染。迷你条显示主题、时间、状态、暂停/继续和“进入专注模式”。App 的 `.main-shell` 在迷你条存在时增加 `has-focus-mini` 类与底部空间。

- [x] **Step 6: 实现提示音安全降级**

`playFocusChime` 创建 `AudioContext`，依次播放两个低音量 oscillator；所有构建、resume、start 和 close 错误均捕获并返回。测试只验证调用失败不会让 `tick` 或 UI 抛错，不断言浏览器音频实现。

- [x] **Step 7: 添加响应式、暗色与 reduced-motion 样式**

专注层使用 `position: fixed; inset: 0; z-index: 80`，内容宽度受 `min()` 限制；控制区用稳定网格。移动端按钮允许两列换行，迷你条主题截断。加入：

```css
@media (prefers-reduced-motion: reduce) {
  .focus-progress, .focus-overlay, .focus-mini { transition: none; }
}
```

- [x] **Step 8: 运行会话和 App 测试**

Run: `cd web && npm test -- --run src/focus/FocusSession.test.jsx src/App.test.jsx`

Expected: PASS，无 act warning、未清理 interval 或未捕获音频错误。

- [x] **Step 9: 记录任务验证结果**

已完成：会话与 App 定向测试 7/7 通过；完整 Web 回归 46/46 通过。覆盖时间显示、键盘、提前结束、手动休息、提示音降级、迷你条挂载和清理。

---

### Task 6: 独立专注统计页

**Files:**
- Create: `web/src/focus/FocusStatsPage.jsx`
- Test: `web/src/focus/FocusStatsPage.test.jsx`
- Modify: `web/src/App.jsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `getFocusSummary(records, { now, timeZone })`
- Consumes: task Store 的 `timeZone`，focus Store 的 `records`
- Produces: `FocusStatsPage({ focusStoreHook, timeZone, now, onStartFocus })`

- [x] **Step 1: 写统计页面失败测试**

```jsx
it('renders focus totals, seven-day activity, subject distribution and recent records', () => {
  const store = createFocusStore({ persist: false });
  store.setState({ records: [{
    id: 'record-1', sessionId: 'session-1', taskId: null, subjectSnapshot: '阅读',
    mode: 'pomodoro', outcome: 'completed', focusedMs: 1500000,
    startedAt: '2026-08-31T08:00:00.000Z', endedAt: '2026-08-31T08:25:00.000Z',
  }] });
  render(<FocusStatsPage focusStoreHook={store} timeZone="Asia/Shanghai" now="2026-08-31T09:00:00.000Z" onStartFocus={() => {}} />);
  expect(screen.getByText('25 分钟')).toBeInTheDocument();
  expect(screen.getByText('阅读')).toBeInTheDocument();
  expect(screen.getByText('正常完成')).toBeInTheDocument();
});
```

- [x] **Step 2: 运行统计页面测试确认 RED**

Run: `cd web && npm test -- --run src/focus/FocusStatsPage.test.jsx`

Expected: FAIL，提示统计页面不存在。

- [x] **Step 3: 实现统计页面**

顶部三项指标采用现有 `stats-strip` 密度；七天图用真实比例柱体并提供 `aria-label="2026-08-31 专注 25 分钟"`；主题分布用水平条；最近记录为可扫描列表。少于一分钟显示“少于 1 分钟”，最近记录显示 `MM:SS`。

空数据时只显示“还没有专注记录”和“开始专注”按钮。

- [x] **Step 4: 接入 App 页面路由**

当 `filter.view === 'focus-stats'` 渲染 `FocusStatsPage`。页面的“开始专注”打开无任务设置弹窗；活动会话存在时改为打开沉浸层。

- [x] **Step 5: 运行统计和导航测试**

Run: `cd web && npm test -- --run src/focus/FocusStatsPage.test.jsx src/App.test.jsx src/components/Sidebar.test.jsx`

Expected: PASS。

- [x] **Step 6: 记录任务验证结果**

已完成：统计页、App 与侧栏导航定向测试 6/6 通过；覆盖有数据、空数据、七日无障碍标签、主题分布、最近记录和开始专注命令。

---

### Task 7: 浏览器验收、视觉检查和文档

**Files:**
- Modify: `web/e2e/app.spec.js`
- Modify: `web/src/styles.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: 完整专注 UI 与 Store。
- Produces: 可重复的桌面与移动端浏览器验收证据。

- [x] **Step 1: 增加 Playwright 专注流程**

桌面用番茄设置中的最短 1 分钟，但通过页面内测试时钟入口推进时间，不真实等待。实现仅在 `import.meta.env.MODE === 'test'` 或 `window.__RIXU_TEST_CLOCK__` 已由测试注入时启用，生产界面不显示测试控件。

```js
test('completes one pomodoro and starts break manually', async ({ page }) => {
  await page.addInitScript(() => { window.__RIXU_TEST_CLOCK__ = { now: '2026-08-31T08:00:00.000Z' }; });
  await page.goto('/');
  await page.getByLabel('开始专注').click();
  await page.getByLabel('专注主题').fill('浏览器专注');
  await page.getByLabel('专注分钟').fill('1');
  await page.getByRole('button', { name: '开始专注' }).click();
  await page.evaluate(() => { window.__RIXU_TEST_CLOCK__.now = '2026-08-31T08:01:01.000Z'; });
  await expect(page.getByText('本轮完成')).toBeVisible();
  await page.getByRole('button', { name: '开始休息' }).click();
  await expect(page.getByText('休息中')).toBeVisible();
});
```

移动流程开始自由计时、暂停、刷新，断言“已暂停”、迷你条恢复及 `scrollWidth <= innerWidth`。

- [x] **Step 2: 运行 Playwright 确认新增测试先失败**

Run: `cd web && npm run test:e2e`

Expected: 新增专注用例 FAIL，现有用例保持 PASS。

- [x] **Step 3: 实现最小测试时钟适配**

在 `focus-store.js` 的默认 clock 读取：

```js
const browserClock = () => new Date(globalThis.__RIXU_TEST_CLOCK__?.now ?? Date.now());
```

此变量只能改变时间来源，不暴露跳过校验、直接写记录或专用 UI。

- [x] **Step 4: 更新 README**

在启动教程后新增“专注模式”小节，说明三处入口、番茄/自由计时、刷新恢复为暂停、手动休息、独立统计和 `rixu-focus:v1` 数据位置。明确专注结束不会自动完成任务。

- [x] **Step 5: 运行全量验证**

Run: `npm test`

Expected: 根目录 106 条领域测试全部 PASS。

Run: `cd web && npm test`

Expected: 所有前端测试 PASS，无失败或未处理错误。

Run: `cd web && npm run build`

Expected: Vite 生产构建成功。

Run: `cd web && npm run test:e2e`

Expected: 桌面和移动端专注流程及既有冒烟流程全部 PASS；只允许现有按项目条件声明的 skip。

- [x] **Step 6: 做桌面与移动视觉验收**

使用 Playwright 截图检查：桌面番茄运行、桌面专注统计、移动自由计时、移动迷你条。对每个视口读取 `document.documentElement.scrollWidth` 与 `window.innerWidth`，必须无横向溢出；检查计时数字、标题和控制按钮不重叠。

- [x] **Step 7: 扫描范围和占位符**

Run: `find src tests -type f -newermt '2026-08-31 00:00:00' -print`

Expected: 无输出，证明受保护目录未被本次工作写入。

Run: `rg -n "TODO|FIXME|HACK" web/src/focus web/e2e README.md`

Expected: 无输出。

- [x] **Step 8: 记录最终验证结果**

已完成：根目录领域测试 106/106 通过；Web 测试 50/50 通过；Vite 生产构建成功；Playwright 5 个执行用例通过、3 个按视口条件跳过。视觉验收覆盖桌面 1440×960 与移动 412×915，四个场景均无横向溢出或关键元素相交，截图保存在 `/tmp/rixu-visual/`。保护目录与占位符扫描均无输出。不执行提交，因为当前目录不是 Git 仓库。

---

## 实施完成定义

- 规格第 1 至 16 节均有对应实现任务。
- 状态机、Store、统计选择器和 React UI 均有先失败后通过的自动化测试。
- 三个入口、沉浸层、迷你条、刷新暂停、手动休息、提示音降级和独立统计可操作。
- 专注记录不修改任务完成状态，删除任务不破坏专注历史。
- 根测试、前端测试、生产构建和 Playwright 全量通过。
- 桌面和移动端截图无空白、遮挡或横向溢出。
- README 与实际行为、存储键和限制一致。
