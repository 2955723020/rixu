import { getLocalDateKey, shiftDateKey } from '../lib/clock.js';

function recordTime(record) {
  const value = Date.parse(record?.endedAt);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function recordDuration(record) {
  return Math.max(0, Number(record?.focusedMs) || 0);
}

export function getFocusSummary(records = [], { now = new Date(), timeZone = 'UTC' } = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const today = getLocalDateKey(now, timeZone);
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const monday = shiftDateKey(today, -((weekday + 6) % 7));
  const sevenDayStart = shiftDateKey(today, -6);
  const dailyTotals = new Map();
  const subjectGroups = new Map();
  let todayMs = 0;
  let todayPomodoros = 0;
  let weekMs = 0;

  for (const record of safeRecords) {
    if (!Number.isFinite(Date.parse(record?.endedAt))) continue;
    const focusedMs = recordDuration(record);
    const date = getLocalDateKey(record.endedAt, timeZone);
    dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + focusedMs);

    if (date === today) {
      todayMs += focusedMs;
      if (record.mode === 'pomodoro' && record.outcome === 'completed') todayPomodoros += 1;
    }
    if (date >= monday && date <= today) weekMs += focusedMs;

    const subject = typeof record.subjectSnapshot === 'string' ? record.subjectSnapshot.trim() : '';
    const key = record.taskId ? `task:${record.taskId}` : `subject:${subject}`;
    const existing = subjectGroups.get(key);
    const endedAtMs = recordTime(record);
    if (!existing) {
      subjectGroups.set(key, { key, subject, focusedMs, latestAt: endedAtMs });
    } else {
      existing.focusedMs += focusedMs;
      if (subject && endedAtMs > existing.latestAt) {
        existing.subject = subject;
        existing.latestAt = endedAtMs;
      }
    }
  }

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateKey(sevenDayStart, index);
    return { date, focusedMs: dailyTotals.get(date) ?? 0 };
  });
  const bySubject = [...subjectGroups.values()]
    .map(({ latestAt: _latestAt, ...group }) => group)
    .sort((left, right) => right.focusedMs - left.focusedMs || left.key.localeCompare(right.key));
  const recent = [...safeRecords].sort((left, right) => recordTime(right) - recordTime(left));

  return { todayMs, todayPomodoros, weekMs, lastSevenDays, bySubject, recent };
}
