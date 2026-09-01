import { randomUUID } from 'node:crypto';

import {
  TimeZoneConversionError,
  instantToLocalDateTime,
  localDateTimeToInstant,
} from './timezone.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SUPPORTED_PRIORITIES = Object.freeze(['none', 'low', 'medium', 'high', 'urgent']);
const SUPPORTED_PRIORITY_SET = new Set(SUPPORTED_PRIORITIES);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function clone(value) {
  return structuredClone(value);
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

function toIsoTimestamp(value, dependencyName) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError(`${dependencyName} must return a valid date or timestamp.`);
  }
  return date.toISOString();
}

function validateBaseFields(input, errors) {
  if (typeof input.title !== 'string' || input.title.trim().length === 0) {
    errors.push(
      fieldError(
        'title',
        'REQUIRED',
        'title must not be empty.',
        'Enter a non-empty title.',
      ),
    );
  }

  if (!isCalendarDate(input.dueDate)) {
    errors.push(
      fieldError(
        'dueDate',
        'INVALID_DATE',
        'dueDate must be an existing calendar date in YYYY-MM-DD format.',
        'Choose an existing date and enter it as YYYY-MM-DD.',
      ),
    );
  }
}

function validateTimezone(timezone, errors) {
  try {
    instantToLocalDateTime('2000-01-01T00:00:00.000Z', timezone);
    return true;
  } catch (error) {
    if (!(error instanceof TimeZoneConversionError) || error.code !== 'INVALID_TIMEZONE') {
      throw error;
    }
    errors.push(
      fieldError(
        'timezone',
        'INVALID_TIMEZONE',
        'timezone must be a valid IANA timezone.',
        'Choose a valid IANA timezone such as Asia/Shanghai.',
      ),
    );
    return false;
  }
}

function convertLocalTime(value, field, timezone, errors) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  try {
    return localDateTimeToInstant(value, timezone);
  } catch (error) {
    if (!(error instanceof TimeZoneConversionError)) {
      throw error;
    }
    errors.push(
      fieldError(
        field,
        error.code,
        `${field} is not a valid local date-time in ${timezone}.`,
        `Choose an existing local date and time for ${field}.`,
      ),
    );
    return null;
  }
}

function validateCollectionFields(input, errors) {
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      errors.push(
        fieldError('tags', 'INVALID_TYPE', 'tags must be an array.', 'Provide tags as an array.'),
      );
    } else if (
      input.tags.some((tag) => typeof tag !== 'string' || tag.trim().length === 0) ||
      new Set(input.tags).size !== input.tags.length
    ) {
      errors.push(
        fieldError(
          'tags',
          'INVALID_TAGS',
          'tags must contain unique, non-empty strings.',
          'Remove empty or duplicate tags and provide each tag as a non-empty string.',
        ),
      );
    }
  }

  if (input.priority !== undefined && !SUPPORTED_PRIORITY_SET.has(input.priority)) {
    errors.push(
      fieldError(
        'priority',
        'INVALID_PRIORITY',
        `priority must be one of ${SUPPORTED_PRIORITIES.join(', ')}.`,
        `Choose one of ${SUPPORTED_PRIORITIES.join(', ')}.`,
      ),
    );
  }
}

function validationFailure(errors, input) {
  return { ok: false, errors, input: clone(input) };
}

function nextUpdatedAt(clock, previousUpdatedAt) {
  const current = new Date(toIsoTimestamp(clock(), 'clock')).getTime();
  const previous = new Date(previousUpdatedAt).getTime();
  return new Date(Math.max(current, previous + 1)).toISOString();
}

