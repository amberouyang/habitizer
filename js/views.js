import { STREAK_DISPLAY_MIN } from "./constants.js";
import { state } from "./state.js";
import {
  appEl,
  pageTitleEl,
  backButton,
  menuButton,
  addButton,
} from "./dom.js";
import {
  formatDuration,
  formatDurationLabel,
  formatStreakLabel,
  formatStreakBadgeText,
  formatPersonalBestLabel,
  formatLastCompletedLabel,
  getCompletionEstimateMessage,
  getRoutineStreak,
  getWeeklyStats,
  getWeekdayShortLabel,
} from "./utils.js";
import {
  getRoutineById,
  getRoutineMetaText,
  getRoutineTotalDurationMs,
  getRoutineProgress,
  getActivityCompletionCount,
  formatActivityCompletionLabel,
  getTotalElapsedMs,
  getActivityElapsedMs,
  applyRoutineColorStyle,
  applyProgressFillColor,
  getActivityEstimatedMinutes,
  getActivityEstimatedMs,
  routineCompletedToday,
} from "./models.js";
import {
  addRoutine,
  renameRoutine,
  editRoutineTime,
  deleteRoutine,
  duplicateRoutine,
  openAddActivityModal,
  renameActivity,
  deleteActivity,
} from "./routines.js";
import {
  openColorModal,
  openCalendarModal,
} from "./modals.js";
import {
  startRoutine,
  pauseTimer,
  resumeTimer,
  advanceActivityState,
  getActivityRunStatus,
  applyActivityCheckboxState,
  hasRoutineClockStarted,
  requestEndRoutine,
} from "./timer.js";
import { setupActivityDragAndDrop, setupRoutineDragAndDrop } from "./drag.js";

export function setView(view, routineId = null) {
  state.currentView = view;
  state.currentRoutineId = routineId;

  pageTitleEl.onclick = null;
  pageTitleEl.style.cursor = "default";

  if (view === "home") {
    pageTitleEl.textContent = "Habitizer";
    pageTitleEl.title = "";
    backButton.classList.add("hidden");
    menuButton.classList.remove("hidden");
    addButton.classList.add("hidden");
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", "Add routine");
  } else if (view === "routine") {
    if (routineId !== state.calendarRoutineId) {
      state.routineCalendarOffset = 0;
      state.calendarRoutineId = routineId;
    }

    const routine = getRoutineById(routineId);
    pageTitleEl.textContent = routine ? routine.name : "Routine";
    pageTitleEl.title = routine ? routine.name : "";
    pageTitleEl.style.cursor = "pointer";
    pageTitleEl.onclick = () => renameRoutine(routineId);
    pageTitleEl.title = "Click to rename";
    backButton.classList.remove("hidden");
    menuButton.classList.remove("hidden");
    addButton.classList.add("hidden");
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", "Add activity");
  } else if (view === "timer") {
    pageTitleEl.textContent = "Live Routine";
    pageTitleEl.title = "";
    backButton.classList.add("hidden");
    menuButton.classList.add("hidden");
    addButton.classList.add("hidden");
  } else if (view === "complete") {
    pageTitleEl.textContent = "Routine complete";
    pageTitleEl.title = "";
    backButton.classList.add("hidden");
    menuButton.classList.add("hidden");
    addButton.classList.add("hidden");
  }

  render();
}

