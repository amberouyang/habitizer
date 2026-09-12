export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatDurationLabel(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  return minutes === 0 ? "0 min" : `${minutes} min`;
}

export function getLocalDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(dateKey, dayOffset) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + dayOffset);
  return getLocalDateKey(date.getTime());
}

export function getRoutineCompletionDates(routine) {
  return Array.isArray(routine?.completionDates) ? routine.completionDates : [];
}

export function getRoutineRunHistory(routine) {
  return Array.isArray(routine?.runHistory) ? routine.runHistory : [];
}

export function getLastCompletedDateKey(routine) {
  const runs = getRoutineRunHistory(routine);
  if (runs.length > 0) {
    const latest = runs[0];
    if (typeof latest?.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(latest.dateKey)) {
      return latest.dateKey;
    }
    if (Number.isFinite(Number(latest?.completedAt))) {
      return getLocalDateKey(Number(latest.completedAt));
    }
  }

  const dates = getRoutineCompletionDates(routine);
  if (dates.length === 0) return null;
  return [...dates].sort().at(-1);
}

export function formatRelativeCompletedDay(dateKey) {
  if (!dateKey) return null;

  const today = getLocalDateKey();
  if (dateKey === today) return "Today";
  if (dateKey === shiftDateKey(today, -1)) return "Yesterday";

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const includeYear = year !== new Date().getFullYear();

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

export function formatLastCompletedLabel(routine) {
  const dateKey = getLastCompletedDateKey(routine);
  if (!dateKey) return "Not completed yet";
  return `Last completed ${formatRelativeCompletedDay(dateKey)}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Monday-start week keys for the local calendar week containing `timestamp`. */
export function getWeekDateKeys(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const dayDate = new Date(local);
    dayDate.setDate(local.getDate() + index);
    return getLocalDateKey(dayDate.getTime());
  });
}

export function formatWeekRangeLabel(startKey, endKey) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(
    undefined,
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" }
  );
  return `${startLabel}–${endLabel}`;
}

export function getWeekdayShortLabel(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, { weekday: "narrow" });
}

function getRunDateKey(run) {
  if (typeof run?.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(run.dateKey)) {
    return run.dateKey;
  }
  if (Number.isFinite(Number(run?.completedAt))) {
    return getLocalDateKey(Number(run.completedAt));
  }
  return null;
}

export function getWeeklyStats(routines, timestamp = Date.now()) {
  const weekKeys = getWeekDateKeys(timestamp);
  const weekSet = new Set(weekKeys);
  const dayCompletions = weekKeys.map(() => 0);
  const activeDays = new Set();
  let completions = 0;
  let runs = 0;
  let totalTimeMs = 0;

  (routines || []).forEach((routine) => {
    getRoutineCompletionDates(routine).forEach((dateKey) => {
      if (!weekSet.has(dateKey)) return;
      completions += 1;
      activeDays.add(dateKey);
      const index = weekKeys.indexOf(dateKey);
      if (index >= 0) dayCompletions[index] += 1;
    });

    getRoutineRunHistory(routine).forEach((run) => {
      const dateKey = getRunDateKey(run);
      if (!dateKey || !weekSet.has(dateKey)) return;
      runs += 1;
      totalTimeMs += Math.max(0, Number(run.totalMs) || 0);
    });
  });

  return {
    weekKeys,
    weekLabel: formatWeekRangeLabel(weekKeys[0], weekKeys[6]),
    completions,
    activeDays: activeDays.size,
    runs,
    totalTimeMs,
    dayCompletions,
    todayKey: getLocalDateKey(timestamp),
  };
}

export function formatRunCompletedAt(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getFastestRunMs(routine) {
  const runs = getRoutineRunHistory(routine).filter((run) => Number(run.totalMs) > 0);
  if (runs.length === 0) return null;
  return Math.min(...runs.map((run) => Number(run.totalMs)));
}

export function getRoutineStreak(routine) {
  const completionDates = new Set(getRoutineCompletionDates(routine));
  if (completionDates.size === 0) return 0;

  const today = getLocalDateKey();
  const yesterday = shiftDateKey(today, -1);
  let cursor = null;

  if (completionDates.has(today)) {
    cursor = today;
  } else if (completionDates.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (cursor && completionDates.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
}

export function getLongestStreakFromDates(completionDates) {
  const uniqueDates = [...new Set(completionDates)].sort();
  if (uniqueDates.length === 0) return 0;
  if (uniqueDates.length === 1) return 1;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < uniqueDates.length; i += 1) {
    const previousDate = uniqueDates[i - 1];
    const expectedPrevious = shiftDateKey(uniqueDates[i], -1);

    if (expectedPrevious === previousDate) {
      current += 1;
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
  }

  return longest;
}

export function getRoutineLongestStreak(routine) {
  return getLongestStreakFromDates(getRoutineCompletionDates(routine));
}

export function formatStreakLabel(streak) {
  if (streak <= 0) return null;
  return streak === 1 ? "1 day streak" : `${streak} days in a row`;
}

export function formatStreakBadgeText(streak) {
  return String(streak);
}

export function formatPersonalBestLabel(longestStreak) {
  if (longestStreak <= 0) return null;
  return longestStreak === 1 ? "Personal best: 1 day" : `Personal best: ${longestStreak} days`;
}

export function formatDeletedAtLabel(deletedAt) {
  return new Date(deletedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getCalendarMonthDate(offset = 0) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

export function formatCalendarMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function getDateKeyForDay(year, month, day) {
  const monthLabel = String(month + 1).padStart(2, "0");
  const dayLabel = String(day).padStart(2, "0");
  return `${year}-${monthLabel}-${dayLabel}`;
}

export function getCalendarWeeks(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

export function parseEstimatedMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return null;
  }
  return minutes;
}

export function getCompletionEstimateMessage(totalMs, estimatedMs) {
  if (estimatedMs <= 0) return null;

  const diffMs = Math.abs(totalMs - estimatedMs);
  const diffLabel = formatDurationLabel(diffMs);

  if (totalMs <= estimatedMs) {
    return totalMs === estimatedMs
      ? "Right on estimate"
      : `${diffLabel} under estimate`;
  }

  return `${diffLabel} over estimate`;
}
