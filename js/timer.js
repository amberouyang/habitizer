import { state, settings, liveTimerIntervalId, setLiveTimerIntervalId } from "./state.js";
import {
  formatDuration,
  formatDurationLabel,
  getRoutineCompletionDates,
  getRoutineStreak,
  getRoutineLongestStreak,
  getLongestStreakFromDates,
} from "./utils.js";
import {
  getRoutineById,
  getRoutineTotalDurationMs,
  getRoutineProgress,
  getActivityCompletionCount,
  formatActivityCompletionLabel,
  getTotalElapsedMs,
  getActivityElapsedMs,
  getActivityEstimatedMs,
  applyProgressFillColor,
  recordRoutineCompletion,
  recordRoutineRun,
} from "./models.js";
import { saveRoutines, saveTimerSession, clearTimerSession, loadTimerSession } from "./persistence.js";
import { openConfirmModal, closeConfirmModal } from "./modals.js";
import { setView, render } from "./views.js";

export function updateTimerDisplay() {
  const routine = getRoutineById(state.currentRoutineId);
  if (!routine || state.currentView !== "timer") return;

  const totalTimeEl = document.querySelector(".total-time");
  if (totalTimeEl) {
    totalTimeEl.textContent = formatDuration(getTotalElapsedMs());
  }

  const completionCountEl = document.querySelector(".activity-completion-count");
  if (completionCountEl) {
    const { completed, total } = getActivityCompletionCount(routine);
    completionCountEl.textContent = formatActivityCompletionLabel(routine);
    completionCountEl.classList.toggle("complete", total > 0 && completed === total);
  }

  const progressFill = document.querySelector(".routine-progress-fill");
  const progressLabel = document.querySelector(".routine-progress-label");
  if (progressFill && progressLabel) {
    const { percent, isOver } = getRoutineProgress(routine);
    progressFill.style.width = `${percent}%`;
    progressFill.classList.toggle("over", isOver);
    applyProgressFillColor(progressFill, routine);
    progressLabel.textContent = `${formatDuration(getTotalElapsedMs())} / ${formatDurationLabel(getRoutineTotalDurationMs(routine))}`;

    const progressTrack = document.querySelector(".routine-progress-track");
    if (progressTrack) {
      progressTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
    }
  }

  routine.activities.forEach((activity) => {
    const checkbox = document.querySelector(`input[type="checkbox"][data-activity-id="${activity.id}"]`);
    const timeEl = document.querySelector(`.progress-time[data-activity-id="${activity.id}"]`);
    const progressItem = checkbox?.closest(".progress-item");
    const status = getActivityRunStatus(activity.id);

    if (checkbox) {
      applyActivityCheckboxState(checkbox, status);
    }

    if (progressItem) {
      progressItem.classList.toggle("active", status === "active");
      progressItem.classList.toggle("completed", status === "completed");
      const statusBadge = progressItem.querySelector(".progress-status");
      if (statusBadge) {
        statusBadge.hidden = status !== "active";
      }
    }

    if (timeEl) {
      const elapsedMs = getActivityElapsedMs(activity);
      const estimateMs = getActivityEstimatedMs(activity);
      timeEl.textContent = estimateMs > 0
        ? `${formatDuration(elapsedMs)} / ${formatDurationLabel(estimateMs)}`
        : formatDuration(elapsedMs);
      timeEl.classList.toggle("over", estimateMs > 0 && elapsedMs > estimateMs);
    }
  });
}

function ensureTimerSets() {
  if (!(state.timer.activeActivityIds instanceof Set)) {
    state.timer.activeActivityIds = new Set(state.timer.activeActivityIds || []);
  }
  if (!(state.timer.completedActivityIds instanceof Set)) {
    state.timer.completedActivityIds = new Set(state.timer.completedActivityIds || []);
  }
}

export function getActivityRunStatus(activityId) {
  ensureTimerSets();
  if (state.timer.completedActivityIds.has(activityId)) return "completed";
  if (state.timer.activeActivityIds.has(activityId)) return "active";
  return "idle";
}

export function applyActivityCheckboxState(checkbox, status) {
  if (!checkbox) return;
  checkbox.checked = status === "completed";
  checkbox.indeterminate = status === "active";
  checkbox.setAttribute(
    "aria-label",
    status === "completed"
      ? "Finished — tap to reset"
      : status === "active"
        ? "In progress — tap to finish"
        : "Tap to start"
  );
}

export function startLiveTimerLoop() {
  if (liveTimerIntervalId) {
    clearInterval(liveTimerIntervalId);
  }

  setLiveTimerIntervalId(setInterval(() => {
    if (state.currentView === "timer" && state.timer.isRunning) {
      updateTimerDisplay();
    }
  }, 100));
}

export function startRoutine(routineId, startActivityId = null) {
  const routine = getRoutineById(routineId);
  if (!routine || routine.activities.length === 0) return;

  const shouldStartActivity = startActivityId
    && routine.activities.some((activity) => activity.id === startActivityId);

  state.timer = {
    routineId,
    isRunning: shouldStartActivity,
    elapsedMs: 0,
    lastTimestamp: shouldStartActivity ? Date.now() : null,
    activeActivityIds: new Set(shouldStartActivity ? [startActivityId] : []),
    completedActivityIds: new Set(),
    activityStartTimes: shouldStartActivity
      ? { [startActivityId]: Date.now() }
      : {},
  };

  saveTimerSession();
  setView("timer", routineId);
  startLiveTimerLoop();
}

