export const DEFAULT_FOCUS_SETTINGS = Object.freeze({
  focusMinutes: 25,
  breakMinutes: 5,
  lastMode: 'pomodoro',
});

function toIso(now) {
  return new Date(now).toISOString();
}

function elapsedAt(session, now) {
  return getElapsedMs(session, now);
}

function validationError(field, code, message) {
  return { field, code, message };
}

function validDuration(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function completeSession(session, { now, outcome, recordIdGenerator, focusedMs }) {
  if (!session || session.phase !== 'focus' || session.recordId) {
    return { session, record: null, changed: false };
  }

  const elapsed = focusedMs ?? elapsedAt(session, now);
  const recordId = recordIdGenerator();
  const endedAt = toIso(now);
  const record = {
    id: recordId,
    sessionId: session.id,
    taskId: session.taskId,
    subjectSnapshot: session.subjectSnapshot,
    mode: session.mode,
    startedAt: session.startedAt,
    endedAt,
    focusedMs: elapsed,
    outcome,
  };

  return {
    session: {
      ...session,
      status: 'focus-complete',
      accumulatedMs: elapsed,
      resumedAt: null,
      recordId,
    },
    record,
    changed: true,
  };
}

export function createFocusSession(input = {}, { now = new Date(), idGenerator } = {}) {
  const errors = [];
  const mode = input.mode;
  const subjectSnapshot = typeof input.subjectSnapshot === 'string' ? input.subjectSnapshot.trim() : '';

  if (mode !== 'pomodoro' && mode !== 'stopwatch') {
    errors.push(validationError('mode', 'INVALID_MODE', 'mode must be pomodoro or stopwatch.'));
  }
  if (!subjectSnapshot) {
    errors.push(validationError('subjectSnapshot', 'REQUIRED', 'subjectSnapshot is required.'));
  }
  if (mode === 'pomodoro' && !validDuration(input.focusMinutes, 1, 180)) {
    errors.push(validationError('focusMinutes', 'OUT_OF_RANGE', 'focusMinutes must be an integer from 1 to 180.'));
  }
  if (mode === 'pomodoro' && !validDuration(input.breakMinutes, 1, 60)) {
    errors.push(validationError('breakMinutes', 'OUT_OF_RANGE', 'breakMinutes must be an integer from 1 to 60.'));
  }
  if (errors.length) return { ok: false, errors };

  const timestamp = toIso(now);
  const breakMinutes = mode === 'pomodoro' ? input.breakMinutes : DEFAULT_FOCUS_SETTINGS.breakMinutes;
  return {
    ok: true,
    session: {
      id: idGenerator(),
      mode,
      phase: 'focus',
      status: 'running',
      taskId: input.taskId ?? null,
      subjectSnapshot,
      startedAt: timestamp,
      resumedAt: timestamp,
      accumulatedMs: 0,
      targetMs: mode === 'pomodoro' ? input.focusMinutes * 60000 : null,
      breakTargetMs: breakMinutes * 60000,
      recordId: null,
    },
  };
}

export function getElapsedMs(session, now) {
  const base = Math.max(0, Number(session?.accumulatedMs) || 0);
  if (session?.status !== 'running' || !session.resumedAt) return base;
  return base + Math.max(0, new Date(now).getTime() - Date.parse(session.resumedAt));
}

export function pauseSession(session, now) {
  if (!session || session.status !== 'running') return session;
  return {
    ...session,
    status: 'paused',
    accumulatedMs: elapsedAt(session, now),
    resumedAt: null,
  };
}

export function resumeSession(session, now) {
  if (!session || session.status !== 'paused') return session;
  return { ...session, status: 'running', resumedAt: toIso(now) };
}

export function finishFocus(session, { now, outcome, recordIdGenerator } = {}) {
  return completeSession(session, { now, outcome, recordIdGenerator });
}

export function completeDuePhase(session, { now, recordIdGenerator } = {}) {
  if (!session || session.phase !== 'focus' || session.mode !== 'pomodoro' || session.status !== 'running') {
    return { session, record: null, changed: false, sound: false };
  }
  if (getElapsedMs(session, now) < session.targetMs) {
    return { session, record: null, changed: false, sound: false };
  }
  const result = completeSession(session, {
    now,
    outcome: 'completed',
    recordIdGenerator,
    focusedMs: session.targetMs,
  });
  return { ...result, sound: result.changed };
}

export function startBreak(session, now) {
  if (!session || session.phase !== 'focus' || session.status !== 'focus-complete') return session;
  return {
    ...session,
    phase: 'break',
    status: 'running',
    accumulatedMs: 0,
    resumedAt: toIso(now),
  };
}

export function completeBreakIfDue(session, now) {
  if (!session || session.phase !== 'break' || session.status !== 'running') {
    return { session, changed: false, sound: false };
  }
  if (getElapsedMs(session, now) < session.breakTargetMs) {
    return { session, changed: false, sound: false };
  }
  return {
    session: {
      ...session,
      status: 'break-complete',
      accumulatedMs: session.breakTargetMs,
      resumedAt: null,
    },
    changed: true,
    sound: true,
  };
}

export function normalizeHydratedSession(session) {
  if (!session || typeof session !== 'object') return null;
  if (session.status !== 'running') return session;
  return {
    ...session,
    status: 'paused',
    accumulatedMs: Math.max(0, Number(session.accumulatedMs) || 0),
    resumedAt: null,
  };
}
