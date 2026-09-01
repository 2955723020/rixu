import assert from 'node:assert/strict';
import test from 'node:test';

import { ReminderService } from '../../src/application/reminders.js';
import { TaskRepository } from '../../src/storage/task-repository.js';

function createRepository(taskInput = {}) {
  return new TaskRepository({
    clock: () => new Date('2025-01-10T08:00:00.000Z'),
    idGenerator: () => 'task-001',
  });
}

function createTask(repository, input = {}) {
  const result = repository.create({
    title: 'Private title',
    dueDate: '2025-01-15',
    timezone: 'UTC',
    ...input,
  });
  assert.equal(result.ok, true);
  return result.task;
}

function scheduler() {
  return {
    schedules: [],
    cancellations: [],
    schedule(key, triggerAt) {
      this.schedules.push({ key, triggerAt });
    },
    cancel(key) {
      this.cancellations.push(key);
    },
  };
}

test('schedules endAt exactly and untimed tasks at local 09:00', () => {
  const repository = createRepository();
  const timed = createTask(repository, {
    endAt: '2025-01-15T10:45',
    timezone: 'America/New_York',
  });
  const untimed = createTask(new TaskRepository({
    clock: () => new Date('2025-01-10T08:00:00.000Z'),
    idGenerator: () => 'task-002',
  }), { timezone: 'Asia/Shanghai' });
  const adapter = scheduler();
  const service = new ReminderService({ repository, scheduler: adapter, permissionProbe: () => true });

  const timedResult = service.schedulePendingTask(timed.id);
  assert.equal(timedResult.ok, true);
  assert.equal(timedResult.state.taskId, timed.id);
  assert.equal(timedResult.state.status, 'scheduled');
  assert.equal(timedResult.state.scheduleKey, `reminder:${timed.id}`);
  assert.equal(timedResult.state.triggerAt, timed.endAt);

  const secondRepository = new TaskRepository({
    clock: () => new Date('2025-01-10T08:00:00.000Z'),
    idGenerator: () => 'task-002',
  });
  createTask(secondRepository, { timezone: 'Asia/Shanghai' });
  const secondService = new ReminderService({ repository: secondRepository, scheduler: adapter, permissionProbe: () => true });
  assert.equal(secondService.schedulePendingTask('task-002').state.triggerAt, '2025-01-15T01:00:00.000Z');
  assert.deepEqual(adapter.schedules, [
    { key: 'reminder:task-001', triggerAt: '2025-01-15T15:45:00.000Z' },
    { key: 'reminder:task-002', triggerAt: '2025-01-15T01:00:00.000Z' },
  ]);
});

test('invalid timezone conversion returns a fielded failure without scheduling', () => {
  const repository = {
    getById: () => ({ id: 'task-001', dueDate: '2025-01-15', timezone: 'Not/A_Zone', status: 'pending', endAt: null }),
  };
  const adapter = scheduler();
  const service = new ReminderService({ repository, scheduler: adapter, permissionProbe: () => true });

  const result = service.schedulePendingTask('task-001');
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].field, 'timezone');
  assert.equal(result.state.status, 'pending');
  assert.equal(adapter.schedules.length, 0);
});

test('invalid endAt is reported on endAt instead of being guessed', () => {
  const repository = {
    getById: () => ({ id: 'task-001', dueDate: '2025-01-15', timezone: 'UTC', status: 'pending', endAt: '2025-01-15T10:00' }),
  };
  const adapter = scheduler();
  const service = new ReminderService({ repository, scheduler: adapter, permissionProbe: () => true });

  const result = service.schedulePendingTask('task-001');
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].field, 'endAt');
  assert.equal(result.errors[0].code, 'INVALID_INSTANT');
});