export function renderHomeView() {
  const home = document.createElement("div");
  home.className = "home-view";
  home.appendChild(renderWeeklyStats());

  const list = document.createElement("section");
  list.className = "routine-list";

  if (state.routines.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const title = document.createElement("p");
    title.className = "empty-state-title";
    title.textContent = "No routines yet";

    const hint = document.createElement("p");
    hint.className = "empty-state-hint";
    hint.textContent = "Create a morning routine to get started.";

    empty.append(title, hint);
    list.appendChild(empty);
  }

  const canReorderRoutines = state.routines.length > 1;

  state.routines.forEach((routine) => {
    const item = document.createElement("div");
    item.className = "routine-item";
    item.dataset.routineId = routine.id;
    applyRoutineColorStyle(item, routine);

    const main = document.createElement("div");
    main.className = "routine-main";

    if (canReorderRoutines) {
      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "drag-handle";
      dragHandle.setAttribute("aria-label", `Drag to reorder ${routine.name}`);
      dragHandle.title = "Drag to reorder";
      main.appendChild(dragHandle);
    }

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "routine-open";
    openBtn.title = `Open ${routine.name}`;
    openBtn.addEventListener("click", () => setView("routine", routine.id));

    const info = document.createElement("div");
    info.className = "routine-info";

    const nameRow = document.createElement("div");
    nameRow.className = "routine-name-row";

    const name = document.createElement("div");
    name.className = "routine-name";
    name.textContent = routine.name;
    name.title = routine.name;

    const streak = getRoutineStreak(routine);
    if (streak >= STREAK_DISPLAY_MIN) {
      const streakBadge = document.createElement("span");
      streakBadge.className = "streak-badge";
      streakBadge.textContent = `🔥 ${formatStreakBadgeText(streak)}`;
      streakBadge.title = formatStreakLabel(streak);
      nameRow.append(name, streakBadge);
    } else {
      nameRow.appendChild(name);
    }

    const meta = document.createElement("div");
    meta.className = "routine-meta";
    meta.textContent = getRoutineMetaText(routine);

    const lastCompleted = document.createElement("div");
    lastCompleted.className = "routine-last-completed";
    lastCompleted.textContent = formatLastCompletedLabel(routine);

    info.append(nameRow, meta, lastCompleted);
    openBtn.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const duplicateBtn = document.createElement("button");
    duplicateBtn.type = "button";
    duplicateBtn.className = "small-btn";
    duplicateBtn.textContent = "⎘";
    duplicateBtn.title = "Duplicate routine";
    duplicateBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      duplicateRoutine(routine.id);
    });

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "small-btn";
    renameBtn.textContent = "✎";
    renameBtn.title = "Rename routine";
    renameBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      renameRoutine(routine.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "small-btn delete-btn";
    deleteBtn.textContent = "🗑";
    deleteBtn.title = "Delete routine";
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteRoutine(routine.id);
    });

    actions.append(duplicateBtn, renameBtn, deleteBtn);
    main.append(openBtn);
    item.append(main, actions);
    list.appendChild(item);
  });

  if (canReorderRoutines) {
    setupRoutineDragAndDrop(list);
  }

  const addRoutineButton = document.createElement("button");
  addRoutineButton.type = "button";
  addRoutineButton.className = "primary-btn home-add-button";
  addRoutineButton.textContent = "Add routine";
  addRoutineButton.setAttribute("aria-label", "Add routine");
  addRoutineButton.addEventListener("click", addRoutine);
  list.appendChild(addRoutineButton);

  home.appendChild(list);
  return home;
}

function renderWeeklyStats() {
  const stats = getWeeklyStats(state.routines);
  const maxDay = Math.max(1, ...stats.dayCompletions);

  const section = document.createElement("section");
  section.className = "weekly-stats";
  section.setAttribute("aria-label", `This week ${stats.weekLabel}`);

  const header = document.createElement("div");
  header.className = "weekly-stats-header";

  const title = document.createElement("h2");
  title.className = "weekly-stats-title";
  title.textContent = "This week";

  const range = document.createElement("p");
  range.className = "weekly-stats-range";
  range.textContent = stats.weekLabel;

  header.append(title, range);

  const metrics = document.createElement("div");
  metrics.className = "weekly-stats-metrics";

  const metricDefs = [
    {
      label: "Completions",
      value: String(stats.completions),
      detail: stats.completions === 1 ? "routine day" : "routine days",
    },
    {
      label: "Active days",
      value: `${stats.activeDays}/7`,
      detail: stats.activeDays === 1 ? "day with a run" : "days with a run",
    },
    {
      label: "Time",
      value: formatDurationLabel(stats.totalTimeMs),
      detail: stats.runs === 1 ? "1 run logged" : `${stats.runs} runs logged`,
    },
  ];

  metricDefs.forEach((metric) => {
    const item = document.createElement("div");
    item.className = "weekly-stat";

    const label = document.createElement("span");
    label.className = "weekly-stat-label";
    label.textContent = metric.label;

    const value = document.createElement("span");
    value.className = "weekly-stat-value";
    value.textContent = metric.value;

    const detail = document.createElement("span");
    detail.className = "weekly-stat-detail";
    detail.textContent = metric.detail;

    item.append(label, value, detail);
    metrics.appendChild(item);
  });

  const chart = document.createElement("div");
  chart.className = "weekly-stats-chart";
  chart.setAttribute("role", "img");
  chart.setAttribute(
    "aria-label",
    `Daily completions: ${stats.dayCompletions.join(", ")}`
  );

  stats.weekKeys.forEach((dateKey, index) => {
    const count = stats.dayCompletions[index];
    const day = document.createElement("div");
    day.className = "weekly-stats-day";
    if (dateKey === stats.todayKey) day.classList.add("is-today");
    if (count > 0) day.classList.add("has-completions");

    const barWrap = document.createElement("div");
    barWrap.className = "weekly-stats-bar-wrap";

    const bar = document.createElement("div");
    bar.className = "weekly-stats-bar";
    bar.style.height = `${Math.max(count > 0 ? 18 : 6, Math.round((count / maxDay) * 100))}%`;
    bar.title = `${count} completion${count === 1 ? "" : "s"}`;

    barWrap.appendChild(bar);

    const weekday = document.createElement("span");
    weekday.className = "weekly-stats-weekday";
    weekday.textContent = getWeekdayShortLabel(dateKey);

    day.append(barWrap, weekday);
    chart.appendChild(day);
  });

  section.append(header, metrics, chart);
  return section;
}

