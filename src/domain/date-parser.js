import { instantToLocalDateTime } from './timezone.js';

const AFTERNOON_TIME_PATTERN =
  /下午\s*(\d{1,2})\s*点(?:\s*(\d{1,2})\s*分?)?(?!\s*\d)/;

function nextCalendarDate(localDate) {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function parseAfternoonTime(text) {
  const match = AFTERNOON_TIME_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour < 1 || hour > 12 || minute > 59) {
    return null;
  }

  const twentyFourHour = hour === 12 ? 12 : hour + 12;
  return `${String(twentyFourHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseChineseDate(
  originalText,
  { now = new Date(), timeZone = 'UTC' } = {},
) {
  const text = typeof originalText === 'string' ? originalText : '';
  const hasTomorrow = text.includes('明天');
  const time = parseAfternoonTime(text);
  const dueDate = hasTomorrow
    ? nextCalendarDate(instantToLocalDateTime(now, timeZone).slice(0, 10))
    : null;
  const missingFields = [];

  if (dueDate === null) {
    missingFields.push('dueDate');
  }
  if (time === null) {
    missingFields.push('time');
  }

  const recognizedFields = Number(dueDate !== null) + Number(time !== null);
  return {
    originalText,
    status:
      recognizedFields === 2 ? 'success' : recognizedFields === 1 ? 'partial' : 'failure',
    dueDate,
    time,
    recurrence: null,
    missingFields,
    nextAction: recognizedFields === 2 ? null : 'manual-date-time',
  };
}
