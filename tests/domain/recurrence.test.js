import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateNextOccurrence } from '../../src/domain/recurrence.js';

test('calculates a daily occurrence and defaults interval to one day', () => {
  const recurrence = { frequency: 'daily' };

  const result = calculateNextOccurrence({ dueDate: '2025-01-15', recurrence });

  assert.deepEqual(result, {
    dueDate: '2025-01-16',
    recurrence: { frequency: 'daily', interval: 1 },
  });
  assert.deepEqual(recurrence, { frequency: 'daily' });
});

test('selects the next configured ISO weekday and honors weekly interval', () => {
  const result = calculateNextOccurrence({
    dueDate: '2025-01-15',
    recurrence: { frequency: 'weekly', weekdays: [1, 3], interval: 2 },
  });

  assert.deepEqual(result, {
    dueDate: '2025-01-27',
    recurrence: { frequency: 'weekly', weekdays: [1, 3], interval: 2 },
  });
});

test('uses a later configured weekday in the same active interval week', () => {
  const result = calculateNextOccurrence({
    dueDate: '2025-01-13',
    recurrence: { frequency: 'weekly', weekdays: [1, 3], interval: 2 },
  });

  assert.equal(result.dueDate, '2025-01-15');
});

test('wraps to the first configured weekday in the next active week', () => {
  const result = calculateNextOccurrence({
    dueDate: '2025-01-15',
    recurrence: { frequency: 'weekly', weekdays: [1, 3], interval: 1 },
  });

  assert.equal(result.dueDate, '2025-01-20');
});

test('preserves the monthly anchor day when a month has fewer days', () => {
  const recurrence = { frequency: 'monthly' };
  const first = calculateNextOccurrence({ dueDate: '2025-01-31', recurrence });
  const second = calculateNextOccurrence({ dueDate: first.dueDate, recurrence: first.recurrence });

  assert.equal(first.dueDate, '2025-02-28');
  assert.equal(second.dueDate, '2025-03-31');
  assert.equal(first.recurrence.anchorDay, 31);
  assert.equal(second.recurrence.anchorDay, 31);
  assert.deepEqual(recurrence, { frequency: 'monthly' });
});

test('calculates custom day, week, and month occurrences', () => {
  assert.equal(
    calculateNextOccurrence({
      dueDate: '2025-01-15',
      recurrence: { frequency: 'custom', interval: 3, unit: 'day' },
    }).dueDate,
    '2025-01-18',
  );
  assert.equal(
    calculateNextOccurrence({
      dueDate: '2025-01-15',
      recurrence: { frequency: 'custom', interval: 2, unit: 'week' },
    }).dueDate,
    '2025-01-29',
  );
  const monthly = calculateNextOccurrence({
    dueDate: '2025-01-31',
    recurrence: { frequency: 'custom', interval: 1, unit: 'month' },
  });
  const nextMonthly = calculateNextOccurrence({
    dueDate: monthly.dueDate,
    recurrence: monthly.recurrence,
  });
  assert.equal(monthly.dueDate, '2025-02-28');
  assert.equal(nextMonthly.dueDate, '2025-03-31');
  assert.deepEqual(monthly.recurrence, {
    frequency: 'custom',
    interval: 1,
    unit: 'month',
    anchorDay: 31,
  });
  assert.equal(nextMonthly.recurrence.anchorDay, 31);
});

test('returns field errors with corrective actions for invalid inputs', () => {
  const input = {
    dueDate: '2025-02-30',
    recurrence: { frequency: 'custom', interval: 0, unit: 'quarter', weekdays: [] },
  };

  const result = calculateNextOccurrence(input);

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map(({ field, code }) => ({ field, code })),
    [
      { field: 'dueDate', code: 'INVALID_DATE' },
      { field: 'recurrence.interval', code: 'INVALID_INTERVAL' },
      { field: 'recurrence.unit', code: 'INVALID_UNIT' },
    ],
  );
  for (const error of result.errors) {
    assert.equal(typeof error.action, 'string');
    assert.ok(error.action.length > 0);
  }
  assert.deepEqual(result.input, input);
});

test('rejects empty or out-of-range weekly weekdays', () => {
  for (const weekdays of [[], [0], [8], ['monday'], [1, 1]]) {
    const result = calculateNextOccurrence({
      dueDate: '2025-01-15',
      recurrence: { frequency: 'weekly', weekdays },
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].field, 'recurrence.weekdays');
    assert.equal(result.errors[0].code, 'INVALID_WEEKDAYS');
  }
});

test('rejects an invalid interval for every frequency that accepts the field', () => {
  const rules = [
    { frequency: 'daily', interval: 0 },
    { frequency: 'weekly', weekdays: [1], interval: 0 },
    { frequency: 'monthly', interval: 0 },
    { frequency: 'custom', interval: 0, unit: 'day' },
  ];

  for (const recurrence of rules) {
    const result = calculateNextOccurrence({ dueDate: '2025-01-15', recurrence });

    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        ({ field, code }) =>
          field === 'recurrence.interval' && code === 'INVALID_INTERVAL',
      ),
    );
  }
});

test('directs multi-month intervals to the custom month rule', () => {
  const result = calculateNextOccurrence({
    dueDate: '2025-01-31',
    recurrence: { frequency: 'monthly', interval: 2 },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map(({ field, code }) => ({ field, code })),
    [{ field: 'recurrence.interval', code: 'INVALID_INTERVAL' }],
  );
  assert.match(result.errors[0].action, /custom/i);
});

test('returns a structured failure for a malformed invocation', () => {
  const result = calculateNextOccurrence(null);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].field, 'dueDate');
  assert.equal(result.errors[0].code, 'INVALID_DATE');
});

test('returns field errors instead of throwing for non-structured input values', () => {
  const recurrence = { frequency: 'daily', metadata: () => 'not data' };
  const invalidRule = calculateNextOccurrence({
    dueDate: '2025-01-15',
    recurrence,
  });
  const invalidDate = calculateNextOccurrence({
    dueDate: Symbol('invalid date'),
    recurrence: { frequency: 'daily' },
  });

  assert.equal(invalidRule.ok, false);
  assert.deepEqual(
    invalidRule.errors.map(({ field, code }) => ({ field, code })),
    [{ field: 'recurrence', code: 'INVALID_STRUCTURE' }],
  );
  assert.equal(invalidDate.ok, false);
  assert.ok(
    invalidDate.errors.some(
      ({ field, code }) => field === 'dueDate' && code === 'INVALID_DATE',
    ),
  );
  assert.equal(recurrence.frequency, 'daily');
});

test('rejects next occurrences outside the supported calendar range', () => {
  const inputs = [
    {
      dueDate: '9999-12-31',
      recurrence: { frequency: 'daily' },
    },
    {
      dueDate: '2025-01-01',
      recurrence: { frequency: 'daily', interval: Number.MAX_SAFE_INTEGER },
    },
  ];

  for (const input of inputs) {
    const result = calculateNextOccurrence(input);

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.errors.map(({ field, code }) => ({ field, code })),
      [{ field: 'dueDate', code: 'NEXT_DATE_OUT_OF_RANGE' }],
    );
    assert.ok(result.errors[0].action.length > 0);
    assert.deepEqual(result.input, input);
  }
});