export function renderRoutineView() {
  const routine = getRoutineById(state.currentRoutineId);
  if (!routine) {
    setView("home");
    return document.createElement("div");
  }

  const wrapper = document.createElement("div");

  const header = document.createElement("div");
  header.className = "section-header";

  const title = document.createElement("h2");
  title.textContent = "Activities";

  const headerActions = document.createElement("div");
  headerActions.className = "section-header-actions";

  const duplicateButton = document.createElement("button");
  duplicateButton.type = "button";
  duplicateButton.className = "small-btn";
  duplicateButton.textContent = "⎘";
  duplicateButton.title = "Duplicate routine";
  duplicateButton.addEventListener("click", () => duplicateRoutine(routine.id));

  const metaButton = document.createElement("button");
  metaButton.type = "button";
  metaButton.className = "small-btn";
  metaButton.textContent = "⏱";
  metaButton.title = "Edit time estimate";
  metaButton.addEventListener("click", () => editRoutineTime(routine.id));

  const colorButton = document.createElement("button");
  colorButton.type = "button";
  colorButton.className = "small-btn color-btn";
  colorButton.textContent = "🎨";
  colorButton.title = "Change color";
  colorButton.setAttribute("aria-label", "Change routine color");
  applyRoutineColorStyle(colorButton, routine);
  colorButton.addEventListener("click", () => openColorModal(routine.id));

  const calendarButton = document.createElement("button");
  calendarButton.type = "button";
  calendarButton.className = "small-btn calendar-btn";
  calendarButton.textContent = "📅";
  calendarButton.title = "Completion history";
  calendarButton.setAttribute("aria-label", "Completion history");
  if (routineCompletedToday(routine)) {
    calendarButton.classList.add("has-today");
  }
  calendarButton.addEventListener("click", () => openCalendarModal(routine.id));

  headerActions.append(duplicateButton, calendarButton, colorButton, metaButton);
  header.append(title, headerActions);

  const infoRow = document.createElement("button");
  infoRow.type = "button";
  infoRow.className = "summary-row summary-row-button";
  infoRow.title = "Edit estimated time";
  infoRow.innerHTML = `<span>Estimated time</span><strong>${formatDurationLabel(getRoutineTotalDurationMs(routine))}</strong>`;
  infoRow.addEventListener("click", () => editRoutineTime(routine.id));

  wrapper.append(header, infoRow);

  const activityList = document.createElement("div");
  activityList.className = "activity-list";

  if (routine.activities.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No activities yet. Add one to start building this routine.";
    activityList.appendChild(empty);
  } else {
    routine.activities.forEach((activity) => {
      const item = document.createElement("div");
      item.className = "activity-item";
      item.dataset.activityId = activity.id;

      const main = document.createElement("div");
      main.className = "activity-main";

      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "drag-handle";
      dragHandle.setAttribute("aria-label", `Drag to reorder ${activity.name}`);
      dragHandle.title = "Drag to reorder";

      const label = document.createElement("button");
      label.type = "button";
      label.className = "activity-name";
      label.textContent = activity.name;
      label.title = `Start with ${activity.name}`;
      label.addEventListener("click", () => startRoutine(routine.id, activity.id));

      const estimate = document.createElement("span");
      estimate.className = "activity-estimate";
      const estimateMinutes = getActivityEstimatedMinutes(activity);
      estimate.textContent = formatDurationLabel(estimateMinutes * 60 * 1000);
      estimate.title = "Estimated time";

      main.append(dragHandle, label, estimate);

      const controls = document.createElement("div");
      controls.className = "drag-controls";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "small-btn";
      editBtn.textContent = "✎";
      editBtn.title = "Edit activity";
      editBtn.setAttribute("aria-label", `Edit ${activity.name}`);
      editBtn.addEventListener("click", () => renameActivity(routine.id, activity.id));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "small-btn delete-btn";
      deleteBtn.textContent = "✕";
      deleteBtn.title = "Delete activity";
      deleteBtn.addEventListener("click", () => deleteActivity(routine.id, activity.id));

      controls.append(editBtn, deleteBtn);
      item.append(main, controls);
      activityList.appendChild(item);
    });

    setupActivityDragAndDrop(activityList, routine);
  }

  const actionRow = document.createElement("div");
  actionRow.className = "routine-actions";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "primary-btn";
  startBtn.textContent = "Start Routine";
  startBtn.disabled = routine.activities.length === 0;
  startBtn.addEventListener("click", () => startRoutine(routine.id));

  const addActivityButton = document.createElement("button");
  addActivityButton.type = "button";
  addActivityButton.className = "secondary-btn add-activity-btn";
  addActivityButton.textContent = "Add activity";
  addActivityButton.addEventListener("click", () => openAddActivityModal(routine.id));

  actionRow.append(startBtn, addActivityButton);
  wrapper.append(activityList, actionRow);
  return wrapper;
}

