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
  applyProgressFillColor,
  recordRoutineCompletion,
} from "./models.js";
import { saveRoutines } from "./persistence.js";
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

    if (checkbox) {
      checkbox.checked = state.timer.completedActivityIds.has(activity.id);
    }

    if (timeEl) {
      timeEl.textContent = formatDuration(getActivityElapsedMs(activity));
    }
  });
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

export function startRoutine(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine || routine.activities.length === 0) return;

  state.timer = {
    routineId,
    isRunning: true,
    elapsedMs: 0,
    lastTimestamp: Date.now(),
    completedActivityIds: new Set(),
    activityStartTimes: {},
  };

  setView("timer", routineId);
  startLiveTimerLoop();
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
  render();
}

export function resumeTimer() {
  if (!state.timer.routineId || state.timer.isRunning) return;

  state.timer.isRunning = true;
  state.timer.lastTimestamp = Date.now();

  state.timer.completedActivityIds.forEach((activityId) => {
    if (!state.timer.activityStartTimes[activityId]) {
      state.timer.activityStartTimes[activityId] = Date.now();
    }
  });

  render();
}

export function toggleActivityCompletion(activityId, checked) {
  if (!state.timer.routineId) return;

  const routine = getRoutineById(state.timer.routineId);
  if (!routine) return;

  const activity = routine.activities.find((item) => item.id === activityId);
  if (!activity) return;

  const nextChecked = Boolean(checked);
  const isCurrentlyChecked = state.timer.completedActivityIds.has(activityId);

  if (isCurrentlyChecked === nextChecked) {
    return;
  }

  if (nextChecked) {
    state.timer.completedActivityIds.add(activityId);
    if (!state.timer.activityStartTimes[activityId]) {
      state.timer.activityStartTimes[activityId] = Date.now();
    }
  } else {
    const start = state.timer.activityStartTimes[activityId];
    if (start) {
      activity.timeSpentMs += Date.now() - start;
    }
    delete state.timer.activityStartTimes[activityId];
    state.timer.completedActivityIds.delete(activityId);
  }

  saveRoutines();

  if (state.currentView === "timer") {
    const checkbox = document.querySelector(`input[type="checkbox"][data-activity-id="${activityId}"]`);
    const timeEl = document.querySelector(`.progress-time[data-activity-id="${activityId}"]`);
    const progressItem = checkbox?.closest(".progress-item");
    if (checkbox) {
      checkbox.checked = nextChecked;
    }
    if (timeEl) {
      timeEl.textContent = formatDuration(getActivityElapsedMs(activity));
    }
    if (progressItem) {
      progressItem.classList.toggle("completed", nextChecked);
    }

    const completionCountEl = document.querySelector(".activity-completion-count");
    if (completionCountEl) {
      const { completed, total } = getActivityCompletionCount(routine);
      completionCountEl.textContent = formatActivityCompletionLabel(routine);
      completionCountEl.classList.toggle("complete", total > 0 && completed === total);
    }
  }
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
  const completionDatesBefore = getRoutineCompletionDates(routine);

  recordRoutineCompletion(routine);
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
    completedActivityIds: new Set(),
    activityStartTimes: {},
  };

  if (liveTimerIntervalId) {
    clearInterval(liveTimerIntervalId);
    setLiveTimerIntervalId(null);
  }

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
