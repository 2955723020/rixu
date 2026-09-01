import { randomUUID } from 'node:crypto';

function clone(value) {
  return structuredClone(value);
}

function toIsoTimestamp(value, dependencyName) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError(`${dependencyName} must return a valid date or timestamp.`);
  }
  return date.toISOString();
}

function nameError() {
  return {
    field: 'name',
    code: 'REQUIRED',
    message: 'name must not be empty.',
    action: 'Enter a non-empty list name.',
  };
}

function validateName(name, input) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { ok: false, errors: [nameError()], input: clone(input) };
  }
  return null;
}

function nextUpdatedAt(clock, previousUpdatedAt) {
  const current = Date.parse(toIsoTimestamp(clock(), 'clock'));
  const previous = Date.parse(previousUpdatedAt);
  return new Date(Math.max(current, previous + 1)).toISOString();
}

export function createList(
  input,
  { clock = () => new Date(), idGenerator = randomUUID } = {},
) {
  const submitted = input && typeof input === 'object' ? input : {};
  const failure = validateName(submitted.name, submitted);
  if (failure) {
    return failure;
  }

  const timestamp = toIsoTimestamp(clock(), 'clock');
  return {
    ok: true,
    list: {
      id: idGenerator(),
      name: submitted.name.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function renameList(list, changes, { clock = () => new Date() } = {}) {
  const submitted = changes && typeof changes === 'object' ? changes : {};
  const failure = validateName(submitted.name, submitted);
  if (failure) {
    return failure;
  }

  return {
    ok: true,
    list: {
      ...clone(list),
      name: submitted.name.trim(),
      id: list.id,
      createdAt: list.createdAt,
      updatedAt: nextUpdatedAt(clock, list.updatedAt),
    },
  };
}