export function renderCompletionView() {
  const data = state.lastCompletion;
  if (!data) {
    setView("home");
    return document.createElement("div");
  }

  const wrapper = document.createElement("div");
  wrapper.className = "completion-view";

  const card = document.createElement("div");
  card.className = "summary-card completion-card";

  const headline = document.createElement("p");
  headline.className = "completion-headline";
  headline.textContent = data.routineName;
  headline.title = data.routineName;

  const totalEl = document.createElement("div");
  totalEl.className = "completion-total";
  totalEl.textContent = formatDuration(data.totalMs);

  card.append(headline, totalEl);

  if (data.streak > 0) {
    const streakBlock = document.createElement("div");
    streakBlock.className = "completion-streak-block";

    const streakEl = document.createElement("div");
    streakEl.className = "completion-streak";
    streakEl.textContent = formatStreakLabel(data.streak);
    streakBlock.appendChild(streakEl);

    if (data.isNewPersonalBest) {
      const badgeEl = document.createElement("div");
      badgeEl.className = "completion-streak-badge";
      badgeEl.textContent = "New personal best!";
      streakBlock.appendChild(badgeEl);
    } else if (data.longestStreak > data.streak) {
      const bestEl = document.createElement("div");
      bestEl.className = "completion-streak-best";
      bestEl.textContent = formatPersonalBestLabel(data.longestStreak);
      streakBlock.appendChild(bestEl);
    }

    card.appendChild(streakBlock);
  }

  if (data.estimatedMs > 0) {
    const estimateEl = document.createElement("div");
    const isUnderOrOn = data.totalMs <= data.estimatedMs;
    estimateEl.className = `completion-estimate ${isUnderOrOn ? "under" : "over"}`;
    estimateEl.textContent = `${formatDurationLabel(data.estimatedMs)} estimate · ${getCompletionEstimateMessage(data.totalMs, data.estimatedMs)}`;
    card.appendChild(estimateEl);
  }

  const breakdownTitle = document.createElement("div");
  breakdownTitle.className = "completion-section-title";
  breakdownTitle.textContent = "Activity breakdown";

  const activityList = document.createElement("div");
  activityList.className = "summary-list";

  data.activities.forEach((activity) => {
    const item = document.createElement("div");
    item.className = "summary-item";

    const name = document.createElement("span");
    name.textContent = activity.name;
    name.title = activity.name;

    const time = document.createElement("strong");
    time.textContent = formatDuration(activity.timeSpentMs);

    item.append(name, time);
    activityList.appendChild(item);
  });

  card.append(breakdownTitle, activityList);

  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "primary-btn completion-done-btn";
  doneBtn.textContent = "Done";
  doneBtn.addEventListener("click", () => {
    state.lastCompletion = null;
    setView("home");
  });

  wrapper.append(card, doneBtn);
  return wrapper;
}

