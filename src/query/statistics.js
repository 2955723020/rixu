import {
  TimeZoneConversionError,
  instantToLocalDateTime,
} from '../domain/timezone.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function sourceInstances(instances) {
  return Array.isArray(instances) ? instances : [];
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

function isInRange(date, from, to) {
  return isCalendarDate(date) && date >= from && date <= to;
}

function completionLocalDate(completedAt, timezone) {
  try {
    return instantToLocalDateTime(completedAt, timezone).slice(0, 10);
  } catch (error) {
    if (
      error instanceof TimeZoneConversionError &&
      error.code === 'INVALID_INSTANT'
    ) {
      return null;
    }
    throw error;
  }
}

export function calculateCompletionRate(instances, { from, to }) {
  let completed = 0;
  let expected = 0;

  for (const instance of sourceInstances(instances)) {
    if (!instance || !isInRange(instance.dueDate, from, to)) {
      continue;
    }

    if (instance.status !== 'cancelled') {
      expected += 1;
    }
    if (instance.status === 'completed' && instance.completedAt != null) {
      completed += 1;
    }
  }

  return {
    completed,
    expected,
    rate: expected === 0 ? 0 : completed / expected,
  };
}

export function buildCompletionHeatmap(
  instances,
  { from, to, timezone },
) {
  const counts = new Map();

  for (const instance of sourceInstances(instances)) {
    if (!instance || instance.status !== 'completed' || instance.completedAt == null) {
      continue;
    }

    const localDate = completionLocalDate(instance.completedAt, timezone);
    if (localDate !== null && isInRange(localDate, from, to)) {
      counts.set(localDate, (counts.get(localDate) ?? 0) + 1);
    }
  }

  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}
