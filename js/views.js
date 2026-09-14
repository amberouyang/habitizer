import { STREAK_DISPLAY_MIN } from "./constants.js";
import { t, getHomeWidgetLabel } from "./i18n.js";
import { state } from "./state.js";
import {
  appEl,
  pageTitleEl,
  backButton,
  menuButton,
  addButton,
  tabBar,
  settingsView,
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
  getRoutineRunHistory,
  formatRunCompletedAt,
  getRoutineYearlyContributions,
  formatContributionDayLabel,
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
  syncSettingsView,
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
import { setupActivityDragAndDrop, setupRoutineDragAndDrop, setupHomeWidgetDragAndDrop } from "./drag.js";
import { reconcileHomeWidgets, setHomeWidgetCollapsed, isHomeWidgetCollapsed, setHomeWidgetVisibility } from "./persistence.js";

const TAB_VIEWS = new Set(["home", "history", "settings"]);

function updateChrome(view) {
  const showTabs = TAB_VIEWS.has(view);
  tabBar?.classList.toggle("hidden", !showTabs);
  document.querySelector(".app-shell")?.classList.toggle("tab-bar-hidden", !showTabs);

  tabBar?.querySelectorAll(".tab-btn").forEach((btn) => {
    const isActive = btn.dataset.tab === view;
    btn.classList.toggle("is-active", isActive);
    if (isActive) {
      btn.setAttribute("aria-current", "page");
    } else {
      btn.removeAttribute("aria-current");
    }
  });

  if (settingsView) {
    const showSettings = view === "settings";
    settingsView.hidden = !showSettings;
    settingsView.classList.toggle("hidden", !showSettings);
  }

  if (appEl) {
    // Use the HTML hidden attribute (display:none). Do NOT use the shared
    // `.hidden` class here — that only sets visibility:hidden for topbar slots
    // and can leave Home looking blank while content is still in the DOM.
    const showApp = view !== "settings";
    appEl.hidden = !showApp;
    appEl.classList.remove("hidden");
  }
}

export function setView(view, routineId = null) {
  state.currentView = view;
  state.currentRoutineId = routineId;

  pageTitleEl.onclick = null;
  pageTitleEl.style.cursor = "default";
  menuButton?.classList.add("hidden");

  if (view === "home") {
    pageTitleEl.textContent = t("app.name");
    pageTitleEl.title = "";
    backButton.classList.add("hidden");
    addButton.classList.remove("hidden");
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", t("app.addRoutine"));
  } else if (view === "history") {
    pageTitleEl.textContent = t("nav.history");
    pageTitleEl.title = "";
    backButton.classList.add("hidden");
    addButton.classList.add("hidden");
  } else if (view === "settings") {
    pageTitleEl.textContent = t("settings.title");
    pageTitleEl.title = "";
    backButton.classList.add("hidden");
    addButton.classList.add("hidden");
  } else if (view === "routine") {
    if (routineId !== state.calendarRoutineId) {
      state.routineCalendarOffset = 0;
      state.calendarRoutineId = routineId;
    }

    const routine = getRoutineById(routineId);
    pageTitleEl.textContent = routine ? routine.name : t("view.routine");
    pageTitleEl.title = routine ? routine.name : "";
    pageTitleEl.style.cursor = "pointer";
    pageTitleEl.onclick = () => renameRoutine(routineId);
    pageTitleEl.title = t("view.renameHint");
    backButton.classList.remove("hidden");
    addButton.classList.add("hidden");
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", t("app.addActivity"));
  } else if (view === "timer") {
    pageTitleEl.textContent = t("view.liveRoutine");
    pageTitleEl.title = "";
    backButton.classList.add("hidden");
    addButton.classList.add("hidden");
  } else if (view === "complete") {
    pageTitleEl.textContent = t("view.complete");
    pageTitleEl.title = "";
    backButton.classList.add("hidden");
    addButton.classList.add("hidden");
  }

  updateChrome(view);
  render();
}

export function renderHomeView() {
  const home = document.createElement("div");
  home.className = "home-view";

  const order = reconcileHomeWidgets();
  const routinesVisible = order.includes("routines");

  order.forEach((widgetId) => {
    if (widgetId === "weekly") {
      home.appendChild(createHomeWidget("weekly", renderWeeklyStatsContent()));
      return;
    }
    if (widgetId === "routines") {
      home.appendChild(createHomeWidget("routines", renderRoutinesWidgetContent()));
    }
  });

  if (!routinesVisible) {
    home.appendChild(
      createHomeEmptyState({
        title: t("home.routinesHiddenTitle"),
        hint: t("home.routinesHiddenHint"),
        actions: [
          {
            label: t("home.showRoutines"),
            primary: true,
            onClick: () => {
              if (setHomeWidgetVisibility("routines", true)) {
                render();
              }
            },
          },
          {
            label: t("home.openSettings"),
            onClick: () => setView("settings"),
          },
        ],
      })
    );
  }

  if (order.length > 1) {
    setupHomeWidgetDragAndDrop(home);
  }

  return home;
}

function createHomeEmptyState({ title, hint, actions = [] }) {
  const empty = document.createElement("div");
  empty.className = "empty-state home-empty-state";

  const titleEl = document.createElement("p");
  titleEl.className = "empty-state-title";
  titleEl.textContent = title;

  const hintEl = document.createElement("p");
  hintEl.className = "empty-state-hint";
  hintEl.textContent = hint;

  empty.append(titleEl, hintEl);

  if (actions.length > 0) {
    const actionsEl = document.createElement("div");
    actionsEl.className = "empty-state-actions";

    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action.primary ? "primary-btn" : "secondary-btn";
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
      actionsEl.appendChild(button);
    });

    empty.appendChild(actionsEl);
  }

  return empty;
}