export function renderTimerView() {
  const routine = getRoutineById(state.currentRoutineId);
  if (!routine) {
    setView("home");
    return document.createElement("div");
  }

  const wrapper = document.createElement("div");
  wrapper.className = "live-timer";

  const timerCard = document.createElement("div");
  timerCard.className = "timer-card";

  const totalTimeEl = document.createElement("div");
  totalTimeEl.className = "total-time";
  totalTimeEl.textContent = formatDuration(getTotalElapsedMs());

  const completionCountEl = document.createElement("div");
  completionCountEl.className = "activity-completion-count";
  const { completed, total } = getActivityCompletionCount(routine);
  completionCountEl.textContent = formatActivityCompletionLabel(routine);
  completionCountEl.classList.toggle("complete", total > 0 && completed === total);

  const timerCardChildren = [totalTimeEl, completionCountEl];

  if (!hasRoutineClockStarted()) {
    const hint = document.createElement("p");
    hint.className = "timer-start-hint";
    hint.textContent = "Tap an activity to begin";
    timerCardChildren.push(hint);
  }

  const { hasEstimate } = getRoutineProgress(routine);
  if (hasEstimate) {
    const progressSection = document.createElement("div");
    progressSection.className = "routine-progress";

    const progressLabel = document.createElement("div");
    progressLabel.className = "routine-progress-label";
    progressLabel.textContent = `${formatDuration(getTotalElapsedMs())} / ${formatDurationLabel(getRoutineTotalDurationMs(routine))}`;

    const progressTrack = document.createElement("div");
    progressTrack.className = "routine-progress-track";
    progressTrack.setAttribute("role", "progressbar");
    progressTrack.setAttribute("aria-valuemin", "0");
    progressTrack.setAttribute("aria-valuemax", "100");

    const progressFill = document.createElement("div");
    progressFill.className = "routine-progress-fill";
    const { percent, isOver } = getRoutineProgress(routine);
    progressFill.style.width = `${percent}%`;
    progressFill.classList.toggle("over", isOver);
    applyProgressFillColor(progressFill, routine);
    progressTrack.setAttribute("aria-valuenow", String(Math.round(percent)));

    progressTrack.appendChild(progressFill);
    progressSection.append(progressLabel, progressTrack);
    timerCardChildren.push(progressSection);
  }

  const progressList = document.createElement("div");
  progressList.className = "activity-progress";

  routine.activities.forEach((activity) => {
    const item = document.createElement("label");
    item.className = "progress-item";
    const status = getActivityRunStatus(activity.id);
    if (status === "active") item.classList.add("active");
    if (status === "completed") item.classList.add("completed");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.activityId = activity.id;
    applyActivityCheckboxState(checkbox, status);
    checkbox.addEventListener("click", (event) => {
      event.preventDefault();
      advanceActivityState(activity.id);
    });

    const labelText = document.createElement("span");
    labelText.className = "progress-label";
    labelText.textContent = activity.name;
    labelText.title = activity.name;

    const statusBadge = document.createElement("span");
    statusBadge.className = "progress-status";
    statusBadge.textContent = "In progress";
    statusBadge.hidden = status !== "active";

    const timeText = document.createElement("span");
    timeText.className = "progress-time";
    timeText.dataset.activityId = activity.id;
    const elapsedMs = getActivityElapsedMs(activity);
    const estimateMs = getActivityEstimatedMs(activity);
    timeText.textContent = estimateMs > 0
      ? `${formatDuration(elapsedMs)} / ${formatDurationLabel(estimateMs)}`
      : formatDuration(elapsedMs);
    if (estimateMs > 0 && elapsedMs > estimateMs) {
      timeText.classList.add("over");
    }

    item.append(checkbox, labelText, statusBadge, timeText);
    progressList.appendChild(item);
  });

  timerCard.append(...timerCardChildren, progressList);

  const controls = document.createElement("div");
  controls.className = "timer-controls";

  const pauseResumeBtn = document.createElement("button");
  pauseResumeBtn.type = "button";
  pauseResumeBtn.className = "secondary-btn";
  const clockStarted = hasRoutineClockStarted();
  pauseResumeBtn.textContent = state.timer.isRunning ? "Pause" : "Resume";
  pauseResumeBtn.disabled = !clockStarted;
  pauseResumeBtn.addEventListener("click", () => {
    if (state.timer.isRunning) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  });

  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "danger-btn";
  endBtn.textContent = "End Routine";
  endBtn.addEventListener("click", requestEndRoutine);

  controls.append(pauseResumeBtn, endBtn);
  wrapper.append(timerCard, controls);
  return wrapper;
}

export function render() {
  if (state.currentView === "home") {
    appEl.innerHTML = "";
    appEl.appendChild(renderHomeView());
    return;
  }

  if (state.currentView === "routine") {
    appEl.innerHTML = "";
    appEl.appendChild(renderRoutineView());
    return;
  }

  if (state.currentView === "timer") {
    appEl.innerHTML = "";
    appEl.appendChild(renderTimerView());
    return;
  }

  if (state.currentView === "complete") {
    appEl.innerHTML = "";
    appEl.appendChild(renderCompletionView());
  }
}
