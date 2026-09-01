const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

/**
 * Group dated tasks by their calendar due date without mutating the source.
 */
export function buildCalendarIndex(tasks) {
  const index = {};

  for (const task of sourceTasks(tasks)) {
    if (!task || typeof task !== 'object' || !isCalendarDate(task.dueDate)) {
      continue;
    }

    const dateTasks = index[task.dueDate] ?? (index[task.dueDate] = []);
    dateTasks.push(clone(task));
  }

  return index;
}

/**
 * Return cloned tasks due on one calendar date, preserving source order.
 */
export function getCalendarTasks(tasks, dueDate) {
  const index = buildCalendarIndex(tasks);
  return Object.prototype.hasOwnProperty.call(index, dueDate)
    ? index[dueDate]
    : [];
}

/**
 * Select a calendar date for viewing and optionally creating a task there.
 */
export function selectCalendarDate(tasks, dueDate) {
  return {
    date: dueDate,
    tasks: getCalendarTasks(tasks, dueDate),
    canCreate: true,
    createTaskInput: { dueDate },
  };
}