function getRecentHistoryItems(limit = 60) {
  const items = [];
  state.routines.forEach((routine) => {
    getRoutineRunHistory(routine).forEach((run) => {
      const completedAt = Number(run.completedAt) || 0;
      if (!completedAt) return;
      items.push({ routine, run, completedAt });
    });
  });
  items.sort((a, b) => b.completedAt - a.completedAt);
  return items.slice(0, limit);
}

export function renderHistoryView() {
  const view = document.createElement("div");
  view.className = "history-view";

  const items = getRecentHistoryItems();
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";

    const title = document.createElement("h2");
    title.className = "history-empty-title";
    title.textContent = t("history.emptyTitle");

    const hint = document.createElement("p");
    hint.className = "history-empty-hint";
    hint.textContent = t("history.emptyHint");

    empty.append(title, hint);
    view.appendChild(empty);
    return view;
  }

  const list = document.createElement("div");
  list.className = "history-list";
  list.setAttribute("role", "list");

  items.forEach(({ routine, run, completedAt }) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "history-item";
    item.setAttribute("role", "listitem");
    item.setAttribute(
      "aria-label",
      t("history.openRoutine", { name: routine.name })
    );
    applyRoutineColorStyle(item, routine);

    const swatch = document.createElement("span");
    swatch.className = "history-item-swatch";
    swatch.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "history-item-copy";

    const name = document.createElement("span");
    name.className = "history-item-name";
    name.textContent = routine.name;

    const when = document.createElement("span");
    when.className = "history-item-when";
    when.textContent = formatRunCompletedAt(completedAt);

    copy.append(name, when);

    const duration = document.createElement("span");
    duration.className = "history-item-duration";
    duration.textContent = formatDuration(Number(run.totalMs) || 0);

    item.append(swatch, copy, duration);
    item.addEventListener("click", () => {
      state.returnView = "history";
      setView("routine", routine.id);
    });
    list.appendChild(item);
  });

  view.appendChild(list);
  return view;
}

