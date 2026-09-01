# Web Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, responsive React web application over the existing task domain and query modules, with local persistence and complete task, filter, calendar, and statistics workflows.

**Architecture:** A standalone Vite app in `web/` imports the existing `src/` modules through an alias for `node:crypto`. Zustand owns persisted task/list arrays; React pages consume store actions and existing pure query functions. Vitest and Testing Library protect user-visible workflows, and Playwright validates the built app at desktop and mobile sizes.

**Tech Stack:** Vite, React, Zustand, Tailwind CSS, Lucide React, Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-web-frontend-design.md`

## Global Constraints

- Do not modify any file below `src/` or `tests/`.
- Keep the MVP frontend-only and persist data to `localStorage` under `rixu:v1`.
- Use the existing domain and query modules as the source of business rules.
- Use a Vite `node:crypto` alias to bridge `randomUUID` in browsers.
- Provide task list, calendar, and statistics views plus list/tag/priority filters.
- Provide responsive desktop/mobile layouts and light/dark themes.

---

### Task 1: Frontend Runtime And Test Baseline

**Files:**
- Create: `web/package.json`, `web/index.html`, `web/vite.config.js`, `web/shims/node-crypto.js`
- Create: `web/src/main.jsx`, `web/src/App.jsx`, `web/src/styles.css`, `web/src/test/setup.js`
- Test: `web/src/App.test.jsx`

**Interfaces:**
- Consumes: Existing ESM modules in `../src/`.
- Produces: `App`, Vite build/test scripts, design tokens, and browser-compatible `randomUUID`.

- [ ] Write an application-shell test asserting branded navigation and all primary view controls.
- [ ] Run `npm test -- App.test.jsx` in `web/`; expect failure because the app does not exist.
- [ ] Add the minimal Vite/React configuration, crypto shim, app shell, and global design tokens.
- [ ] Run the focused test, then `npm run build`; expect both to pass.

### Task 2: Persisted Domain Store

**Files:**
- Create: `web/src/lib/clock.js`, `web/src/store/task-store.js`, `web/src/store/task-store.test.js`

**Interfaces:**
- Consumes: `createTask`, `updateTask`, `createList`, `renameList`, and `checkSubtaskCompletion`.
- Produces: `useTaskStore`, `createTaskStore`, CRUD/list actions, filter actions, theme state, and `seedDemoData()`.

- [ ] Write store tests for validated create/edit/delete, completion guard, list retention, and persisted rehydration.
- [ ] Run the focused store tests; expect missing-module failure.
- [ ] Implement immutable actions over task/list arrays and persist only stable state.
- [ ] Run focused and full web tests; expect pass.

### Task 3: Task List Workflow

**Files:**
- Create: `web/src/components/QuickAdd.jsx`, `web/src/components/TaskItem.jsx`, `web/src/components/TaskEditor.jsx`
- Create: `web/src/pages/TaskListPage.jsx`, `web/src/pages/TaskListPage.test.jsx`
- Modify: `web/src/App.jsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: Store actions, `parseChineseDate`, `getTasksForView`, and organization filters.
- Produces: Fast task capture, inline editing, completion, deletion, and empty/list states.

- [ ] Write user-flow tests for quick add, Chinese date preview, completion, parent guard, editing, and confirmed deletion.
- [ ] Run focused tests; expect missing UI behavior.
- [ ] Implement the workflow with accessible controls and inline domain errors.
- [ ] Run focused and full web tests; expect pass.

### Task 4: Navigation And Filters

**Files:**
- Create: `web/src/components/Sidebar.jsx`, `web/src/components/Topbar.jsx`
- Create: `web/src/components/Sidebar.test.jsx`
- Modify: `web/src/App.jsx`, `web/src/pages/TaskListPage.jsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: Store filters, task/list arrays, query filters, and Lucide icons.
- Produces: Smart-list navigation, list/tag/priority filtering, search, and mobile navigation.

- [ ] Write tests showing view, list, tag, priority, and search selections change visible tasks.
- [ ] Run focused tests; expect failures for absent navigation.
- [ ] Implement navigation and composed filtering with visible active states and counts.
- [ ] Run focused and full web tests; expect pass.

### Task 5: Calendar And Statistics

**Files:**
- Create: `web/src/pages/CalendarPage.jsx`, `web/src/pages/CalendarPage.test.jsx`
- Create: `web/src/pages/StatsPage.jsx`, `web/src/pages/StatsPage.test.jsx`
- Modify: `web/src/App.jsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: `buildCalendarIndex`, `selectCalendarDate`, `calculateCompletionRate`, and `buildCompletionHeatmap`.
- Produces: Navigable month grid, selected-day panel with prefilled task creation, completion metrics, and heatmap.

- [ ] Write calendar tests for date selection and prefilled creation; write statistics tests for rate and heatmap output.
- [ ] Run focused tests; expect missing-page failures.
- [ ] Implement both pages and connect primary navigation.
- [ ] Run focused and full web tests; expect pass.

### Task 6: Responsive Polish And Browser Verification

**Files:**
- Modify: `web/src/App.jsx`, `web/src/styles.css`, `web/src/components/*.jsx`, `web/src/pages/*.jsx`
- Create: `web/e2e/app.spec.js`, `web/playwright.config.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: Complete application and built Vite server.
- Produces: Theme switching, responsive navigation, keyboard/focus states, screenshots, and run instructions.

- [ ] Write Playwright coverage for quick add, navigation, persistence, theme, and mobile layout.
- [ ] Run the e2e test; expect failures before final interaction wiring.
- [ ] Finish responsive styles, dark theme, empty/loading/error states, and README instructions.
- [ ] Run root tests, web tests, build, Playwright desktop/mobile tests, and inspect screenshots for overflow, overlap, and blank regions.
