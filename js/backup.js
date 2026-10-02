import { DEFAULT_ROUTINE_COLOR_ID, RUN_HISTORY_LIMIT, SAVED_COLORS_LIMIT, HOME_WIDGET_IDS, DEFAULT_HOME_WIDGETS } from "./constants.js";
import { state, settings, deletedRoutines, setDeletedRoutines } from "./state.js";
import {
  saveRoutines,
  saveSettings,
  saveDeletedRoutines,
  clearTimerSession,
  applyTheme,
  pruneExpiredDeletedRoutines,
  sanitizeHomeWidgets,
  sanitizeHiddenHomeWidgets,
  sanitizeCollapsedHomeWidgets,
  reconcileHomeWidgets,
} from "./persistence.js";
import { isValidRoutineColor, normalizeHexColor } from "./models.js";
import { sanitizeSpacedRepetitionFields } from "./schedule.js";
import { darkModeToggle, cumulativeToggle, completionSoundToggle, hapticsToggle, dueRemindersToggle } from "./dom.js";
import { sanitizeLanguage, applyDocumentLanguage } from "./i18n.js";
import { createId } from "./id.js";

const BACKUP_APP = "habitizer";
const BACKUP_VERSION = 1;

function sanitizeActivity(activity) {
  if (!activity || typeof activity !== "object") return null;

  const name = String(activity.name || "").trim();
  if (!name) return null;

  const estimatedMinutes = Number(activity.estimatedMinutes);

  return {
    id: typeof activity.id === "string" && activity.id ? activity.id : createId(),
    name: name.slice(0, 80),
    estimatedMinutes: Number.isFinite(estimatedMinutes) && estimatedMinutes >= 0
      ? estimatedMinutes
      : 0,
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
    id: typeof run.id === "string" && run.id ? run.id : createId(),
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
  const schedule = sanitizeSpacedRepetitionFields(routine);

  return {
    id: typeof routine.id === "string" && routine.id ? routine.id : createId(),
    name: name.slice(0, 80),
    color,
    estimatedMinutes: Number.isFinite(estimatedMinutes) && estimatedMinutes >= 0
      ? estimatedMinutes
      : 0,
    activities,
    completionDates,
    runHistory,
    ...schedule,
  };
}

function sanitizeDeletedEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const routine = sanitizeRoutine(entry.routine);
  if (!routine) return null;

  const deletedAt = Number(entry.deletedAt);
  const routineIndex = Number(entry.routineIndex);

  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
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
      completionSound: Boolean(settings.completionSound),
      haptics: Boolean(settings.haptics),
      dueReminders: Boolean(settings.dueReminders),
      savedColors: [...(settings.savedColors || [])],
      language: sanitizeLanguage(settings.language),
      homeWidgets: [...(settings.homeWidgets || [])],
      hiddenHomeWidgets: [...(settings.hiddenHomeWidgets || [])],
      collapsedHomeWidgets: [...(settings.collapsedHomeWidgets || [])],
    };
  }

  const savedColors = Array.isArray(raw.savedColors)
    ? raw.savedColors
        .filter((color) => typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color))
        .map((color) => color.toLowerCase())
        .filter((color, index, list) => list.indexOf(color) === index)
        .slice(0, SAVED_COLORS_LIMIT)
    : [...(settings.savedColors || [])];

  const next = {
    darkMode: Boolean(raw.darkMode),
    cumulativeMode: raw.cumulativeMode !== undefined
      ? Boolean(raw.cumulativeMode)
      : Boolean(settings.cumulativeMode),
    completionSound: raw.completionSound !== undefined
      ? Boolean(raw.completionSound)
      : Boolean(settings.completionSound),
    haptics: raw.haptics !== undefined
      ? Boolean(raw.haptics)
      : Boolean(settings.haptics),
    dueReminders: raw.dueReminders !== undefined
      ? Boolean(raw.dueReminders)
      : Boolean(settings.dueReminders),
    language: sanitizeLanguage(raw.language ?? settings.language),
    savedColors,
    homeWidgets: sanitizeHomeWidgets(raw.homeWidgets ?? settings.homeWidgets),
    hiddenHomeWidgets: sanitizeHiddenHomeWidgets(raw.hiddenHomeWidgets ?? settings.hiddenHomeWidgets),
    collapsedHomeWidgets: [],
  };

  // Reconcile using a temporary assign pattern without mutating live settings mid-sanitize.
  const visible = [...next.homeWidgets];
  let hidden = next.hiddenHomeWidgets.filter((id) => !visible.includes(id));
  HOME_WIDGET_IDS.forEach((id) => {
    if (!visible.includes(id) && !hidden.includes(id)) visible.push(id);
  });
  if (visible.length === 0) {
    next.homeWidgets = [...DEFAULT_HOME_WIDGETS];
    next.hiddenHomeWidgets = [];
    next.collapsedHomeWidgets = [];
  } else {
    next.homeWidgets = visible;
    next.hiddenHomeWidgets = hidden;
    next.collapsedHomeWidgets = sanitizeCollapsedHomeWidgets(
      raw.collapsedHomeWidgets ?? settings.collapsedHomeWidgets,
      visible
    );
  }

  return next;
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
      completionSound: Boolean(settings.completionSound),
      haptics: Boolean(settings.haptics),
      dueReminders: Boolean(settings.dueReminders),
      language: sanitizeLanguage(settings.language),
      savedColors: [...(settings.savedColors || [])],
      homeWidgets: sanitizeHomeWidgets(settings.homeWidgets),
      hiddenHomeWidgets: sanitizeHiddenHomeWidgets(settings.hiddenHomeWidgets),
      collapsedHomeWidgets: sanitizeCollapsedHomeWidgets(
        settings.collapsedHomeWidgets,
        settings.homeWidgets
      ),
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