function createHomeWidget(widgetId, bodyContent) {
  const widget = document.createElement("section");
  widget.className = "home-widget";
  widget.dataset.widgetId = widgetId;
  widget.setAttribute("aria-label", getHomeWidgetLabel(widgetId));

  const collapsed = isHomeWidgetCollapsed(widgetId);
  if (collapsed) {
    widget.classList.add("is-collapsed");
  }

  const header = document.createElement("div");
  header.className = "home-widget-header";

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "drag-handle home-widget-handle";
  handle.setAttribute("aria-label", t("home.widgetMove", { name: getHomeWidgetLabel(widgetId) }));
  handle.title = t("home.widgetDrag");

  const titleWrap = document.createElement("div");
  titleWrap.className = "home-widget-title-wrap";

  const title = document.createElement("h2");
  title.className = "home-widget-title";
  title.textContent = getHomeWidgetLabel(widgetId);

  titleWrap.appendChild(title);

  if (widgetId === "weekly" && bodyContent.dataset.weekLabel && !collapsed) {
    const range = document.createElement("p");
    range.className = "home-widget-subtitle";
    range.textContent = bodyContent.dataset.weekLabel;
    titleWrap.appendChild(range);
  }

  header.append(handle, titleWrap);

  const collapseBtn = document.createElement("button");
  collapseBtn.type = "button";
  collapseBtn.className = "home-widget-hide";
  collapseBtn.textContent = collapsed ? t("app.show") : t("app.hide");
  collapseBtn.title = collapsed
    ? t("home.widgetShow", { name: getHomeWidgetLabel(widgetId) })
    : t("home.widgetHide", { name: getHomeWidgetLabel(widgetId) });
  collapseBtn.setAttribute(
    "aria-label",
    collapsed
      ? t("home.widgetShow", { name: getHomeWidgetLabel(widgetId) })
      : t("home.widgetHide", { name: getHomeWidgetLabel(widgetId) })
  );
  collapseBtn.setAttribute("aria-expanded", String(!collapsed));
  collapseBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (setHomeWidgetCollapsed(widgetId, !collapsed)) {
      render();
    }
  });
  header.appendChild(collapseBtn);

  const body = document.createElement("div");
  body.className = "home-widget-body";
  if (collapsed) {
    body.hidden = true;
  } else {
    body.appendChild(bodyContent);
  }

  widget.append(header, body);
  return widget;
}

function renderRoutinesWidgetContent() {
  const list = document.createElement("section");
  list.className = "routine-list";

  if (state.routines.length === 0) {
    list.appendChild(
      createHomeEmptyState({
        title: t("home.emptyTitle"),
        hint: t("home.emptyHint"),
        actions: [
          {
            label: t("app.addRoutine"),
            primary: true,
            onClick: addRoutine,
          },
        ],
      })
    );
    return list;
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
      dragHandle.setAttribute("aria-label", t("home.dragRoutine", { name: routine.name }));
      dragHandle.title = t("home.dragHint");
      main.appendChild(dragHandle);
    }

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "routine-open";
    openBtn.title = t("home.openRoutine", { name: routine.name });
    openBtn.addEventListener("click", () => {
      state.returnView = "home";
      setView("routine", routine.id);
    });

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
    duplicateBtn.title = t("home.duplicate");
    duplicateBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      duplicateRoutine(routine.id);
    });

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "small-btn";
    renameBtn.textContent = "✎";
    renameBtn.title = t("home.rename");
    renameBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      renameRoutine(routine.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "small-btn delete-btn";
    deleteBtn.textContent = "🗑";
    deleteBtn.title = t("home.delete");
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
  addRoutineButton.textContent = t("app.addRoutine");
  addRoutineButton.setAttribute("aria-label", t("app.addRoutine"));
  addRoutineButton.addEventListener("click", addRoutine);
  list.appendChild(addRoutineButton);

  return list;
}

