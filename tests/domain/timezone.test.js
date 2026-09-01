import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TimeZoneConversionError,
  instantToLocalDateTime,
  localDateTimeToInstant,
} from '../../src/domain/timezone.js';

test('converts a local date-time in an IANA timezone to an ISO instant', () => {
  assert.equal(
    localDateTimeToInstant('2025-01-15T09:30', 'America/New_York'),
    '2025-01-15T14:30:00.000Z',
  );
});

test('formats one absolute instant in different display timezones without changing it', () => {
  const instant = localDateTimeToInstant('2025-01-15T09:30', 'America/New_York');

  assert.equal(
    instantToLocalDateTime(instant, 'America/New_York'),
    '2025-01-15T09:30:00',
  );
  assert.equal(
    instantToLocalDateTime(instant, 'Asia/Tokyo'),
    '2025-01-15T23:30:00',
  );
  assert.equal(instant, '2025-01-15T14:30:00.000Z');
});

test('rejects a local time skipped by the New York spring DST transition', () => {
  assert.throws(
    () => localDateTimeToInstant('2025-03-09T02:30', 'America/New_York'),
    (error) => {
      assert.ok(error instanceof TimeZoneConversionError);
      assert.equal(error.code, 'INVALID_LOCAL_DATETIME');
      assert.equal(error.localDateTime, '2025-03-09T02:30');
      assert.equal(error.timeZone, 'America/New_York');
      return true;
    },
  );
});

test('rejects invalid calendar values and unknown IANA timezones', () => {
  assert.throws(
    () => localDateTimeToInstant('2025-02-30T10:00', 'UTC'),
    (error) => error.code === 'INVALID_LOCAL_DATETIME',
  );
  assert.throws(
    () => localDateTimeToInstant('2025-02-20T10:00', 'Not/A_Zone'),
    (error) => error.code === 'INVALID_TIMEZONE',
  );
});
