import {
  STORAGE_KEY,
  SETTINGS_KEY,
  DELETED_ROUTINES_KEY,
  TIMER_SESSION_KEY,
  DELETED_ROUTINE_RETENTION_MS,
  TIMER_SESSION_MAX_AGE_MS,
} from "./constants.js";
import { state, settings, deletedRoutines, setDeletedRoutines } from "./state.js";
import { darkModeToggle, cumulativeToggle } from "./dom.js";

function emptyTimerState() {
  return {
    routineId: null,
    isRunning: false,
    elapsedMs: 0,
    lastTimestamp: null,
    completedActivityIds: new Set(),
    activityStartTimes: {},
  };
}

export function saveTimerSession() {
  if (!state.timer.routineId) {
    clearTimerSession();
    return;
  }

  const payload = {
    savedAt: Date.now(),
    routineId: state.timer.routineId,
    isRunning: Boolean(state.timer.isRunning),
    elapsedMs: Number(state.timer.elapsedMs || 0),
    lastTimestamp: state.timer.lastTimestamp,
    completedActivityIds: [...state.timer.completedActivityIds],
    activityStartTimes: { ...state.timer.activityStartTimes },
  };

  localStorage.setItem(TIMER_SESSION_KEY, JSON.stringify(payload));
}

export function clearTimerSession() {
  localStorage.removeItem(TIMER_SESSION_KEY);
}

export function loadTimerSession() {
  const stored = localStorage.getItem(TIMER_SESSION_KEY);
  if (!stored) {
    state.timer = emptyTimerState();
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    const savedAt = Number(parsed?.savedAt || 0);
    const routineId = parsed?.routineId;
    const routineExists = state.routines.some((routine) => routine.id === routineId);
    const isFresh = savedAt > 0 && Date.now() - savedAt <= TIMER_SESSION_MAX_AGE_MS;

    if (!routineId || !routineExists || !isFresh) {
      clearTimerSession();
      state.timer = emptyTimerState();
      return null;
    }

    const activityStartTimes = parsed.activityStartTimes && typeof parsed.activityStartTimes === "object"
      ? parsed.activityStartTimes
      : {};

    state.timer = {
      routineId,
      isRunning: Boolean(parsed.isRunning),
      elapsedMs: Number(parsed.elapsedMs || 0),
      lastTimestamp: parsed.isRunning && parsed.lastTimestamp ? Number(parsed.lastTimestamp) : null,
      completedActivityIds: new Set(
        Array.isArray(parsed.completedActivityIds) ? parsed.completedActivityIds : []
      ),
      activityStartTimes: parsed.isRunning ? activityStartTimes : {},
    };

    return state.timer;
  } catch {
    clearTimerSession();
    state.timer = emptyTimerState();
    return null;
  }
}

export function saveRoutines() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.routines));
}

export function loadRoutines() {
  const stored = localStorage.getItem(STORAGE_KEY);
  state.routines = stored ? JSON.parse(stored) : [];
}

export function loadDeletedRoutines() {
  const stored = localStorage.getItem(DELETED_ROUTINES_KEY);
  const parsed = stored ? JSON.parse(stored) : [];
  deletedRoutines.length = 0;
  deletedRoutines.push(...parsed);
  pruneExpiredDeletedRoutines();
}

export function saveDeletedRoutines() {
  localStorage.setItem(DELETED_ROUTINES_KEY, JSON.stringify(deletedRoutines));
}

export function pruneExpiredDeletedRoutines() {
  const cutoff = Date.now() - DELETED_ROUTINE_RETENTION_MS;
  const pruned = deletedRoutines.filter((entry) => entry.deletedAt >= cutoff);
  if (pruned.length !== deletedRoutines.length) {
    setDeletedRoutines(pruned);
    saveDeletedRoutines();
  }
}

export function archiveDeletedRoutine(routine, routineIndex) {
  if (!routine) return;

  pruneExpiredDeletedRoutines();
  setDeletedRoutines(deletedRoutines.filter((entry) => entry.routine.id !== routine.id));
  deletedRoutines.unshift({
    id: crypto.randomUUID(),
    deletedAt: Date.now(),
    routineIndex,
    routine: JSON.parse(JSON.stringify(routine)),
  });
  saveDeletedRoutines();
}

export function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function applyTheme() {
  document.documentElement.dataset.theme = settings.darkMode ? "dark" : "light";
}

export function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    Object.assign(settings, JSON.parse(stored));
  }
  settings.darkMode = Boolean(settings.darkMode);
  applyTheme();
  darkModeToggle.checked = settings.darkMode;
  cumulativeToggle.checked = settings.cumulativeMode;
}

export function seedData() {
  if (localStorage.getItem(STORAGE_KEY)) {
    return;
  }

  state.routines = [
    {
      id: crypto.randomUUID(),
      name: "Morning Routine",
      color: "sage",
      estimatedMinutes: 15,
      activities: [
        { id: crypto.randomUUID(), name: "Drink water", timeSpentMs: 0 },
        { id: crypto.randomUUID(), name: "Stretch", timeSpentMs: 0 },
        { id: crypto.randomUUID(), name: "Check calendar", timeSpentMs: 0 },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Evening Routine",
      color: "ocean",
      estimatedMinutes: 20,
      activities: [
        { id: crypto.randomUUID(), name: "Brush teeth", timeSpentMs: 0 },
        { id: crypto.randomUUID(), name: "Skincare", timeSpentMs: 0 },
        { id: crypto.randomUUID(), name: "Read", timeSpentMs: 0 },
      ],
    },
  ];

  saveRoutines();
}