function unionDateKeys(a = [], b = []) {
  return [...new Set([...(a || []), ...(b || [])].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

function mergeRunHistory(localRuns = [], remoteRuns = []) {
  const byId = new Map();
  [...(localRuns || []), ...(remoteRuns || [])].forEach((run) => {
    if (!run || typeof run !== "object") return;
    const key = typeof run.id === "string" && run.id
      ? run.id
      : `${run.completedAt}-${run.dateKey || ""}-${run.totalMs}`;
    const existing = byId.get(key);
    if (!existing || Number(run.completedAt) >= Number(existing.completedAt)) {
      byId.set(key, run);
    }
  });

  return [...byId.values()]
    .sort((a, b) => Number(b.completedAt) - Number(a.completedAt))
    .slice(0, RUN_HISTORY_LIMIT);
}

function pickNextDueDate(local, remote) {
  const localDue = typeof local?.nextDueDate === "string" ? local.nextDueDate : null;
  const remoteDue = typeof remote?.nextDueDate === "string" ? remote.nextDueDate : null;
  if (localDue && remoteDue) return localDue < remoteDue ? localDue : remoteDue;
  return remoteDue || localDue || null;
}

function mergeRoutine(local, remote) {
  const localLevel = Number(local.srsLevel) || 0;
  const remoteLevel = Number(remote.srsLevel) || 0;
  const spacedRepetition = Boolean(local.spacedRepetition || remote.spacedRepetition);

  return {
    ...local,
    name: remote.name || local.name,
    color: remote.color || local.color,
    estimatedMinutes: remote.estimatedMinutes,
    activities: Array.isArray(remote.activities) && remote.activities.length > 0
      ? remote.activities
      : local.activities,
    completionDates: unionDateKeys(local.completionDates, remote.completionDates),
    runHistory: mergeRunHistory(local.runHistory, remote.runHistory),
    spacedRepetition,
    srsLevel: spacedRepetition ? Math.max(localLevel, remoteLevel) : 0,
    nextDueDate: spacedRepetition ? pickNextDueDate(local, remote) : null,
  };
}

export function mergeRoutines(localRoutines, incomingRoutines) {
  const local = Array.isArray(localRoutines) ? localRoutines : [];
  const incoming = Array.isArray(incomingRoutines) ? incomingRoutines : [];
  const byId = new Map(local.map((routine) => [routine.id, { ...routine }]));

  incoming.forEach((remote) => {
    const existing = byId.get(remote.id);
    if (!existing) {
      byId.set(remote.id, remote);
      return;
    }
    byId.set(remote.id, mergeRoutine(existing, remote));
  });

  const merged = [];
  const seen = new Set();
  local.forEach((routine) => {
    merged.push(byId.get(routine.id));
    seen.add(routine.id);
  });
  incoming.forEach((routine) => {
    if (!seen.has(routine.id)) {
      merged.push(byId.get(routine.id));
      seen.add(routine.id);
    }
  });
  return merged;
}

function mergeDeletedRoutines(localDeleted, incomingDeleted) {
  const byKey = new Map();
  [...(localDeleted || []), ...(incomingDeleted || [])].forEach((entry) => {
    if (!entry?.routine) return;
    const key = entry.id || entry.routine.id;
    const existing = byKey.get(key);
    if (!existing || Number(entry.deletedAt) >= Number(existing.deletedAt)) {
      byKey.set(key, entry);
    }
  });
  return [...byKey.values()].sort((a, b) => Number(b.deletedAt) - Number(a.deletedAt));
}

function mergeSettings(localSettings, incomingSettings) {
  const localColors = Array.isArray(localSettings.savedColors) ? localSettings.savedColors : [];
  const remoteColors = Array.isArray(incomingSettings.savedColors) ? incomingSettings.savedColors : [];
  const savedColors = [...localColors, ...remoteColors]
    .filter((color) => typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color))
    .map((color) => color.toLowerCase())
    .filter((color, index, list) => list.indexOf(color) === index)
    .slice(0, SAVED_COLORS_LIMIT);

  // Keep the live app preferences; only absorb extra saved colors from the backup.
  return {
    ...localSettings,
    savedColors,
  };
}

function resetTransientState() {
  state.timer = {
    routineId: null,
    isRunning: false,
    elapsedMs: 0,
    lastTimestamp: null,
    activeActivityIds: new Set(),
    completedActivityIds: new Set(),
    activityStartTimes: {},
  };
  state.lastCompletion = null;
  state.currentRoutineId = null;
  state.routineCalendarOffset = 0;
  state.calendarRoutineId = null;
  clearTimerSession();
}

function syncSettingsToggles() {
  if (darkModeToggle) darkModeToggle.checked = settings.darkMode;
  if (cumulativeToggle) cumulativeToggle.checked = settings.cumulativeMode;
  if (completionSoundToggle) completionSoundToggle.checked = settings.completionSound;
  if (hapticsToggle) hapticsToggle.checked = settings.haptics;
  if (dueRemindersToggle) dueRemindersToggle.checked = settings.dueReminders;
}

export function applyBackup(parsed) {
  state.routines = parsed.routines;
  Object.assign(settings, parsed.settings);
  reconcileHomeWidgets();
  setDeletedRoutines(parsed.deletedRoutines);
  resetTransientState();
  saveRoutines();
  saveSettings();
  pruneExpiredDeletedRoutines();
  saveDeletedRoutines();
  applyTheme();
  applyDocumentLanguage();
  syncSettingsToggles();
}

/** Keep local routines/settings; add new backup routines and union history for shared ids. */
export function mergeBackup(parsed) {
  state.routines = mergeRoutines(state.routines, parsed.routines);
  Object.assign(settings, mergeSettings(settings, parsed.settings));
  reconcileHomeWidgets();
  setDeletedRoutines(mergeDeletedRoutines(deletedRoutines, parsed.deletedRoutines));
  resetTransientState();
  saveRoutines();
  saveSettings();
  pruneExpiredDeletedRoutines();
  saveDeletedRoutines();
  applyTheme();
  applyDocumentLanguage();
  syncSettingsToggles();
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