export function createTask(
  input,
  { clock = () => new Date(), idGenerator = randomUUID } = {},
) {
  const submitted = input && typeof input === 'object' ? input : {};
  const timezone = submitted.timezone ?? 'UTC';
  const errors = [];

  validateBaseFields(submitted, errors);
  validateCollectionFields(submitted, errors);
  const timezoneIsValid = validateTimezone(timezone, errors);
  const startAt = timezoneIsValid
    ? convertLocalTime(submitted.startAt, 'startAt', timezone, errors)
    : null;
  const endAt = timezoneIsValid
    ? convertLocalTime(submitted.endAt, 'endAt', timezone, errors)
    : null;

  if (startAt && endAt && Date.parse(endAt) < Date.parse(startAt)) {
    errors.push(
      fieldError(
        'endAt',
        'END_BEFORE_START',
        'endAt must not be earlier than startAt.',
        'Set endAt to the same time as or later than startAt.',
      ),
    );
  }

  if (errors.length > 0) {
    return validationFailure(errors, submitted);
  }

  const timestamp = toIsoTimestamp(clock(), 'clock');
  return {
    ok: true,
    task: {
      id: idGenerator(),
      title: submitted.title.trim(),
      dueDate: submitted.dueDate,
      startAt,
      endAt,
      timezone,
      status: 'pending',
      completedAt: null,
      recurrence: clone(submitted.recurrence ?? null),
      listId: submitted.listId ?? null,
      tags: clone(submitted.tags === undefined ? [] : submitted.tags),
      priority: submitted.priority === undefined ? 'none' : submitted.priority,
      parentId: submitted.parentId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updateTask(task, changes, { clock = () => new Date() } = {}) {
  const submitted = changes && typeof changes === 'object' ? changes : {};
  const candidate = {
    title: hasOwn(submitted, 'title') ? submitted.title : task.title,
    dueDate: hasOwn(submitted, 'dueDate') ? submitted.dueDate : task.dueDate,
    timezone: hasOwn(submitted, 'timezone') ? submitted.timezone : task.timezone,
    tags: hasOwn(submitted, 'tags')
      ? submitted.tags === undefined
        ? task.tags
        : submitted.tags
      : task.tags,
    priority: hasOwn(submitted, 'priority')
      ? submitted.priority === undefined
        ? task.priority
        : submitted.priority
      : task.priority,
  };
  const errors = [];

  validateBaseFields(candidate, errors);
  validateCollectionFields(candidate, errors);
  const timezoneIsValid = validateTimezone(candidate.timezone, errors);
  let startAt = task.startAt;
  let endAt = task.endAt;

  if (timezoneIsValid && hasOwn(submitted, 'startAt')) {
    startAt = convertLocalTime(submitted.startAt, 'startAt', candidate.timezone, errors);
  }
  if (timezoneIsValid && hasOwn(submitted, 'endAt')) {
    endAt = convertLocalTime(submitted.endAt, 'endAt', candidate.timezone, errors);
  }

  if (startAt && endAt && Date.parse(endAt) < Date.parse(startAt)) {
    errors.push(
      fieldError(
        'endAt',
        'END_BEFORE_START',
        'endAt must not be earlier than startAt.',
        'Set endAt to the same time as or later than startAt.',
      ),
    );
  }

  if (errors.length > 0) {
    return validationFailure(errors, submitted);
  }

  return {
    ok: true,
    task: {
      ...clone(task),
      title: candidate.title.trim(),
      dueDate: candidate.dueDate,
      startAt,
      endAt,
      timezone: candidate.timezone,
      recurrence: hasOwn(submitted, 'recurrence')
        ? clone(submitted.recurrence)
        : clone(task.recurrence),
      listId: hasOwn(submitted, 'listId') ? submitted.listId ?? null : task.listId ?? null,
      tags: clone(candidate.tags),
      priority: candidate.priority === undefined ? 'none' : candidate.priority,
      parentId: hasOwn(submitted, 'parentId')
        ? submitted.parentId ?? null
        : task.parentId ?? null,
      id: task.id,
      createdAt: task.createdAt,
      updatedAt: nextUpdatedAt(clock, task.updatedAt),
    },
  };
}
