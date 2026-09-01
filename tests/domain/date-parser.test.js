import assert from 'node:assert/strict';
import test from 'node:test';

import { parseChineseDate } from '../../src/domain/date-parser.js';

const shanghaiOptions = {
  now: new Date('2025-01-10T08:00:00.000Z'),
  timeZone: 'Asia/Shanghai',
};

test('TC-TASK-3 parses 明天下午3点 into a confirmable structured draft', () => {
  const result = parseChineseDate('明天下午3点', shanghaiOptions);

  assert.deepEqual(result, {
    originalText: '明天下午3点',
    status: 'success',
    dueDate: '2025-01-11',
    time: '15:00',
    recurrence: null,
    missingFields: [],
    nextAction: null,
  });
});

test('calculates 明天 from the injected instant in the requested timezone', () => {
  const now = new Date('2025-01-01T18:00:00.000Z');

  assert.equal(
    parseChineseDate('明天下午3点', { now, timeZone: 'Asia/Shanghai' }).dueDate,
    '2025-01-03',
  );
  assert.equal(
    parseChineseDate('明天下午3点', { now, timeZone: 'America/Los_Angeles' })
      .dueDate,
    '2025-01-02',
  );
});

test('returns partial and names the field that must be supplied manually', () => {
  assert.deepEqual(parseChineseDate('明天', shanghaiOptions), {
    originalText: '明天',
    status: 'partial',
    dueDate: '2025-01-11',
    time: null,
    recurrence: null,
    missingFields: ['time'],
    nextAction: 'manual-date-time',
  });

  assert.deepEqual(parseChineseDate('下午3点', shanghaiOptions), {
    originalText: '下午3点',
    status: 'partial',
    dueDate: null,
    time: '15:00',
    recurrence: null,
    missingFields: ['dueDate'],
    nextAction: 'manual-date-time',
  });
});

test('TC-TASK-4 returns failure without guessing values for unrecognized input', () => {
  assert.deepEqual(parseChineseDate('找时间处理', shanghaiOptions), {
    originalText: '找时间处理',
    status: 'failure',
    dueDate: null,
    time: null,
    recurrence: null,
    missingFields: ['dueDate', 'time'],
    nextAction: 'manual-date-time',
  });
});

test('does not accept a valid prefix of a malformed time token', () => {
  assert.deepEqual(parseChineseDate('明天下午3点159分', shanghaiOptions), {
    originalText: '明天下午3点159分',
    status: 'partial',
    dueDate: '2025-01-11',
    time: null,
    recurrence: null,
    missingFields: ['time'],
    nextAction: 'manual-date-time',
  });
});

test('returns an editable structured draft', () => {
  const draft = parseChineseDate('明天下午3点', shanghaiOptions);

  draft.dueDate = '2025-01-12';
  draft.time = '16:30';
  draft.recurrence = { frequency: 'daily', interval: 1 };
  draft.status = 'partial';

  assert.equal(draft.dueDate, '2025-01-12');
  assert.equal(draft.time, '16:30');
  assert.deepEqual(draft.recurrence, { frequency: 'daily', interval: 1 });
  assert.equal(draft.status, 'partial');
});
