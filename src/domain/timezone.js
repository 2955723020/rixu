const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

const formatterCache = new Map();

export class TimeZoneConversionError extends RangeError {
  constructor(code, message, { localDateTime = null, timeZone = null } = {}) {
    super(message);
    this.name = 'TimeZoneConversionError';
    this.code = code;
    this.localDateTime = localDateTime;
    this.timeZone = timeZone;
  }
}

function getFormatter(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.length === 0) {
    throw new TimeZoneConversionError(
      'INVALID_TIMEZONE',
      'timezone must be a valid IANA timezone; choose a valid timezone.',
      { timeZone },
    );
  }

  if (formatterCache.has(timeZone)) {
    return formatterCache.get(timeZone);
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatter.format(new Date(0));
    formatterCache.set(timeZone, formatter);
    return formatter;
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    throw new TimeZoneConversionError(
      'INVALID_TIMEZONE',
      'timezone must be a valid IANA timezone; choose a valid timezone.',
      { timeZone },
    );
  }
}

function partsAt(epochMilliseconds, timeZone) {
  const values = {};
  for (const part of getFormatter(timeZone).formatToParts(new Date(epochMilliseconds))) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function utcEpoch(parts) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond ?? 0);
  return date.getTime();
}

function parseLocalDateTime(localDateTime, timeZone) {
  const match =
    typeof localDateTime === 'string' && LOCAL_DATE_TIME_PATTERN.exec(localDateTime);

  if (!match) {
    throw invalidLocalDateTime(localDateTime, timeZone);
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? '').padEnd(3, '0') || 0),
  };
  const epoch = utcEpoch(parts);
  const normalized = new Date(epoch);

  if (
    parts.year < 1 ||
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() + 1 !== parts.month ||
    normalized.getUTCDate() !== parts.day ||
    normalized.getUTCHours() !== parts.hour ||
    normalized.getUTCMinutes() !== parts.minute ||
    normalized.getUTCSeconds() !== parts.second ||
    normalized.getUTCMilliseconds() !== parts.millisecond
  ) {
    throw invalidLocalDateTime(localDateTime, timeZone);
  }

  return parts;
}

function invalidLocalDateTime(localDateTime, timeZone) {
  return new TimeZoneConversionError(
    'INVALID_LOCAL_DATETIME',
    'Local date-time is invalid in this timezone; choose an existing local date and time.',
    { localDateTime, timeZone },
  );
}

function sameWallTime(actual, expected) {
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute &&
    actual.second === expected.second
  );
}

function offsetAt(epochMilliseconds, timeZone) {
  const instantToSecond = Math.trunc(epochMilliseconds / 1000) * 1000;
  return utcEpoch(partsAt(instantToSecond, timeZone)) - instantToSecond;
}

export function localDateTimeToInstant(localDateTime, timeZone) {
  getFormatter(timeZone);
  const localParts = parseLocalDateTime(localDateTime, timeZone);
  const wallEpoch = utcEpoch(localParts);
  const probeDistances = [0, -172_800_000, 172_800_000, -604_800_000, 604_800_000];
  const offsets = new Set(
    probeDistances.map((distance) => offsetAt(wallEpoch + distance, timeZone)),
  );

  const candidates = [];
  for (const offset of offsets) {
    const candidate = wallEpoch - offset;
    if (sameWallTime(partsAt(candidate, timeZone), localParts)) {
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    throw invalidLocalDateTime(localDateTime, timeZone);
  }

  return new Date(Math.min(...candidates)).toISOString();
}

export function instantToLocalDateTime(instant, timeZone) {
  getFormatter(timeZone);
  const epoch =
    instant instanceof Date
      ? instant.getTime()
      : typeof instant === 'string' && /(Z|[+-]\d{2}:\d{2})$/.test(instant)
        ? Date.parse(instant)
        : Number.NaN;

  if (!Number.isFinite(epoch)) {
    throw new TimeZoneConversionError(
      'INVALID_INSTANT',
      'instant must be an ISO 8601 absolute time; provide a value with Z or an offset.',
      { timeZone },
    );
  }

  const parts = partsAt(epoch, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`;
}
