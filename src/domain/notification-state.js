const STATUSES = Object.freeze(['unscheduled', 'scheduled', 'disabled', 'pending', 'cancelled']);

function clone(value) {
  return structuredClone(value);
}

export const NOTIFICATION_STATUSES = STATUSES;

export function createNotificationState(taskId, overrides = {}) {
  if (taskId === undefined || taskId === null || taskId === '') {
    throw new TypeError('taskId is required.');
  }

  const state = {
    taskId,
    status: 'unscheduled',
    scheduleKey: `reminder:${String(taskId)}`,
    triggerAt: null,
    reason: null,
    ...clone(overrides),
  };

  if (!STATUSES.includes(state.status)) {
    throw new TypeError('Invalid notification state status.');
  }
  return state;
}

export function cloneNotificationState(state) {
  return state ? clone(state) : null;
}

export function isNotificationState(value) {
  return Boolean(
    value &&
      (typeof value.taskId === 'string' || typeof value.taskId === 'number') &&
      STATUSES.includes(value.status),
  );
}