function renderWeeklyStatsContent() {
  const stats = getWeeklyStats(state.routines);
  const maxDay = Math.max(1, ...stats.dayCompletions);
  const hasActivity = stats.completions > 0 || stats.runs > 0;

  const section = document.createElement("div");
  section.className = "weekly-stats";
  section.dataset.weekLabel = stats.weekLabel;
  section.setAttribute("aria-label", `This week ${stats.weekLabel}`);

  if (!hasActivity) {
    const empty = createHomeEmptyState({
      title: t("home.weeklyEmptyTitle"),
      hint:
        state.routines.length === 0
          ? t("home.weeklyEmptyHintNoRoutines")
          : t("home.weeklyEmptyHint"),
    });
    empty.classList.add("weekly-empty-state");
    section.appendChild(empty);
  } else {
    const metrics = document.createElement("div");
    metrics.className = "weekly-stats-metrics";

    const metricDefs = [
      {
        label: t("home.statCompletions"),
        value: String(stats.completions),
        detail: stats.completions === 1 ? t("home.statRoutineDay") : t("home.statRoutineDays"),
      },
      {
        label: t("home.statActiveDays"),
        value: `${stats.activeDays}/7`,
        detail: stats.activeDays === 1 ? t("home.statDayWithRun") : t("home.statDaysWithRun"),
      },
      {
        label: t("home.statTime"),
        value: formatDurationLabel(stats.totalTimeMs),
        detail: stats.runs === 1 ? t("home.statOneRun") : t("home.statRunsLogged", { count: stats.runs }),
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

    section.appendChild(metrics);
  }

  const chart = document.createElement("div");
  chart.className = "weekly-stats-chart";
  if (!hasActivity) {
    chart.classList.add("is-quiet");
  }
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
    bar.title = count === 1
      ? t("home.completionsTitle", { count })
      : t("home.completionsTitlePlural", { count });

    barWrap.appendChild(bar);

    const weekday = document.createElement("span");
    weekday.className = "weekly-stats-weekday";
    weekday.textContent = getWeekdayShortLabel(dateKey);

    day.append(barWrap, weekday);
    chart.appendChild(day);
  });

  section.appendChild(chart);
  return section;
}

