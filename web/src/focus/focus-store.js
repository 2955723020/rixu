import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DEFAULT_FOCUS_SETTINGS,
  completeBreakIfDue,
  completeDuePhase,
  createFocusSession,
  finishFocus,
  normalizeHydratedSession,
  pauseSession,
  resumeSession,
  startBreak as beginBreak,
} from './focus-machine.js';

export const FOCUS_STORAGE_KEY = 'rixu-focus:v1';

const defaultId = (prefix) => globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}`;
const browserClock = () => new Date(globalThis.__RIXU_TEST_CLOCK__?.now ?? Date.now());

function integerInRange(value, minimum, maximum, fallback) {
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function sanitizeSettings(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  return {
    focusMinutes: integerInRange(source.focusMinutes, 1, 180, DEFAULT_FOCUS_SETTINGS.focusMinutes),
    breakMinutes: integerInRange(source.breakMinutes, 1, 60, DEFAULT_FOCUS_SETTINGS.breakMinutes),
    lastMode: source.lastMode === 'stopwatch' || source.lastMode === 'pomodoro'
      ? source.lastMode
      : DEFAULT_FOCUS_SETTINGS.lastMode,
  };
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isValidRecord(record) {
  return Boolean(
    record
    && typeof record === 'object'
    && typeof record.id === 'string'
    && record.id
    && typeof record.sessionId === 'string'
    && record.sessionId
    && typeof record.subjectSnapshot === 'string'
    && record.subjectSnapshot.trim()
    && (record.mode === 'pomodoro' || record.mode === 'stopwatch')
    && (record.outcome === 'completed' || record.outcome === 'stopped-early')
    && Number.isFinite(record.focusedMs)
    && record.focusedMs >= 0
    && validDate(record.startedAt)
    && validDate(record.endedAt),
  );
}

function isValidSession(session) {
  const validStatus = ['running', 'paused', 'focus-complete', 'break-complete'].includes(session?.status);
  const validPhase = session?.phase === 'focus' || session?.phase === 'break';
  const validMode = session?.mode === 'pomodoro' || session?.mode === 'stopwatch';
  const validTarget = session?.mode === 'stopwatch' ? session.targetMs === null : Number.isFinite(session?.targetMs) && session.targetMs > 0;
  return Boolean(
    session
    && typeof session.id === 'string'
    && session.id
    && validMode
    && validPhase
    && validStatus
    && typeof session.subjectSnapshot === 'string'
    && session.subjectSnapshot.trim()
    && validDate(session.startedAt)
    && Number.isFinite(session.accumulatedMs)
    && session.accumulatedMs >= 0
    && validTarget
    && Number.isFinite(session.breakTargetMs)
    && session.breakTargetMs > 0,
  );
}

function appendRecord(records, record) {
  if (!record || records.some((existing) => existing.id === record.id)) return records;
  return [...records, record];
}

export function createFocusStore({
  clock = browserClock,
  idGenerator = () => defaultId('focus-session'),
  recordIdGenerator = () => defaultId('focus-record'),
  persist: shouldPersist = true,
} = {}) {
  const initializer = (set, get) => ({
    settings: { ...DEFAULT_FOCUS_SETTINGS },
    activeSession: null,
    records: [],
    readNow: clock,

    startSession(input) {
      if (get().activeSession) {
        return { ok: false, code: 'SESSION_ACTIVE', session: get().activeSession };
      }
      const result = createFocusSession(input, { now: clock(), idGenerator });
      if (!result.ok) return result;
      const settings = {
        focusMinutes: result.session.mode === 'pomodoro' ? input.focusMinutes : get().settings.focusMinutes,
        breakMinutes: result.session.mode === 'pomodoro' ? input.breakMinutes : get().settings.breakMinutes,
        lastMode: result.session.mode,
      };
      set({ activeSession: result.session, settings });
      return result;
    },

    pause() {
      const current = get().activeSession;
      const session = pauseSession(current, clock());
      if (session !== current) set({ activeSession: session });
      return session;
    },

    resume() {
      const current = get().activeSession;
      const session = resumeSession(current, clock());
      if (session !== current) set({ activeSession: session });
      return session;
    },

    tick() {
      const current = get().activeSession;
      if (!current) return { session: null, record: null, changed: false, sound: false };
      const result = current.phase === 'break'
        ? { ...completeBreakIfDue(current, clock()), record: null }
        : completeDuePhase(current, { now: clock(), recordIdGenerator });
      if (result.changed) {
        set((state) => ({
          activeSession: result.session,
          records: appendRecord(state.records, result.record),
        }));
      }
      return result;
    },

    finishEarly() {
      const current = get().activeSession;
      if (!current || current.phase !== 'focus') return { session: current, record: null, changed: false };
      const result = finishFocus(current, { now: clock(), outcome: 'stopped-early', recordIdGenerator });
      if (result.changed) {
        set((state) => ({
          activeSession: result.session,
          records: appendRecord(state.records, result.record),
        }));
      }
      return result;
    },

    startBreak() {
      const current = get().activeSession;
      if (current?.mode !== 'pomodoro') return current;
      const session = beginBreak(current, clock());
      if (session !== current) set({ activeSession: session });
      return session;
    },

    skipBreak() {
      if (get().activeSession?.phase !== 'break') return get().activeSession;
      set({ activeSession: null });
      return null;
    },

    clearCompleted() {
      const status = get().activeSession?.status;
      if (status !== 'focus-complete' && status !== 'break-complete') return get().activeSession;
      set({ activeSession: null });
      return null;
    },

    settleForHide() {
      const due = get().tick();
      if (due.changed) return due;
      const current = get().activeSession;
      if (current?.status !== 'running') return { session: current, record: null, changed: false, sound: false };
      const session = pauseSession(current, clock());
      set({ activeSession: session });
      return { session, record: null, changed: true, sound: false };
    },
  });

  return shouldPersist
    ? create(persist(initializer, {
        name: FOCUS_STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ settings: state.settings, activeSession: state.activeSession, records: state.records }),
        merge: (persisted, current) => {
          const state = persisted && typeof persisted === 'object' ? persisted : {};
          const activeSession = isValidSession(state.activeSession)
            ? normalizeHydratedSession(state.activeSession)
            : null;
          return {
            ...current,
            settings: sanitizeSettings(state.settings),
            activeSession,
            records: Array.isArray(state.records) ? state.records.filter(isValidRecord) : [],
          };
        },
      }))
    : create(initializer);
}

export const useFocusStore = createFocusStore();
