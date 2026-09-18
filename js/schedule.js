import { SRS_INTERVAL_DAYS } from "./constants.js";
import { getLocalDateKey, shiftDateKey, formatRelativeCompletedDay } from "./utils.js";
import { t } from "./i18n.js";

export function isSpacedRepetitionEnabled(routine) {
  return Boolean(routine?.spacedRepetition);
}

export function getSrsLevel(routine) {
  const level = Number(routine?.srsLevel);
  if (!Number.isFinite(level) || level < 0) return 0;
  return Math.min(Math.floor(level), SRS_INTERVAL_DAYS.length - 1);
}

export function getNextDueDate(routine) {
  const value = routine?.nextDueDate;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function enableSpacedRepetition(routine) {
  if (!routine) return;
  routine.spacedRepetition = true;
  routine.srsLevel = 0;
  routine.nextDueDate = getLocalDateKey();
}

export function disableSpacedRepetition(routine) {
  if (!routine) return;
  routine.spacedRepetition = false;
  routine.srsLevel = 0;
  routine.nextDueDate = null;
}

export function setSpacedRepetitionEnabled(routine, enabled) {
  if (enabled) {
    enableSpacedRepetition(routine);
  } else {
    disableSpacedRepetition(routine);
  }
}

/**
 * After a completion: grow the interval when on time/early, shrink when overdue.
 * Returns the scheduled next due date, or null if SRS is off.
 */
export function advanceSpacedRepetitionOnComplete(routine) {
  if (!isSpacedRepetitionEnabled(routine)) return null;

  const today = getLocalDateKey();
  const due = getNextDueDate(routine);
  const wasOverdue = Boolean(due && due < today);
  let level = getSrsLevel(routine);

  if (wasOverdue) {
    level = Math.max(0, level - 1);
  }

  const intervalDays = SRS_INTERVAL_DAYS[level];
  routine.nextDueDate = shiftDateKey(today, intervalDays);

  if (!wasOverdue) {
    routine.srsLevel = Math.min(level + 1, SRS_INTERVAL_DAYS.length - 1);
  } else {
    routine.srsLevel = level;
  }

  return routine.nextDueDate;
}

export function getDueStatus(routine) {
  if (!isSpacedRepetitionEnabled(routine)) {
    return { kind: "off", nextDueDate: null, daysUntil: null };
  }

  const today = getLocalDateKey();
  const nextDueDate = getNextDueDate(routine) || today;
  if (nextDueDate === today) {
    return { kind: "due", nextDueDate, daysUntil: 0 };
  }
  if (nextDueDate < today) {
    let days = 0;
    let cursor = nextDueDate;
    while (cursor < today && days < 3660) {
      cursor = shiftDateKey(cursor, 1);
      days += 1;
    }
    return { kind: "overdue", nextDueDate, daysUntil: -days };
  }

  let days = 0;
  let cursor = today;
  while (cursor < nextDueDate && days < 3660) {
    cursor = shiftDateKey(cursor, 1);
    days += 1;
  }
  return { kind: "upcoming", nextDueDate, daysUntil: days };
}

/** Lower number = higher on Home. Overdue first, then due today, then the rest. */
export function getDueSortPriority(routine) {
  const kind = getDueStatus(routine).kind;
  if (kind === "overdue") return 0;
  if (kind === "due") return 1;
  return 2;
}

export function hasUrgentSpacedPractice(routines) {
  return (routines || []).some((routine) => {
    const kind = getDueStatus(routine).kind;
    return kind === "overdue" || kind === "due";
  });
}

/**
 * Home display order: overdue → due today → everything else.
 * Stable within each group (keeps the user's saved relative order).
 */
export function getRoutinesForHomeDisplay(routines) {
  if (!Array.isArray(routines) || routines.length < 2) {
    return Array.isArray(routines) ? [...routines] : [];
  }

  return routines
    .map((routine, index) => ({ routine, index, priority: getDueSortPriority(routine) }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.index - b.index;
    })
    .map((entry) => entry.routine);
}

export function formatDueDateLabel(dateKey) {
  return formatRelativeCompletedDay(dateKey) || dateKey;
}

export function formatDueLabel(routine) {
  const status = getDueStatus(routine);
  if (status.kind === "off") return null;

  if (status.kind === "due") {
    return t("srs.dueToday");
  }
  if (status.kind === "overdue") {
    const days = Math.abs(status.daysUntil || 0);
    if (days <= 1) return t("srs.overdue");
    return t("srs.overdueBy", { count: days });
  }
  if (status.daysUntil === 1) {
    return t("srs.dueTomorrow");
  }
  return t("srs.nextDue", { date: formatDueDateLabel(status.nextDueDate) });
}

/** Short value for the routine detail “Next practice” row. */
export function formatNextRepetitionValue(routine) {
  const status = getDueStatus(routine);
  if (status.kind === "off") return null;
  if (status.kind === "due") return t("srs.dueToday");
  if (status.kind === "overdue") {
    const days = Math.abs(status.daysUntil || 0);
    if (days <= 1) return t("srs.overdue");
    return t("srs.overdueBy", { count: days });
  }
  if (status.daysUntil === 1) return t("srs.dueTomorrow");
  return formatDueDateLabel(status.nextDueDate);
}

export function formatNextPracticeLabel(dateKey) {
  if (!dateKey) return null;
  return t("srs.nextPractice", { date: formatDueDateLabel(dateKey) });
}

export function copySpacedRepetitionFields(source, target) {
  if (!source || !target) return;
  if (!isSpacedRepetitionEnabled(source)) {
    target.spacedRepetition = false;
    target.srsLevel = 0;
    target.nextDueDate = null;
    return;
  }
  target.spacedRepetition = true;
  target.srsLevel = 0;
  target.nextDueDate = getLocalDateKey();
}

export function sanitizeSpacedRepetitionFields(routine) {
  const spacedRepetition = Boolean(routine?.spacedRepetition);
  if (!spacedRepetition) {
    return {
      spacedRepetition: false,
      srsLevel: 0,
      nextDueDate: null,
    };
  }

  const level = Number(routine?.srsLevel);
  const srsLevel = Number.isFinite(level) && level >= 0
    ? Math.min(Math.floor(level), SRS_INTERVAL_DAYS.length - 1)
    : 0;
  const nextDueDate =
    typeof routine?.nextDueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(routine.nextDueDate)
      ? routine.nextDueDate
      : getLocalDateKey();

  return { spacedRepetition: true, srsLevel, nextDueDate };
}