function renderContributionGraph(routine) {
  const data = getRoutineYearlyContributions(routine);
  const section = document.createElement("section");
  section.className = "contribution-graph";
  applyRoutineColorStyle(section, routine);
  section.setAttribute("aria-label", t("routine.contributionAria"));

  const header = document.createElement("div");
  header.className = "contribution-graph-header";

  const title = document.createElement("h3");
  title.className = "contribution-graph-title";
  title.textContent = t("routine.contributionTitle");

  const summary = document.createElement("p");
  summary.className = "contribution-graph-summary";
  const parts = [
    data.activeDays === 1
      ? t("routine.contributionDay", { count: data.activeDays })
      : t("routine.contributionDays", { count: data.activeDays }),
  ];
  if (data.streak > 0) {
    parts.push(formatStreakLabel(data.streak));
  }
  summary.textContent = parts.filter(Boolean).join(" · ");

  header.append(title, summary);

  const scroll = document.createElement("div");
  scroll.className = "contribution-graph-scroll";

  const inner = document.createElement("div");
  inner.className = "contribution-graph-inner";
  inner.style.setProperty("--contribution-weeks", String(data.weeks.length));

  const months = document.createElement("div");
  months.className = "contribution-months";
  data.months.forEach((month) => {
    const label = document.createElement("span");
    label.className = "contribution-month";
    label.style.gridColumn = String(month.weekIndex + 1);
    label.textContent = month.label;
    months.appendChild(label);
  });

  const body = document.createElement("div");
  body.className = "contribution-body";

  const weekdays = document.createElement("div");
  weekdays.className = "contribution-weekdays";
  // Sunday-start rows: show Mon / Wed / Fri labels in rows 2, 4, 6
  ["", t("routine.contributionWeekdayMon"), "", t("routine.contributionWeekdayWed"), "", t("routine.contributionWeekdayFri"), ""].forEach((label) => {
    const day = document.createElement("span");
    day.className = "contribution-weekday";
    day.textContent = label;
    weekdays.appendChild(day);
  });

  const weeksEl = document.createElement("div");
  weeksEl.className = "contribution-weeks";

  data.weeks.forEach((week) => {
    const weekCol = document.createElement("div");
    weekCol.className = "contribution-week";

    week.forEach((day) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "contribution-cell";
      cell.dataset.level = String(day.level);
      if (day.isToday) cell.classList.add("is-today");
      if (!day.inRange) {
        cell.classList.add("is-outside");
        cell.disabled = true;
        cell.tabIndex = -1;
      }

      const dayLabel = formatContributionDayLabel(day.dateKey);
      if (day.count > 0) {
        cell.title = t("routine.contributionCellDone", {
          date: dayLabel,
          count: day.count,
        });
        cell.setAttribute(
          "aria-label",
          t("routine.contributionCellDone", { date: dayLabel, count: day.count })
        );
      } else if (day.inRange) {
        cell.title = t("routine.contributionCellEmpty", { date: dayLabel });
        cell.setAttribute(
          "aria-label",
          t("routine.contributionCellEmpty", { date: dayLabel })
        );
      } else {
        cell.setAttribute("aria-hidden", "true");
      }

      if (day.inRange) {
        cell.addEventListener("click", () => {
          openCalendarModal(routine.id, { dateKey: day.dateKey });
        });
      }

      weekCol.appendChild(cell);
    });

    weeksEl.appendChild(weekCol);
  });

  body.append(weekdays, weeksEl);
  inner.append(months, body);
  scroll.appendChild(inner);

  const legend = document.createElement("div");
  legend.className = "contribution-legend";
  legend.setAttribute("aria-hidden", "true");

  const less = document.createElement("span");
  less.textContent = t("routine.contributionLess");

  const swatches = document.createElement("span");
  swatches.className = "contribution-legend-swatches";
  for (let level = 0; level <= 4; level += 1) {
    const swatch = document.createElement("span");
    swatch.className = "contribution-cell";
    swatch.dataset.level = String(level);
    swatches.appendChild(swatch);
  }

  const more = document.createElement("span");
  more.textContent = t("routine.contributionMore");

  legend.append(less, swatches, more);
  section.append(header, scroll, legend);

  requestAnimationFrame(() => {
    scroll.scrollLeft = scroll.scrollWidth;
  });

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
  title.textContent = t("routine.activities");

  const headerActions = document.createElement("div");
  headerActions.className = "section-header-actions";

  const duplicateButton = document.createElement("button");
  duplicateButton.type = "button";
  duplicateButton.className = "small-btn";
  duplicateButton.textContent = "⎘";
  duplicateButton.title = t("home.duplicate");
  duplicateButton.addEventListener("click", () => duplicateRoutine(routine.id));

  const metaButton = document.createElement("button");
  metaButton.type = "button";
  metaButton.className = "small-btn";
  metaButton.textContent = "⏱";
  metaButton.title = t("routine.editTime");
  metaButton.addEventListener("click", () => editRoutineTime(routine.id));

  const colorButton = document.createElement("button");
  colorButton.type = "button";
  colorButton.className = "small-btn color-btn";
  colorButton.textContent = "🎨";
  colorButton.title = t("routine.changeColor");
  colorButton.setAttribute("aria-label", t("routine.changeColorAria"));
  applyRoutineColorStyle(colorButton, routine);
  colorButton.addEventListener("click", () => openColorModal(routine.id));

  const calendarButton = document.createElement("button");
  calendarButton.type = "button";
  calendarButton.className = "small-btn calendar-btn";
  calendarButton.textContent = "📅";
  calendarButton.title = t("routine.history");
  calendarButton.setAttribute("aria-label", t("routine.history"));
  if (routineCompletedToday(routine)) {
    calendarButton.classList.add("has-today");
  }
  calendarButton.addEventListener("click", () => openCalendarModal(routine.id));

  headerActions.append(duplicateButton, calendarButton, colorButton, metaButton);
  header.append(title, headerActions);

  const infoRow = document.createElement("button");
  infoRow.type = "button";
  infoRow.className = "summary-row summary-row-button";
  infoRow.title = t("routine.editEstimated");
  infoRow.innerHTML = `<span>Estimated time</span><strong>${formatDurationLabel(getRoutineTotalDurationMs(routine))}</strong>`;
  infoRow.addEventListener("click", () => editRoutineTime(routine.id));

  wrapper.append(header, infoRow, renderContributionGraph(routine));

  const activityList = document.createElement("div");
  activityList.className = "activity-list";

  if (routine.activities.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t("routine.emptyActivities");
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
      dragHandle.setAttribute("aria-label", t("routine.dragActivity", { name: activity.name }));
      dragHandle.title = t("home.dragHint");

      const label = document.createElement("button");
      label.type = "button";
      label.className = "activity-name";
      label.textContent = activity.name;
      label.title = t("routine.startWith", { name: activity.name });
      label.addEventListener("click", () => startRoutine(routine.id, activity.id));

      const estimate = document.createElement("span");
      estimate.className = "activity-estimate";
      const estimateMinutes = getActivityEstimatedMinutes(activity);
      estimate.textContent = formatDurationLabel(estimateMinutes * 60 * 1000);
      estimate.title = t("routine.estimatedTime");

      main.append(dragHandle, label, estimate);

      const controls = document.createElement("div");
      controls.className = "drag-controls";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "small-btn";
      editBtn.textContent = "✎";
      editBtn.title = t("routine.editActivity");
      editBtn.setAttribute("aria-label", t("routine.editActivityAria", { name: activity.name }));
      editBtn.addEventListener("click", () => renameActivity(routine.id, activity.id));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "small-btn delete-btn";
      deleteBtn.textContent = "✕";
      deleteBtn.title = t("routine.deleteActivity");
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
  startBtn.textContent = t("routine.start");
  startBtn.disabled = routine.activities.length === 0;
  startBtn.addEventListener("click", () => startRoutine(routine.id));

  const addActivityButton = document.createElement("button");
  addActivityButton.type = "button";
  addActivityButton.className = "secondary-btn add-activity-btn";
  addActivityButton.textContent = t("app.addActivity");
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
      badgeEl.textContent = t("complete.personalBest");
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
    estimateEl.textContent = t("complete.estimateLine", {
      estimate: formatDurationLabel(data.estimatedMs),
      message: getCompletionEstimateMessage(data.totalMs, data.estimatedMs),
    });
    card.appendChild(estimateEl);
  }

  const breakdownTitle = document.createElement("div");
  breakdownTitle.className = "completion-section-title";
  breakdownTitle.textContent = t("complete.breakdown");

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
  doneBtn.textContent = t("app.done");
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
    hint.textContent = t("timer.tapToBegin");
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
    statusBadge.textContent = t("timer.inProgress");
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
  pauseResumeBtn.textContent = state.timer.isRunning ? t("app.pause") : t("app.resume");
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
  endBtn.textContent = t("timer.end");
  endBtn.addEventListener("click", requestEndRoutine);

  controls.append(pauseResumeBtn, endBtn);
  wrapper.append(timerCard, controls);
  return wrapper;
}

export function render() {
  if (state.currentView === "settings") {
    appEl.innerHTML = "";
    syncSettingsView();
    return;
  }

  if (state.currentView === "home") {
    appEl.innerHTML = "";
    appEl.appendChild(renderHomeView());
    return;
  }

  if (state.currentView === "history") {
    appEl.innerHTML = "";
    appEl.appendChild(renderHistoryView());
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
