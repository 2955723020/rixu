import { TimeZoneConversionError, localDateTimeToInstant } from '../domain/timezone.js';
import {
  cloneNotificationState,
  createNotificationState,
} from '../domain/notification-state.js';

function clone(value) {
  return structuredClone(value);
}

function fieldError(field, code, message, action) {
  return { field, code, message, action };
}

function failure(taskId, state, error) {
  return { ok: false, state: cloneNotificationState(state), errors: [error], taskId };
}

function validAbsoluteInstant(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

function isPermissionGranted(value) {
  if (value && typeof value === 'object' && 'granted' in value) {
    return value.granted === true;
  }
  return value === true || value === 'granted';
}

export class ReminderService {
  #repository;
  #scheduler;
  #permissionProbe;
  #states = new Map();

  constructor(dependencies = {}, options = {}, positionalPermissionProbe) {
    if (dependencies && typeof dependencies.getById === 'function') {
      dependencies = {
        repository: dependencies,
        ...options,
        ...(positionalPermissionProbe === undefined
          ? {}
          : { permissionProbe: positionalPermissionProbe }),
      };
    }
    let {
      repository,
      taskRepository,
      scheduler,
      schedulerAdapter,
      permissionProbe,
      notificationPermissionProbe,
    } = dependencies;
    repository ??= taskRepository;
    scheduler ??= schedulerAdapter;
    permissionProbe ??= notificationPermissionProbe ?? (() => true);
    if (!repository || typeof repository.getById !== 'function') {
      throw new TypeError('repository.getById must be a function.');
    }
    if (!scheduler || typeof scheduler.schedule !== 'function' || typeof scheduler.cancel !== 'function') {
      throw new TypeError('scheduler must provide schedule(key, triggerAt) and cancel(key).');
    }
    if (typeof permissionProbe !== 'function') {
      throw new TypeError('permissionProbe must be a function.');
    }
    this.#repository = repository;
    this.#scheduler = scheduler;
    this.#permissionProbe = permissionProbe;
  }

  schedulePendingTask(taskId) {
    const task = this.#repository.getById(taskId);
    let state = this.#state(taskId);

    if (!task) {
      state = this.#setState(taskId, {
        status: 'pending',
        reason: { code: 'TASK_NOT_FOUND', message: 'Task could not be found.', action: 'Choose an existing task and retry.' },
      });
      return failure(taskId, state, fieldError('taskId', 'NOT_FOUND', 'No task exists for this id.', 'Choose an existing task and retry.'));
    }

    if (task.status !== 'pending') {
      if (task.status === 'completed' && state.status === 'scheduled') {
        try {
          this.#scheduler.cancel(state.scheduleKey);
        } catch {
          state = this.#setState(taskId, {
            status: 'pending',
            reason: { operation: 'cancel', code: 'SCHEDULER_ERROR', message: 'Reminder cancellation failed.', action: 'Retry cancellation when the notification service is available.' },
          });
          return failure(taskId, state, fieldError('scheduler', 'SCHEDULER_ERROR', 'Reminder cancellation failed.', 'Retry cancellation when the notification service is available.'));
        }
      }
      state = this.#setState(taskId, {
        status: task.status === 'completed' ? 'cancelled' : state.status,
        reason: task.status === 'completed'
          ? { code: 'TASK_COMPLETED', message: 'Completed tasks do not receive unfinished reminders.', action: 'Reopen the task before scheduling a reminder.' }
          : state.reason,
        triggerAt: null,
      });
      return failure(
        taskId,
        state,
        fieldError('status', 'TASK_COMPLETED', 'Completed tasks cannot be scheduled for an unfinished reminder.', 'Reopen the task before scheduling a reminder.'),
      );
    }

    if (task.reminderEnabled === false || task.remindersEnabled === false || task.notificationsEnabled === false) {
      return this.disableReminder(taskId);
    }

    if (state.status === 'disabled') {
      return { ok: true, state: cloneNotificationState(state) };
    }

    let triggerAt;
    try {
      triggerAt = this.#triggerAt(task);
    } catch (error) {
      const conversionError = error instanceof TimeZoneConversionError ? error : null;
      const field = conversionError?.code === 'INVALID_TIMEZONE'
        ? 'timezone'
        : task.endAt !== undefined && task.endAt !== null && task.endAt !== ''
          ? 'endAt'
          : 'dueDate';
      const code = conversionError?.code ?? 'INVALID_TRIGGER';
      state = this.#setState(taskId, {
        status: 'pending',
        triggerAt: null,
        reason: { code, message: 'Reminder time could not be converted.', action: `Correct the ${field} value and retry scheduling.` },
      });
      return failure(taskId, state, fieldError(field, code, 'Reminder time could not be converted.', `Correct the ${field} value and retry scheduling.`));
    }

    let permissionGranted;
    try {
      permissionGranted = this.#permissionProbe(taskId);
    } catch {
      permissionGranted = false;
    }
    if (!isPermissionGranted(permissionGranted)) {
      state = this.#setState(taskId, {
        status: 'pending',
        triggerAt,
        reason: { code: 'PERMISSION_DENIED', message: 'Notification permission is unavailable.', action: 'Allow notifications and retry scheduling.' },
      });
      return failure(taskId, state, fieldError('notificationPermission', 'PERMISSION_DENIED', 'Notification permission is unavailable.', 'Allow notifications and retry scheduling.'));
    }

    if (state.status === 'scheduled' && state.triggerAt === triggerAt) {
      return { ok: true, state: cloneNotificationState(state) };
    }

    if (state.status === 'scheduled' && state.triggerAt !== triggerAt) {
      try {
        this.#scheduler.cancel(state.scheduleKey);
      } catch {
        state = this.#setState(taskId, {
          status: 'pending',
          triggerAt,
          reason: { operation: 'cancel', code: 'SCHEDULER_ERROR', message: 'Existing reminder could not be replaced.', action: 'Retry scheduling when the notification service is available.' },
        });
        return failure(taskId, state, fieldError('scheduler', 'SCHEDULER_ERROR', 'Existing reminder could not be replaced.', 'Retry scheduling when the notification service is available.'));
      }
    }

    try {
      this.#scheduler.schedule(state.scheduleKey, triggerAt);
    } catch {
      state = this.#setState(taskId, {
        status: 'pending',
        triggerAt,
        reason: { code: 'SCHEDULER_ERROR', message: 'Reminder scheduling failed.', action: 'Retry scheduling when the notification service is available.' },
      });
      return failure(taskId, state, fieldError('scheduler', 'SCHEDULER_ERROR', 'Reminder scheduling failed.', 'Retry scheduling when the notification service is available.'));
    }

    state = this.#setState(taskId, { status: 'scheduled', triggerAt, reason: null });
    return { ok: true, state: cloneNotificationState(state) };
  }

  disableReminder(taskId) {
    let state = this.#state(taskId);
    const cancellationPending = state.status === 'pending' && state.reason?.operation === 'cancel';
    if (state.status !== 'scheduled' && !cancellationPending) {
      state = this.#setState(taskId, { status: 'disabled', triggerAt: null, reason: null });
      return { ok: true, state: cloneNotificationState(state) };
    }

    try {
      this.#scheduler.cancel(state.scheduleKey);
    } catch {
      state = this.#setState(taskId, {
        status: 'pending',
        reason: { operation: 'cancel', code: 'SCHEDULER_ERROR', message: 'Reminder cancellation failed.', action: 'Retry disabling the reminder.' },
      });
      return failure(taskId, state, fieldError('scheduler', 'SCHEDULER_ERROR', 'Reminder cancellation failed.', 'Retry disabling the reminder.'));
    }

    state = this.#setState(taskId, { status: 'disabled', triggerAt: null, reason: null });
    return { ok: true, state: cloneNotificationState(state) };
  }

  handleTaskCompleted(taskId) {
    const state = this.#state(taskId);
    const cancellationPending = state.status === 'pending' && state.reason?.operation === 'cancel';
    if (state.status !== 'scheduled' && !cancellationPending) {
      return { ok: true, state: cloneNotificationState(this.#setState(taskId, { status: 'cancelled', triggerAt: null, reason: { code: 'TASK_COMPLETED', message: 'Reminder cancelled because the task is completed.', action: 'Reopen the task to schedule a reminder.' } })) };
    }

    try {
      this.#scheduler.cancel(state.scheduleKey);
    } catch {
      const pending = this.#setState(taskId, {
        status: 'pending',
        reason: { operation: 'cancel', code: 'SCHEDULER_ERROR', message: 'Reminder cancellation failed.', action: 'Retry cancellation when the notification service is available.' },
      });
      return failure(taskId, pending, fieldError('scheduler', 'SCHEDULER_ERROR', 'Reminder cancellation failed.', 'Retry cancellation when the notification service is available.'));
    }

    const cancelled = this.#setState(taskId, {
      status: 'cancelled',
      triggerAt: null,
      reason: { code: 'TASK_COMPLETED', message: 'Reminder cancelled because the task is completed.', action: 'Reopen the task to schedule a reminder.' },
    });
    return { ok: true, state: cloneNotificationState(cancelled) };
  }

  retrySchedule(taskId) {
    const state = this.#state(taskId);
    if (state.status === 'disabled' || state.status === 'cancelled') {
      return { ok: true, state: cloneNotificationState(state) };
    }
    return this.schedulePendingTask(taskId);
  }

  getNotificationState(taskId) {
    return cloneNotificationState(this.#state(taskId));
  }

  inspectState(taskId) {
    return this.getNotificationState(taskId);
  }

  schedule(taskId) {
    return this.schedulePendingTask(taskId);
  }

  scheduleReminder(taskId) {
    return this.schedulePendingTask(taskId);
  }

  disable(taskId) {
    return this.disableReminder(taskId);
  }

  cancelForCompletedTask(taskId) {
    return this.handleTaskCompleted(taskId);
  }

  cancelOnCompletion(taskId) {
    return this.handleTaskCompleted(taskId);
  }

  cancelReminder(taskId) {
    return this.handleTaskCompleted(taskId);
  }

  getState(taskId) {
    return this.getNotificationState(taskId);
  }

  retry(taskId) {
    return this.retrySchedule(taskId);
  }

  retryReminder(taskId) {
    return this.retrySchedule(taskId);
  }

  #state(taskId) {
    if (!this.#states.has(taskId)) {
      this.#states.set(taskId, createNotificationState(taskId));
    }
    return this.#states.get(taskId);
  }

  #setState(taskId, changes) {
    const next = { ...this.#state(taskId), ...clone(changes) };
    this.#states.set(taskId, next);
    return next;
  }

  #triggerAt(task) {
    if (task.endAt !== undefined && task.endAt !== null && task.endAt !== '') {
      if (!validAbsoluteInstant(task.endAt)) {
        throw new TimeZoneConversionError('INVALID_INSTANT', 'endAt must be an absolute ISO instant.', { timeZone: task.timezone });
      }
      return task.endAt;
    }
    if (typeof task.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
      throw new TimeZoneConversionError('INVALID_LOCAL_DATETIME', 'dueDate must be a calendar date.', { localDateTime: task.dueDate, timeZone: task.timezone });
    }
    return localDateTimeToInstant(`${task.dueDate}T09:00`, task.timezone);
  }
}

export function createReminderService(dependencies) {
  return new ReminderService(dependencies);
}
