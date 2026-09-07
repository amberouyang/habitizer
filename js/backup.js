import { DEFAULT_ROUTINE_COLOR_ID, RUN_HISTORY_LIMIT } from "./constants.js";
import { state, settings, deletedRoutines, setDeletedRoutines } from "./state.js";
import {
  saveRoutines,
  saveSettings,
  saveDeletedRoutines,
  clearTimerSession,
  applyTheme,
  pruneExpiredDeletedRoutines,
} from "./persistence.js";
import { isValidRoutineColor, normalizeHexColor } from "./models.js";
import { darkModeToggle, cumulativeToggle } from "./dom.js";

const BACKUP_APP = "habitizer";
const BACKUP_VERSION = 1;

function sanitizeActivity(activity) {
  if (!activity || typeof activity !== "object") return null;

  const name = String(activity.name || "").trim();
  if (!name) return null;

  return {
    id: typeof activity.id === "string" && activity.id ? activity.id : crypto.randomUUID(),
    name: name.slice(0, 80),
    timeSpentMs: Math.max(0, Number(activity.timeSpentMs) || 0),
  };
}

function sanitizeRun(run) {
  if (!run || typeof run !== "object") return null;

  const completedAt = Number(run.completedAt);
  const totalMs = Number(run.totalMs);
  if (!Number.isFinite(completedAt) || !Number.isFinite(totalMs) || totalMs < 0) {
    return null;
  }

  const dateKey = typeof run.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(run.dateKey)
    ? run.dateKey
    : null;

  return {
    id: typeof run.id === "string" && run.id ? run.id : crypto.randomUUID(),
    completedAt,
    dateKey,
    totalMs,
    estimatedMs: Math.max(0, Number(run.estimatedMs) || 0),
    activitiesCompleted: Math.max(0, Number(run.activitiesCompleted) || 0),
    activitiesTotal: Math.max(0, Number(run.activitiesTotal) || 0),
  };
}

function sanitizeRoutine(routine) {
  if (!routine || typeof routine !== "object") return null;

  const name = String(routine.name || "").trim();
  if (!name) return null;

  const colorValue = routine.color;
  const color = isValidRoutineColor(colorValue)
    ? (normalizeHexColor(colorValue) || colorValue)
    : DEFAULT_ROUTINE_COLOR_ID;

  const estimatedMinutes = Number(routine.estimatedMinutes);
  const activities = Array.isArray(routine.activities)
    ? routine.activities.map(sanitizeActivity).filter(Boolean)
    : [];
  const completionDates = Array.isArray(routine.completionDates)
    ? [...new Set(routine.completionDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))]
    : [];
  const runHistory = Array.isArray(routine.runHistory)
    ? routine.runHistory.map(sanitizeRun).filter(Boolean).slice(0, RUN_HISTORY_LIMIT)
    : [];

  return {
    id: typeof routine.id === "string" && routine.id ? routine.id : crypto.randomUUID(),
    name: name.slice(0, 80),
    color,
    estimatedMinutes: Number.isFinite(estimatedMinutes) && estimatedMinutes >= 0
      ? estimatedMinutes
      : 0,
    activities,
    completionDates,
    runHistory,
  };
}

function sanitizeDeletedEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const routine = sanitizeRoutine(entry.routine);
  if (!routine) return null;

  const deletedAt = Number(entry.deletedAt);
  const routineIndex = Number(entry.routineIndex);

  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
    deletedAt: Number.isFinite(deletedAt) ? deletedAt : Date.now(),
    routineIndex: Number.isFinite(routineIndex) && routineIndex >= 0 ? routineIndex : 0,
    routine,
  };
}

function sanitizeSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      darkMode: Boolean(settings.darkMode),
      cumulativeMode: Boolean(settings.cumulativeMode),
    };
  }

  return {
    darkMode: Boolean(raw.darkMode),
    cumulativeMode: raw.cumulativeMode !== undefined
      ? Boolean(raw.cumulativeMode)
      : Boolean(settings.cumulativeMode),
  };
}

export function buildBackupPayload() {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    routines: state.routines,
    settings: {
      darkMode: Boolean(settings.darkMode),
      cumulativeMode: Boolean(settings.cumulativeMode),
    },
    deletedRoutines: deletedRoutines,
  };
}

export function parseBackupPayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Backup file is not valid JSON.");
  }

  if (raw.app && raw.app !== BACKUP_APP) {
    throw new Error("This file is not a Habitizer backup.");
  }

  if (raw.version != null && Number(raw.version) !== BACKUP_VERSION) {
    throw new Error("Unsupported backup version.");
  }

  if (!Array.isArray(raw.routines)) {
    throw new Error("Backup is missing routines data.");
  }

  const routines = raw.routines.map(sanitizeRoutine).filter(Boolean);
  const nextSettings = sanitizeSettings(raw.settings);
  const nextDeleted = Array.isArray(raw.deletedRoutines)
    ? raw.deletedRoutines.map(sanitizeDeletedEntry).filter(Boolean)
    : [];

  return {
    routines,
    settings: nextSettings,
    deletedRoutines: nextDeleted,
  };
}

export function exportBackup() {
  const payload = buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `habitizer-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function applyBackup(parsed) {
  state.routines = parsed.routines;
  Object.assign(settings, parsed.settings);
  setDeletedRoutines(parsed.deletedRoutines);

  state.timer = {
    routineId: null,
    isRunning: false,
    elapsedMs: 0,
    lastTimestamp: null,
    completedActivityIds: new Set(),
    activityStartTimes: {},
  };
  state.lastCompletion = null;
  state.currentRoutineId = null;
  state.routineCalendarOffset = 0;
  state.calendarRoutineId = null;

  clearTimerSession();
  saveRoutines();
  saveSettings();
  pruneExpiredDeletedRoutines();
  saveDeletedRoutines();
  applyTheme();

  if (darkModeToggle) darkModeToggle.checked = settings.darkMode;
  if (cumulativeToggle) cumulativeToggle.checked = settings.cumulativeMode;
}

export async function readBackupFile(file) {
  if (!file) {
    throw new Error("No file selected.");
  }

  const text = await file.text();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Could not read that file as JSON.");
  }

  return parseBackupPayload(raw);
}
