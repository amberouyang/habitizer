import {
  ROUTINE_COLORS,
  DEFAULT_ROUTINE_COLOR_ID,
} from "./constants.js";
import { state } from "./state.js";
import {
  formatDurationLabel,
  getRoutineCompletionDates,
  getLocalDateKey,
} from "./utils.js";

export function getRoutineById(routineId) {
  return state.routines.find((routine) => routine.id === routineId) || null;
}

export function isHexColor(value) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function normalizeHexColor(value) {
  if (!isHexColor(value)) return null;
  return value.toLowerCase();
}

export function isValidRoutineColor(value) {
  return Boolean(getRoutineColorById(value)) || isHexColor(value);
}

export function getRoutineColorById(colorId) {
  return ROUTINE_COLORS.find((color) => color.id === colorId) || null;
}

export function getRoutineColor(routine) {
  const color = routine?.color;
  const hex = normalizeHexColor(color);
  if (hex) {
    return { id: "custom", label: "Custom", value: hex };
  }
  return getRoutineColorById(color) || getRoutineColorById(DEFAULT_ROUTINE_COLOR_ID);
}

export function getRoutineColorValue(routine) {
  return getRoutineColor(routine).value;
}

export function getRoutineColorSelection(routine) {
  const hex = normalizeHexColor(routine?.color);
  if (hex) return hex;
  return getRoutineColor(routine).id;
}

export function getNextRoutineColorId() {
  return ROUTINE_COLORS[state.routines.length % ROUTINE_COLORS.length].id;
}

export function applyRoutineColorStyle(element, routine) {
  if (!element) return;
  element.style.setProperty("--routine-color", getRoutineColorValue(routine));
}

export function applyProgressFillColor(progressFill, routine) {
  if (!progressFill || !routine) return;

  const { isOver } = getRoutineProgress(routine);
  if (isOver) {
    progressFill.style.removeProperty("background");
  } else {
    progressFill.style.background = getRoutineColorValue(routine);
  }
}

export function getRoutineMetaText(routine) {
  return [
    `${routine.activities.length} activities`,
    formatDurationLabel(getRoutineTotalDurationMs(routine)),
  ].join(" • ");
}

export function getRoutineTotalDurationMs(routine) {
  if (!routine) return 0;
  return Number(routine.estimatedMinutes || 0) * 60 * 1000;
}

export function getRoutineProgress(routine) {
  const estimateMs = getRoutineTotalDurationMs(routine);
  const elapsedMs = getTotalElapsedMs();

  if (estimateMs <= 0) {
    return { hasEstimate: false, percent: 0, isOver: false };
  }

  return {
    hasEstimate: true,
    percent: Math.min(100, (elapsedMs / estimateMs) * 100),
    isOver: elapsedMs > estimateMs,
  };
}

export function getActivityCompletionCount(routine) {
  if (!routine) {
    return { completed: 0, total: 0 };
  }

  return {
    completed: state.timer.completedActivityIds.size,
    total: routine.activities.length,
  };
}

export function formatActivityCompletionLabel(routine) {
  const { completed, total } = getActivityCompletionCount(routine);
  if (total === 0) return "0 done";
  return `${completed} of ${total} done`;
}

export function getTotalElapsedMs() {
  if (!state.timer.routineId) return 0;

  let total = state.timer.elapsedMs;
  if (state.timer.isRunning && state.timer.lastTimestamp) {
    total += Date.now() - state.timer.lastTimestamp;
  }
  return total;
}

export function getActivityElapsedMs(activity) {
  if (!activity) return 0;

  let total = Number(activity.timeSpentMs || 0);
  const start = state.timer.activityStartTimes[activity.id];
  if (start && state.timer.isRunning) {
    total += Date.now() - start;
  }

  return total;
}

export function recordRoutineCompletion(routine) {
  if (!routine) return;

  const today = getLocalDateKey();
  const completionDates = getRoutineCompletionDates(routine);

  if (!completionDates.includes(today)) {
    routine.completionDates = [...completionDates, today];
  }
}

export function routineCompletedToday(routine) {
  return getRoutineCompletionDates(routine).includes(getLocalDateKey());
}
