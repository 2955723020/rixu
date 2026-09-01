import {
  instantToLocalDateTime,
  localDateTimeToInstant,
} from '../domain/timezone.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ABSOLUTE_TIME_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

function sourceTasks(tasks) {
  return Array.isArray(tasks) ? tasks : [];
}

function clone(value) {
  return structuredClone(value);
}

function isCalendarDate(value) {
  const match = typeof value === 'string' && DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  return (
    year >= 1 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function absoluteEpoch(value) {
  if (typeof value !== 'string' || !ABSOLUTE_TIME_PATTERN.test(value)) {
    return null;
  }

  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
}

function queryContext({ now, timeZone }) {
  const localDateTime = instantToLocalDateTime(now, timeZone);
  const nowEpoch = now instanceof Date ? now.getTime() : Date.parse(now);

  return {
    localDate: localDateTime.slice(0, 10),
    nowEpoch,
    timeZone,
  };
}

function pendingDatedTasks(tasks) {
  return sourceTasks(tasks).filter(
    (task) =>
      task &&
      task.status === 'pending' &&
      isCalendarDate(task.dueDate),
  );
}

function effectiveDeadline(task, timeZone) {
  if (task.endAt !== null && task.endAt !== undefined && task.endAt !== '') {
    return absoluteEpoch(task.endAt);
  }

  return Date.parse(
    localDateTimeToInstant(`${task.dueDate}T23:59:59.999`, timeZone),
  );
}

export function getTodayTasks(tasks, options) {
  const { localDate } = queryContext(options);

  return pendingDatedTasks(tasks)
    .filter((task) => task.dueDate === localDate)
    .map((task) => clone(task));
}

export function getFutureTasks(tasks, options) {
  const { localDate } = queryContext(options);

  return pendingDatedTasks(tasks)
    .filter((task) => task.dueDate > localDate)
    .map((task) => clone(task));
}

export function getOverdueTasks(tasks, options) {
  const { nowEpoch, timeZone } = queryContext(options);

  return pendingDatedTasks(tasks)
    .map((task, index) => ({
      task,
      index,
      deadline: effectiveDeadline(task, timeZone),
    }))
    .filter(({ deadline }) => deadline !== null && nowEpoch > deadline)
    .sort(
      (left, right) =>
        left.deadline - right.deadline || left.index - right.index,
    )
    .map(({ task }) => ({
      ...clone(task),
      isOverdue: true,
      highlightColor: 'red',
      overdueLabel: 'Overdue',
      overdueIcon: 'alert',
    }));
}

export function getCompletedTasks(tasks) {
  return sourceTasks(tasks)
    .map((task, index) => ({
      task,
      index,
      completedAt: task ? absoluteEpoch(task.completedAt) : null,
    }))
    .filter(
      ({ task, completedAt }) =>
        task && task.status === 'completed' && completedAt !== null,
    )
    .sort(
      (left, right) =>
        left.completedAt - right.completedAt || left.index - right.index,
    )
    .map(({ task }) => clone(task));
}

export function getTasksForView(tasks, view, options) {
  switch (view) {
    case 'today':
      return getTodayTasks(tasks, options);
    case 'future':
      return getFutureTasks(tasks, options);
    case 'overdue':
      return getOverdueTasks(tasks, options);
    case 'completed':
      return getCompletedTasks(tasks);
    default:
      throw new RangeError(`Unsupported task view: ${String(view)}`);
  }
}