export function restoreTimerSession() {
  const session = loadTimerSession();
  if (!session?.routineId) {
    return false;
  }

  setView("timer", session.routineId);
  startLiveTimerLoop();
  saveTimerSession();
  return true;
}

export function pauseTimer() {
  if (!state.timer.routineId || !state.timer.isRunning) return;

  const now = Date.now();
  state.timer.elapsedMs += now - state.timer.lastTimestamp;
  state.timer.lastTimestamp = null;
  state.timer.isRunning = false;

  const routine = getRoutineById(state.timer.routineId);
  if (!routine) return;

  Object.keys(state.timer.activityStartTimes).forEach((activityId) => {
    const activity = routine.activities.find((item) => item.id === activityId);
    if (!activity) return;

    activity.timeSpentMs += now - state.timer.activityStartTimes[activityId];
    delete state.timer.activityStartTimes[activityId];
  });

  saveRoutines();
  saveTimerSession();
  render();
}

export function resumeTimer() {
  if (!state.timer.routineId || state.timer.isRunning) return;
  if (!hasRoutineClockStarted()) return;
  ensureTimerSets();

  state.timer.isRunning = true;
  state.timer.lastTimestamp = Date.now();

  state.timer.activeActivityIds.forEach((activityId) => {
    if (!state.timer.activityStartTimes[activityId]) {
      state.timer.activityStartTimes[activityId] = Date.now();
    }
  });

  saveTimerSession();
  render();
}

export function hasRoutineClockStarted() {
  ensureTimerSets();
  return Boolean(
    state.timer.isRunning
    || state.timer.elapsedMs > 0
    || state.timer.activeActivityIds.size > 0
    || state.timer.completedActivityIds.size > 0
  );
}

function ensureRoutineClockRunning(now = Date.now()) {
  if (state.timer.isRunning) return;
  state.timer.isRunning = true;
  state.timer.lastTimestamp = now;
}

export function advanceActivityState(activityId) {
  if (!state.timer.routineId) return;

  const routine = getRoutineById(state.timer.routineId);
  if (!routine) return;

  const activity = routine.activities.find((item) => item.id === activityId);
  if (!activity) return;

  ensureTimerSets();
  const status = getActivityRunStatus(activityId);
  const now = Date.now();

  if (status === "idle") {
    ensureRoutineClockRunning(now);
    state.timer.activeActivityIds.add(activityId);
    state.timer.activityStartTimes[activityId] = now;
  } else if (status === "active") {
    const start = state.timer.activityStartTimes[activityId];
    if (start) {
      activity.timeSpentMs += now - start;
    }
    delete state.timer.activityStartTimes[activityId];
    state.timer.activeActivityIds.delete(activityId);
    state.timer.completedActivityIds.add(activityId);
  } else {
    state.timer.completedActivityIds.delete(activityId);
  }

  saveRoutines();
  saveTimerSession();
  render();
}

/** @deprecated use advanceActivityState — kept for older call sites */
export function toggleActivityCompletion(activityId) {
  advanceActivityState(activityId);
}

export function endRoutine() {
  closeConfirmModal();

  const routine = getRoutineById(state.timer.routineId);
  if (!routine) return;

  const now = Date.now();
  if (state.timer.isRunning && state.timer.lastTimestamp) {
    state.timer.elapsedMs += now - state.timer.lastTimestamp;
  }

  Object.keys(state.timer.activityStartTimes).forEach((activityId) => {
    const activity = routine.activities.find((item) => item.id === activityId);
    if (!activity) return;

    activity.timeSpentMs += now - state.timer.activityStartTimes[activityId];
    delete state.timer.activityStartTimes[activityId];
  });

  const totalMs = getTotalElapsedMs();
  const estimatedMs = getRoutineTotalDurationMs(routine);
  const { completed, total } = getActivityCompletionCount(routine);
  const completionDatesBefore = getRoutineCompletionDates(routine);

  recordRoutineCompletion(routine);
  recordRoutineRun(routine, {
    totalMs,
    estimatedMs,
    activitiesCompleted: completed,
    activitiesTotal: total,
  });
  const streak = getRoutineStreak(routine);
  const longestStreak = getRoutineLongestStreak(routine);
  const previousLongestStreak = getLongestStreakFromDates(completionDatesBefore);

  state.lastCompletion = {
    routineId: routine.id,
    routineName: routine.name,
    totalMs,
    estimatedMs,
    streak,
    longestStreak,
    isNewPersonalBest: longestStreak > previousLongestStreak,
    activities: routine.activities.map((activity) => ({
      name: activity.name,
      timeSpentMs: Number(activity.timeSpentMs || 0),
    })),
  };

  if (!settings.cumulativeMode) {
    routine.activities.forEach((activity) => {
      activity.timeSpentMs = 0;
    });
  }

  state.timer = {
    routineId: null,
    isRunning: false,
    elapsedMs: 0,
    lastTimestamp: null,
    activeActivityIds: new Set(),
    completedActivityIds: new Set(),
    activityStartTimes: {},
  };

  if (liveTimerIntervalId) {
    clearInterval(liveTimerIntervalId);
    setLiveTimerIntervalId(null);
  }

  clearTimerSession();
  saveRoutines();
  setView("complete");
}

export function requestEndRoutine() {
  const routine = getRoutineById(state.timer.routineId);
  if (!routine) return;

  openConfirmModal({
    title: "End routine?",
    message: `Stop "${routine.name}"? Your progress will be saved, but the timer will end.`,
    confirmLabel: "End routine",
    onConfirm: endRoutine,
  });
}