test('disabling is idempotent and cancels an existing schedule', () => {
  const repository = createRepository();
  createTask(repository);
  const adapter = scheduler();
  const service = new ReminderService({ repository, scheduler: adapter, permissionProbe: () => true });

  service.schedulePendingTask('task-001');
  assert.equal(service.disableReminder('task-001').ok, true);
  assert.equal(service.disableReminder('task-001').ok, true);
  assert.deepEqual(adapter.cancellations, ['reminder:task-001']);
  assert.equal(adapter.schedules.length, 1);
  assert.equal(service.schedulePendingTask('task-001').state.status, 'disabled');
  assert.equal(adapter.schedules.length, 1);
});

test('completed tasks cancel reminders and cannot be scheduled as unfinished', () => {
  const task = { id: 'task-001', dueDate: '2025-01-15', timezone: 'UTC', status: 'pending', endAt: '2025-01-15T10:00:00.000Z' };
  let current = task;
  const repository = { getById: () => ({ ...current }) };
  const adapter = scheduler();
  const service = new ReminderService({ repository, scheduler: adapter, permissionProbe: () => true });
  service.schedulePendingTask('task-001');
  current = { ...task, status: 'completed', completedAt: '2025-01-10T09:00:00.000Z' };

  assert.equal(service.handleTaskCompleted('task-001').ok, true);
  assert.equal(service.handleTaskCompleted('task-001').ok, true);
  assert.deepEqual(adapter.cancellations, ['reminder:task-001']);
  const refused = service.schedulePendingTask('task-001');
  assert.equal(refused.ok, false);
  assert.equal(refused.errors[0].code, 'TASK_COMPLETED');
  assert.equal(adapter.schedules.length, 1);
});

test('scheduling an externally completed task also cancels its outstanding reminder', () => {
  let task = { id: 'task-001', dueDate: '2025-01-15', timezone: 'UTC', status: 'pending', endAt: '2025-01-15T10:00:00.000Z' };
  const repository = { getById: () => ({ ...task }) };
  const adapter = scheduler();
  const service = new ReminderService({ repository, scheduler: adapter, permissionProbe: () => true });
  service.schedulePendingTask('task-001');
  task = { ...task, status: 'completed', completedAt: '2025-01-10T09:00:00.000Z' };

  const result = service.schedulePendingTask('task-001');
  assert.equal(result.ok, false);
  assert.deepEqual(adapter.cancellations, ['reminder:task-001']);
});

test('permission denial and scheduler errors are pending and retryable', () => {
  const repository = createRepository();
  createTask(repository);
  const adapter = scheduler();
  let permitted = false;
  const service = new ReminderService({ repository, scheduler: adapter, permissionProbe: () => permitted });

  const denied = service.schedulePendingTask('task-001');
  assert.equal(denied.ok, false);
  assert.equal(denied.state.status, 'pending');
  assert.equal(denied.state.reason.code, 'PERMISSION_DENIED');
  permitted = true;
  assert.equal(service.retrySchedule('task-001').ok, true);

  const failedAdapter = scheduler();
  failedAdapter.schedule = () => { throw new Error('scheduler unavailable'); };
  const failingService = new ReminderService({ repository, scheduler: failedAdapter, permissionProbe: () => true });
  const failed = failingService.schedulePendingTask('task-001');
  assert.equal(failed.ok, false);
  assert.equal(failed.state.reason.code, 'SCHEDULER_ERROR');
  failedAdapter.schedule = scheduler().schedule;
  assert.equal(failingService.retrySchedule('task-001').ok, true);
  assert.equal(repository.getById('task-001').title, 'Private title');
});

test('repeated scheduling is idempotent and does not expose task titles', () => {
  const repository = createRepository();
  createTask(repository, { endAt: '2025-01-15T10:00' });
  const adapter = scheduler();
  const service = new ReminderService({ repository, scheduler: adapter, permissionProbe: () => true });

  service.schedulePendingTask('task-001');
  service.schedulePendingTask('task-001');
  assert.equal(adapter.schedules.length, 1);
  assert.ok(!JSON.stringify(service.getNotificationState('task-001')).includes('Private title'));
  assert.ok(adapter.schedules.every(({ key }) => key === 'reminder:task-001'));
});
