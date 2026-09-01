# Task Model and Repository Implementation Plan

> **For agentic workers:** Execute this plan inline with strict red-green-refactor cycles. Do not commit; the task orchestrator owns version control.

**Goal:** Build the zero-dependency Task domain model, strict IANA timezone conversion, and atomic in-memory CRUD repository required by T-F001-1.

**Architecture:** `timezone.js` converts validated local wall-clock values to ISO instants and formats instants without changing them. `task.js` validates and constructs immutable task values through result objects. `task-repository.js` owns records, injected IDs/clocks, atomic writes, defensive copies, and confirmation-gated idempotent deletion.

**Tech Stack:** Node.js 22 ESM, `node:test`, built-in `Intl` and `crypto` only.

**Spec:** `doc/features/F-001/tasks/T-F001-1-task-model-and-repository.md`

## Global Constraints

- Keep the implementation dependency-free and runnable offline with `npm test`.
- Implement only task construction, timezone conversion, and CRUD storage.
- Do not implement completion transitions, recurrence generation, organization behavior, reminders, views, or synchronization.
- Validation failures must preserve caller input and must not mutate repository state.

---

### Task 1: Test Harness and Timezone Conversion

**Files:**
- Create: `package.json`
- Create: `tests/domain/timezone.test.js`
- Create: `src/domain/timezone.js`

**Interfaces:**
- Produces: `localDateTimeToInstant(localDateTime, timeZone)` and `instantToLocalDateTime(instant, timeZone)`.

- [x] Write tests with hand-checked UTC values for normal conversion, cross-zone display, and the `America/New_York` spring DST gap.
- [x] Run `npm test -- tests/domain/timezone.test.js` and verify failure because the module is absent.
- [x] Implement strict parsing, IANA validation, offset resolution, round-trip validation, and local formatting.
- [x] Re-run the timezone tests and verify they pass.

### Task 2: Task Domain Model

**Files:**
- Create: `tests/domain/task.test.js`
- Create: `src/domain/task.js`

**Interfaces:**
- Consumes: timezone conversion functions from Task 1.
- Produces: `createTask(input, dependencies)` and `updateTask(task, changes, dependencies)`, returning `{ ok: true, task }` or `{ ok: false, errors, input }`.

- [x] Write tests for required fields, all Task defaults, optional times, end-before-start errors, DST field errors, and immutable monotonic updates.
- [x] Run `npm test -- tests/domain/task.test.js` and verify failure because the module is absent.
- [x] Implement validation and task construction with injected clock and ID generator.
- [x] Re-run domain tests and verify they pass.

### Task 3: Atomic CRUD Repository

**Files:**
- Create: `tests/storage/task-repository.test.js`
- Create: `src/storage/task-repository.js`

**Interfaces:**
- Consumes: `createTask` and `updateTask` from Task 2.
- Produces: `TaskRepository#create`, `getById`, `update`, and `delete`.

- [x] Write tests for TC-TASK-1, TC-TASK-2, failed-write atomicity, update identity/audit behavior, defensive reads, deletion confirmation, isolation, and repeated deletion.
- [x] Run `npm test -- tests/storage/task-repository.test.js` and verify failure because the module is absent.
- [x] Implement the map-backed repository with unique generated IDs and defensive copies.
- [x] Run the repository test file, then the exact task test command, and verify all tests pass without network access.
