const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'custom']);
const CUSTOM_UNITS = new Set(['day', 'week', 'month']);

function clone(value) {
  return structuredClone(value);
}

function cloneForFailure(value) {
  try {
    return clone(value);
  } catch {
    return value;
  }
}

function fieldError(field, code, message, action) {
  return { field, code, message, action };
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

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function isSupportedDate(date) {
  const year = date.getUTCFullYear();
  return Number.isFinite(date.getTime()) && year >= 1 && year <= 9999;
}

function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(date, months, anchorDay) {
  const sourceYear = date.getUTCFullYear();
  const sourceMonth = date.getUTCMonth();
  const targetMonthIndex = sourceMonth + months;
  const targetYear = sourceYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(anchorDay, daysInMonth(targetYear, targetMonth + 1));
  const result = new Date(0);
  result.setUTCFullYear(targetYear, targetMonth, targetDay);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function validatePositiveInterval(rule, errors) {
  if (
    rule.interval !== undefined &&
    (!Number.isInteger(rule.interval) || rule.interval < 1)
  ) {
    errors.push(
      fieldError(
        'recurrence.interval',
        'INVALID_INTERVAL',
        'recurrence.interval must be a positive integer.',
        'Set recurrence.interval to a whole number greater than zero.',
      ),
    );
    return false;
  }
  return true;
}

function rejectMonthlyInterval(rule, errors) {
  if (rule.interval === undefined) {
    return;
  }

  errors.push(
    fieldError(
      'recurrence.interval',
      'INVALID_INTERVAL',
      'monthly recurrence does not accept recurrence.interval.',
      'Use a custom recurrence with unit set to month for multi-month intervals.',
    ),
  );
}

function validateWeekdays(weekdays, errors) {
  if (
    !Array.isArray(weekdays) ||
    weekdays.length === 0 ||
    weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
    new Set(weekdays).size !== weekdays.length
  ) {
    errors.push(
      fieldError(
        'recurrence.weekdays',
        'INVALID_WEEKDAYS',
        'recurrence.weekdays must contain one or more ISO weekdays from 1 to 7.',
        'Choose at least one weekday from 1 (Monday) through 7 (Sunday).',
      ),
    );
    return false;
  }
  return true;
}

function validateAnchorDay(anchorDay, errors) {
  if (
    !Number.isInteger(anchorDay) ||
    anchorDay < 1 ||
    anchorDay > 31
  ) {
    errors.push(
      fieldError(
        'recurrence.anchorDay',
        'INVALID_ANCHOR_DAY',
        'recurrence.anchorDay must be an integer from 1 to 31.',
        'Set recurrence.anchorDay to a calendar day from 1 through 31.',
      ),
    );
    return false;
  }
  return true;
}

function isoWeekday(date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function nextWeeklyDate(date, weekdays, interval) {
  const sortedWeekdays = [...weekdays].sort((left, right) => left - right);
  const currentWeekday = isoWeekday(date);
  const laterWeekday = sortedWeekdays.find((weekday) => weekday > currentWeekday);
  if (laterWeekday !== undefined) {
    return addDays(date, laterWeekday - currentWeekday);
  }

  const monday = addDays(date, -(currentWeekday - 1));
  const targetMonday = addDays(monday, interval * 7);
  return addDays(targetMonday, sortedWeekdays[0] - 1);
}

function normalizeRule(rule, dueDate, errors) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    errors.push(
      fieldError(
        'recurrence',
        'REQUIRED',
        'recurrence must be a structured rule object.',
        'Choose a recurrence frequency and provide its structured fields.',
      ),
    );
    return null;
  }

  let normalized;
  try {
    normalized = clone(rule);
  } catch {
    errors.push(
      fieldError(
        'recurrence',
        'INVALID_STRUCTURE',
        'recurrence must contain only structured data values.',
        'Remove functions, symbols, and other non-data values from recurrence.',
      ),
    );
    return null;
  }
  if (!FREQUENCIES.has(rule.frequency)) {
    errors.push(
      fieldError(
        'recurrence.frequency',
        'INVALID_FREQUENCY',
        'recurrence.frequency must be daily, weekly, monthly, or custom.',
        'Choose one supported recurrence frequency.',
      ),
    );
    return null;
  }

  if (rule.frequency === 'daily') {
    validatePositiveInterval(rule, errors);
    normalized.interval = rule.interval ?? 1;
  }

  if (rule.frequency === 'weekly') {
    validatePositiveInterval(rule, errors);
    validateWeekdays(rule.weekdays, errors);
    normalized.interval = rule.interval ?? 1;
  }

  if (rule.frequency === 'monthly') {
    rejectMonthlyInterval(rule, errors);
    const anchorDay = rule.anchorDay ?? Number(dueDate.slice(-2));
    validateAnchorDay(anchorDay, errors);
    normalized.anchorDay = anchorDay;
  }

  if (rule.frequency === 'custom') {
    if (!Number.isInteger(rule.interval) || rule.interval < 1) {
      errors.push(
        fieldError(
          'recurrence.interval',
          'INVALID_INTERVAL',
          'recurrence.interval must be a positive integer.',
          'Set recurrence.interval to a whole number greater than zero.',
        ),
      );
    }
    if (!CUSTOM_UNITS.has(rule.unit)) {
      errors.push(
        fieldError(
          'recurrence.unit',
          'INVALID_UNIT',
          'recurrence.unit must be day, week, or month.',
          'Choose day, week, or month as the recurrence unit.',
        ),
      );
    }
    if (rule.unit === 'week' && rule.weekdays !== undefined) {
      validateWeekdays(rule.weekdays, errors);
    }
    if (rule.unit === 'month') {
      const anchorDay = rule.anchorDay ?? Number(dueDate.slice(-2));
      validateAnchorDay(anchorDay, errors);
      normalized.anchorDay = anchorDay;
    }
  }

  return normalized;
}

export function calculateNextOccurrence(options = {}) {
  const submitted = options && typeof options === 'object' ? options : {};
  const { dueDate, recurrence } = submitted;
  const input = { dueDate, recurrence };
  const errors = [];
  if (!isCalendarDate(dueDate)) {
    errors.push(
      fieldError(
        'dueDate',
        'INVALID_DATE',
        'dueDate must be an existing calendar date in YYYY-MM-DD format.',
        'Choose an existing date and enter it as YYYY-MM-DD.',
      ),
    );
  }

  const normalized = normalizeRule(
    recurrence,
    isCalendarDate(dueDate) ? dueDate : '2000-01-01',
    errors,
  );

  if (errors.length > 0 || normalized === null) {
    return { ok: false, errors, input: cloneForFailure(input) };
  }

  const date = parseDate(dueDate);
  let nextDate;
  switch (normalized.frequency) {
    case 'daily':
      nextDate = addDays(date, normalized.interval);
      break;
    case 'weekly':
      nextDate = nextWeeklyDate(date, normalized.weekdays, normalized.interval);
      break;
    case 'monthly':
      nextDate = addMonths(date, 1, normalized.anchorDay);
      break;
    case 'custom':
      if (normalized.unit === 'day') {
        nextDate = addDays(date, normalized.interval);
      } else if (normalized.unit === 'week') {
        nextDate = normalized.weekdays
          ? nextWeeklyDate(date, normalized.weekdays, normalized.interval)
          : addDays(date, normalized.interval * 7);
      } else {
        nextDate = addMonths(date, normalized.interval, normalized.anchorDay);
      }
      break;
    default:
      throw new Error('Unsupported recurrence frequency.');
  }

  if (!isSupportedDate(nextDate)) {
    return {
      ok: false,
      errors: [
        fieldError(
          'dueDate',
          'NEXT_DATE_OUT_OF_RANGE',
          'The next occurrence is outside the supported YYYY-MM-DD calendar range.',
          'Choose an earlier dueDate or reduce recurrence.interval.',
        ),
      ],
      input: cloneForFailure(input),
    };
  }

  return { dueDate: formatDate(nextDate), recurrence: normalized };
}
