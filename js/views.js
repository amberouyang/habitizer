import { STREAK_DISPLAY_MIN } from "./constants.js";
import { t, getHomeWidgetLabel, getLocale } from "./i18n.js";
import { setIcon, createIcon } from "./icons.js";
import { openActionSheet } from "./actionSheet.js";
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
  formatLastCompletedLabel,
  getCompletionEstimateMessage,
  getRoutineStreak,
  getWeeklyStats,
  getWeekdayShortLabel,
  getRoutineRunHistory,
  getRunDateKey,
  formatRunCompletedAt,
  formatRunTimeOfDay,
  formatHistoryDayLabel,
  getLocalDateKey,
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
  getRoutineColorValue,
  routineCompletedToday,
  getActivityEstimatedMinutes,
  getActivityEstimatedMs,
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
  toggleRoutineSpacedRepetition,
} from "./routines.js";
import {
  formatDueLabel,
  getDueStatus,
  formatDueDateLabel,
  formatNextRepetitionValue,
  formatSrsIntervalLabel,
  isSpacedRepetitionEnabled,
  getRoutinesForHomeDisplay,
  hasUrgentSpacedPractice,
  getDueSortPriority,
} from "./schedule.js";
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
  endRoutine,
  isTimerSessionActive,
  getActiveTimerRoutine,
  resumeActiveTimer,
} from "./timer.js";
import { createEmptyArt } from "./emptyArt.js";
import { setupActivityDragAndDrop, setupRoutineDragAndDrop, setupHomeWidgetDragAndDrop } from "./drag.js";
import { reconcileHomeWidgets, setHomeWidgetCollapsed, isHomeWidgetCollapsed, setHomeWidgetVisibility, saveRoutines } from "./persistence.js";
import { createSampleRoutines } from "./samples.js";

const TAB_VIEWS = new Set(["home", "history", "settings"]);

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/** Short enter fade used when switching tabs / main screens. */
function playViewEnter(el) {
  if (!el || prefersReducedMotion()) return;
  el.classList.remove("view-enter");
  void el.offsetWidth;
  el.classList.add("view-enter");
}

function updateChrome(view) {
  const showTabs = TAB_VIEWS.has(view) || view === "timer";
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
    // Top + only when routines exist; empty state has its own Add CTA.
    if (state.routines.length > 0) {
      addButton.classList.remove("hidden");
      setIcon(addButton, "plus", { size: 20 });
      addButton.setAttribute("aria-label", t("app.addRoutine"));
    } else {
      addButton.classList.add("hidden");
    }
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
    menuButton?.classList.remove("hidden");
    menuButton?.setAttribute("aria-label", t("routine.moreActions"));
    if (menuButton) menuButton.title = t("routine.moreActions");
  } else if (view === "timer") {
    const routine = getRoutineById(routineId);
    pageTitleEl.textContent = routine ? routine.name : t("view.liveRoutine");
    pageTitleEl.title = routine ? routine.name : "";
    backButton.classList.remove("hidden");
    addButton.classList.add("hidden");
  } else if (view === "complete") {
    pageTitleEl.textContent = t("view.complete");
    pageTitleEl.title = "";
    backButton.classList.add("hidden");
    addButton.classList.add("hidden");
  }

  updateChrome(view);
  render({ animateEnter: true });
}

function getTodayPlan() {
  const items = state.routines
    .filter((routine) => routine.activities.length > 0)
    .map((routine) => ({
      routine,
      done: routineCompletedToday(routine),
      dueKind: getDueStatus(routine).kind,
    }))
    .filter(({ done, dueKind }) => done || dueKind === "off" || dueKind === "due" || dueKind === "overdue");

  const remaining = items.filter((item) => !item.done);
  const next = [...remaining].sort(
    (a, b) => getDueSortPriority(a.routine) - getDueSortPriority(b.routine)
  )[0] || null;
  const dueCount = remaining.filter(({ dueKind }) => dueKind === "due" || dueKind === "overdue").length;

  return { items, doneCount: items.length - remaining.length, next, dueCount };
}

function getGreetingKey(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return "home.greetingMorning";
  if (hour >= 12 && hour < 17) return "home.greetingAfternoon";
  return "home.greetingEvening";
}

function renderHomeToday() {
  const section = document.createElement("section");
  section.className = "home-today";
  section.setAttribute("aria-label", t("format.today"));

  const header = document.createElement("div");
  header.className = "home-today-header";

  const date = document.createElement("p");
  date.className = "home-today-date";
  date.textContent = new Date().toLocaleDateString(getLocale(), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const greeting = document.createElement("h2");
  greeting.className = "home-today-greeting";
  greeting.textContent = t(getGreetingKey());

  header.append(date, greeting);
  section.appendChild(header);

  const plan = getTodayPlan();
  if (plan.items.length === 0) return section;

  const card = document.createElement("div");
  card.className = "home-today-card";

  const summary = document.createElement("div");
  summary.className = "home-today-summary";

  const fraction = document.createElement("strong");
  fraction.className = "home-today-fraction";
  fraction.textContent = `${plan.doneCount}/${plan.items.length}`;

  const fractionLabel = document.createElement("span");
  fractionLabel.className = "home-today-label";
  fractionLabel.textContent = t("home.doneToday");

  summary.append(fraction, fractionLabel);

  if (plan.dueCount > 0) {
    const due = document.createElement("span");
    due.className = "home-today-due";
    due.textContent = t("home.todayDue", { count: plan.dueCount });
    summary.appendChild(due);
  }

  const bar = document.createElement("div");
  bar.className = "home-today-bar";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(plan.items.length));
  bar.setAttribute("aria-valuenow", String(plan.doneCount));
  bar.setAttribute("aria-label", t("home.doneToday"));
  [...plan.items]
    .sort((a, b) => Number(b.done) - Number(a.done))
    .forEach(({ routine, done }) => {
      const segment = document.createElement("span");
      segment.className = "home-today-segment";
      segment.title = routine.name;
      if (done) {
        segment.classList.add("is-done");
        segment.style.background = getRoutineColorValue(routine);
      }
      bar.appendChild(segment);
    });

  card.append(summary, bar);

  if (plan.next) {
    const { routine } = plan.next;
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "home-today-next";
    nextBtn.setAttribute("aria-label", t("home.startAria", { name: routine.name }));
    applyRoutineColorStyle(nextBtn, routine);

    const copy = document.createElement("span");
    copy.className = "home-today-next-copy";

    const label = document.createElement("span");
    label.className = "home-today-next-label";
    label.textContent = t("home.upNext");

    const name = document.createElement("span");
    name.className = "home-today-next-name";
    name.textContent = routine.name;

    const meta = document.createElement("span");
    meta.className = "home-today-next-meta";
    meta.textContent = formatDurationLabel(getRoutineTotalDurationMs(routine));

    copy.append(label, name);

    const play = document.createElement("span");
    play.className = "home-today-next-play";
    play.appendChild(createIcon("play", { size: 16 }));

    nextBtn.append(copy, meta, play);
    nextBtn.addEventListener("click", () => startRoutine(routine.id));
    card.appendChild(nextBtn);
  } else {
    const allDone = document.createElement("p");
    allDone.className = "home-today-all-done";
    allDone.append(createIcon("check", { size: 16 }), document.createTextNode(t("home.allDone")));
    card.appendChild(allDone);
  }

  section.appendChild(card);
  return section;
}

export function renderHomeView() {
  const home = document.createElement("div");
  home.className = "home-view";

  if (state.routines.length > 0) {
    home.appendChild(renderHomeToday());
  }

  const resumeBanner = renderTimerResumeBanner();
  if (resumeBanner) {
    home.appendChild(resumeBanner);
  }

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
        art: "hidden",
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

function createHomeEmptyState({ title, hint, actions = [], art = "routines" }) {
  const empty = document.createElement("div");
  empty.className = "empty-state home-empty-state";

  const titleEl = document.createElement("p");
  titleEl.className = "empty-state-title";
  titleEl.textContent = title;

  const hintEl = document.createElement("p");
  hintEl.className = "empty-state-hint";
  hintEl.textContent = hint;

  empty.append(createEmptyArt(art), titleEl, hintEl);

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
    empty.className = "empty-state history-empty";

    const title = document.createElement("h2");
    title.className = "empty-state-title history-empty-title";
    title.textContent = t("history.emptyTitle");

    const hint = document.createElement("p");
    hint.className = "empty-state-hint history-empty-hint";
    hint.textContent = t("history.emptyHint");

    empty.append(createEmptyArt("history"), title, hint);
    view.appendChild(empty);
    return view;
  }

  const groups = [];
  items.forEach((entry) => {
    const dateKey = getRunDateKey(entry.run) || getLocalDateKey(entry.completedAt);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === dateKey) {
      last.items.push(entry);
    } else {
      groups.push({ dateKey, items: [entry] });
    }
  });

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "history-day";

    const header = document.createElement("div");
    header.className = "history-day-header";

    const title = document.createElement("h2");
    title.className = "history-day-title";
    title.textContent = formatHistoryDayLabel(group.dateKey);

    const totalMs = group.items.reduce((sum, { run }) => sum + (Number(run.totalMs) || 0), 0);
    const summary = document.createElement("span");
    summary.className = "history-day-summary";
    summary.textContent = `${
      group.items.length === 1 ? t("history.oneRun") : t("history.runs", { count: group.items.length })
    } · ${formatDuration(totalMs)}`;

    header.append(title, summary);

    const list = document.createElement("div");
    list.className = "history-list";
    list.setAttribute("role", "list");
    group.items.forEach((entry) => list.appendChild(createHistoryItem(entry)));

    section.append(header, list);
    view.appendChild(section);
  });

  return view;
}

function createHistoryItem({ routine, run, completedAt }) {
  const dateKey = getRunDateKey(run);
  const item = document.createElement("button");
  item.type = "button";
  item.className = "history-item";
  item.setAttribute("role", "listitem");
  item.setAttribute(
    "aria-label",
    t("history.viewDayDetails", { name: routine.name })
  );
  item.title = formatRunCompletedAt(completedAt);
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
  when.textContent = formatRunTimeOfDay(completedAt);

  copy.append(name, when);

  const duration = document.createElement("span");
  duration.className = "history-item-duration";
  duration.textContent = formatDuration(Number(run.totalMs) || 0);

  const chevron = createIcon("chevronRight", { size: 16 });
  chevron.classList.add("history-item-chevron");

  item.append(swatch, copy, duration, chevron);
  item.addEventListener("click", () => {
    if (!dateKey) return;
    openCalendarModal(routine.id, {
      dateKey,
      focusRunId: typeof run.id === "string" ? run.id : null,
    });
  });
  return item;
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
  collapseBtn.appendChild(createIcon("chevronDown", { size: 16 }));
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

function renderTimerResumeBanner() {
  if (!isTimerSessionActive()) return null;

  const routine = getActiveTimerRoutine();
  if (!routine) return null;

  const banner = document.createElement("button");
  banner.type = "button";
  banner.className = "timer-resume-banner";
  applyRoutineColorStyle(banner, routine);
  banner.setAttribute(
    "aria-label",
    t("timer.resumeAria", { name: routine.name })
  );
  banner.addEventListener("click", resumeActiveTimer);

  const copy = document.createElement("span");
  copy.className = "timer-resume-copy";

  const label = document.createElement("span");
  label.className = "timer-resume-label";
  label.textContent = t("timer.resumeLabel");

  const name = document.createElement("strong");
  name.className = "timer-resume-name";
  name.textContent = routine.name;

  copy.append(label, name);

  const meta = document.createElement("span");
  meta.className = "timer-resume-meta";

  const time = document.createElement("span");
  time.className = "timer-resume-time";
  time.textContent = formatDuration(getTotalElapsedMs());

  const action = document.createElement("span");
  action.className = "timer-resume-action";
  action.textContent = t("timer.continue");

  meta.append(time, action);
  banner.append(copy, meta);
  return banner;
}

function renderRoutinesWidgetContent() {
  const list = document.createElement("section");
  list.className = "routine-list";

  if (state.routines.length === 0) {
    list.appendChild(
      createHomeEmptyState({
        title: t("home.emptyTitle"),
        hint: t("home.emptyHint"),
        art: "routines",
        actions: [
          {
            label: t("app.addRoutine"),
            primary: true,
            onClick: addRoutine,
          },
          {
            label: t("home.trySamples"),
            onClick: () => {
              // Only offered while the list is empty, so it never replaces real routines.
              if (state.routines.length > 0) return;
              state.routines = createSampleRoutines();
              saveRoutines();
              render();
            },
          },
        ],
      })
    );
    return list;
  }

  const homeRoutines = getRoutinesForHomeDisplay(state.routines);
  // Due-first is display-only; disable drag while urgent items are pinned to the top.
  const canReorderRoutines =
    state.routines.length > 1 && !hasUrgentSpacedPractice(state.routines);

  homeRoutines.forEach((routine) => {
    const item = document.createElement("div");
    item.className = "routine-item";
    item.dataset.routineId = routine.id;
    applyRoutineColorStyle(item, routine);

    const dueStatus = getDueStatus(routine);
    if (dueStatus.kind === "due") item.classList.add("is-due");
    if (dueStatus.kind === "overdue") item.classList.add("is-overdue");

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

    const dueLabel = formatDueLabel(routine);
    if (dueLabel) {
      const dueBadge = document.createElement("span");
      dueBadge.className = `due-badge due-badge-${dueStatus.kind}`;
      dueBadge.textContent = dueLabel;
      dueBadge.title = dueLabel;
      nameRow.appendChild(dueBadge);
    }

    const meta = document.createElement("div");
    meta.className = "routine-meta";
    meta.textContent = getRoutineMetaText(routine);

    const lastCompleted = document.createElement("div");
    lastCompleted.className = "routine-last-completed";
    const intervalLabel = dueLabel ? formatSrsIntervalLabel(routine) : null;
    lastCompleted.textContent = intervalLabel
      ? `${formatLastCompletedLabel(routine)} · ${intervalLabel}`
      : formatLastCompletedLabel(routine);

    info.append(nameRow, meta, lastCompleted);
    openBtn.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "small-btn routine-more-btn";
    moreBtn.title = t("home.moreActions", { name: routine.name });
    moreBtn.setAttribute("aria-label", t("home.moreActions", { name: routine.name }));
    moreBtn.setAttribute("aria-haspopup", "dialog");
    setIcon(moreBtn, "more", { size: 18 });
    moreBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openActionSheet({
        title: routine.name,
        actions: [
          { label: t("home.duplicate"), icon: "copy", onSelect: () => duplicateRoutine(routine.id) },
          { label: t("home.rename"), icon: "edit", onSelect: () => renameRoutine(routine.id) },
          { label: t("home.delete"), icon: "trash", danger: true, onSelect: () => deleteRoutine(routine.id) },
        ],
      });
    });

    actions.appendChild(moreBtn);

    // Continue lives on the top in-progress banner; cards only get a quiet Start.
    const isActiveSession = state.timer.routineId === routine.id;
    if (!isActiveSession) {
      const startBtn = document.createElement("button");
      startBtn.type = "button";
      startBtn.className = "small-btn home-start-btn";
      startBtn.title = t("home.startAria", { name: routine.name });
      startBtn.setAttribute("aria-label", t("home.startAria", { name: routine.name }));
      setIcon(startBtn, "play", { size: 16 });
      startBtn.disabled = routine.activities.length === 0;
      startBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        startRoutine(routine.id);
      });
      actions.appendChild(startBtn);
    }

    main.append(openBtn);
    item.append(main, actions);
    list.appendChild(item);
  });

  if (canReorderRoutines) {
    setupRoutineDragAndDrop(list);
  }

  return list;
}

function renderWeeklyStatsContent() {
  const stats = getWeeklyStats(state.routines);
  const barScale = Math.max(1, state.routines.length, ...stats.dayCompletions);
  const hasActivity = stats.completions > 0 || stats.runs > 0;

  const section = document.createElement("div");
  section.className = "weekly-stats";
  section.dataset.weekLabel = stats.weekLabel;
  section.setAttribute("aria-label", `This week ${stats.weekLabel}`);

  if (!hasActivity) {
    section.classList.add("is-empty");
    const empty = document.createElement("div");
    empty.className = "weekly-empty";

    const title = document.createElement("p");
    title.className = "weekly-empty-title";
    title.textContent = t("home.weeklyEmptyTitle");

    const hint = document.createElement("p");
    hint.className = "weekly-empty-hint";
    hint.textContent =
      state.routines.length === 0
        ? t("home.weeklyEmptyHintNoRoutines")
        : t("home.weeklyEmptyHint");

    empty.append(title, hint);
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

      item.title = metric.detail;

      const value = document.createElement("span");
      value.className = "weekly-stat-value";
      value.textContent = metric.value;

      const label = document.createElement("span");
      label.className = "weekly-stat-label";
      label.textContent = metric.label;

      item.append(value, label);
      metrics.appendChild(item);
    });

    section.appendChild(metrics);
  }

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
    if (dateKey > stats.todayKey) day.classList.add("is-future");
    if (count > 0) day.classList.add("has-completions");
    day.title = count === 1
      ? t("home.completionsTitle", { count })
      : t("home.completionsTitlePlural", { count });

    const countEl = document.createElement("span");
    countEl.className = "weekly-stats-count";
    countEl.textContent = count > 0 ? String(count) : "";

    const track = document.createElement("div");
    track.className = "weekly-stats-track";

    if (count > 0) {
      const stack = document.createElement("div");
      stack.className = "weekly-stats-stack";
      stack.style.height = `${Math.round((count / barScale) * 100)}%`;
      stats.dayRoutines[index].forEach((routine) => {
        const segment = document.createElement("span");
        segment.className = "weekly-stats-segment";
        segment.style.background = getRoutineColorValue(routine);
        stack.appendChild(segment);
      });
      track.appendChild(stack);
    }

    const weekday = document.createElement("span");
    weekday.className = "weekly-stats-weekday";
    weekday.textContent = getWeekdayShortLabel(dateKey);

    day.append(countEl, track, weekday);
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

export function openRoutineMenu(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;
  openActionSheet({
    title: routine.name,
    actions: [
      { label: t("routine.history"), icon: "calendar", onSelect: () => openCalendarModal(routine.id) },
      { label: t("routine.changeColor"), icon: "palette", onSelect: () => openColorModal(routine.id) },
      { label: t("routine.editTime"), icon: "clock", onSelect: () => editRoutineTime(routine.id) },
      { label: t("home.rename"), icon: "edit", onSelect: () => renameRoutine(routine.id) },
      { label: t("home.duplicate"), icon: "copy", onSelect: () => duplicateRoutine(routine.id) },
      { label: t("home.delete"), icon: "trash", danger: true, onSelect: () => deleteRoutine(routine.id) },
    ],
  });
}

export function renderRoutineView() {
  const routine = getRoutineById(state.currentRoutineId);
  if (!routine) {
    setView("home");
    return document.createElement("div");
  }

  const wrapper = document.createElement("div");
  wrapper.className = "routine-view";
  applyRoutineColorStyle(wrapper, routine);

  const settingsCard = document.createElement("section");
  settingsCard.className = "routine-settings-card";

  const infoRow = document.createElement("button");
  infoRow.type = "button";
  infoRow.className = "routine-setting-row routine-setting-button";
  infoRow.title = t("routine.editEstimated");
  const infoLabel = document.createElement("span");
  infoLabel.textContent = t("routine.estimatedTime");
  const infoValue = document.createElement("strong");
  infoValue.textContent = formatDurationLabel(getRoutineTotalDurationMs(routine));
  infoRow.append(infoLabel, infoValue);
  infoRow.addEventListener("click", () => editRoutineTime(routine.id));

  const scheduleRow = document.createElement("label");
  scheduleRow.className = "routine-setting-row routine-schedule-row";
  const scheduleToggleId = `srs-toggle-${routine.id}`;
  scheduleRow.setAttribute("for", scheduleToggleId);
  scheduleRow.title = t("srs.desc");

  const scheduleLabel = document.createElement("span");
  scheduleLabel.textContent = t("srs.title");

  const scheduleToggle = document.createElement("input");
  scheduleToggle.id = scheduleToggleId;
  scheduleToggle.className = "toggle-input toggle-input-compact";
  scheduleToggle.type = "checkbox";
  scheduleToggle.setAttribute("role", "switch");
  scheduleToggle.setAttribute("aria-label", t("srs.title"));
  scheduleToggle.title = t("srs.desc");
  scheduleToggle.checked = isSpacedRepetitionEnabled(routine);
  scheduleToggle.addEventListener("change", () => {
    toggleRoutineSpacedRepetition(routine.id, scheduleToggle.checked);
  });

  scheduleRow.append(scheduleLabel, scheduleToggle);
  settingsCard.append(infoRow, scheduleRow);

  if (isSpacedRepetitionEnabled(routine)) {
    const nextRow = document.createElement("div");
    nextRow.className = "routine-setting-row routine-next-row";
    const status = getDueStatus(routine);
    if (status.kind === "due" || status.kind === "overdue") {
      nextRow.classList.add(`is-${status.kind}`);
    }

    const nextLabel = document.createElement("span");
    nextLabel.textContent = t("srs.nextLabel");

    const nextValue = document.createElement("span");
    nextValue.className = "routine-next-value";
    const nextStrong = document.createElement("strong");
    nextStrong.textContent = formatNextRepetitionValue(routine);
    nextValue.appendChild(nextStrong);

    const intervalLabel = formatSrsIntervalLabel(routine);
    if (intervalLabel) {
      const intervalEl = document.createElement("small");
      intervalEl.textContent = intervalLabel;
      nextValue.appendChild(intervalEl);
    }

    nextRow.append(nextLabel, nextValue);
    settingsCard.appendChild(nextRow);
  }

  const activitiesSection = document.createElement("section");
  activitiesSection.className = "routine-activities";

  const header = document.createElement("div");
  header.className = "section-header";

  const title = document.createElement("h2");
  title.textContent = t("routine.activities");

  const addActivityButton = document.createElement("button");
  addActivityButton.type = "button";
  addActivityButton.className = "section-header-link";
  addActivityButton.setAttribute("aria-label", t("app.addActivity"));
  addActivityButton.append(createIcon("plus", { size: 16 }), document.createTextNode(t("app.add")));
  addActivityButton.addEventListener("click", () => openAddActivityModal(routine.id));

  header.append(title, addActivityButton);

  const activityList = document.createElement("div");
  activityList.className = "activity-list";

  if (routine.activities.length === 0) {
    activityList.classList.add("is-empty");
    activityList.appendChild(
      createHomeEmptyState({
        title: t("routine.emptyActivities"),
        hint: t("routine.emptyActivitiesHint"),
        art: "activities",
        actions: [
          {
            label: t("app.addActivity"),
            primary: true,
            onClick: () => openAddActivityModal(routine.id),
          },
        ],
      })
    );
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
      editBtn.title = t("routine.editActivity");
      editBtn.setAttribute("aria-label", t("routine.editActivityAria", { name: activity.name }));
      setIcon(editBtn, "edit", { size: 16 });
      editBtn.addEventListener("click", () => renameActivity(routine.id, activity.id));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "small-btn delete-btn";
      deleteBtn.title = t("routine.deleteActivity");
      setIcon(deleteBtn, "close", { size: 16 });
      deleteBtn.addEventListener("click", () => deleteActivity(routine.id, activity.id));

      controls.append(editBtn, deleteBtn);
      item.append(main, controls);
      activityList.appendChild(item);
    });

    setupActivityDragAndDrop(activityList, routine);
  }

  activitiesSection.append(header, activityList);

  const startBar = document.createElement("div");
  startBar.className = "routine-start-bar";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "primary-btn routine-start-btn";
  const isActiveSession = state.timer.routineId === routine.id;
  startBtn.append(
    createIcon("play", { size: 16 }),
    document.createTextNode(isActiveSession ? t("timer.continue") : t("routine.start"))
  );
  startBtn.disabled = routine.activities.length === 0;
  startBtn.addEventListener("click", () => {
    if (isActiveSession) {
      resumeActiveTimer();
      return;
    }
    startRoutine(routine.id);
  });
  startBar.appendChild(startBtn);

  wrapper.append(settingsCard, activitiesSection, renderContributionGraph(routine), startBar);
  return wrapper;
}

function createCompletionStat({ label, value, detail, tone }) {
  const stat = document.createElement("div");
  stat.className = "completion-stat";

  const labelEl = document.createElement("div");
  labelEl.className = "completion-stat-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("div");
  valueEl.className = "completion-stat-value";
  valueEl.textContent = value;

  stat.append(labelEl, valueEl);

  if (detail) {
    const detailEl = document.createElement("div");
    detailEl.className = "completion-stat-detail";
    if (tone) detailEl.classList.add(`is-${tone}`);
    detailEl.textContent = detail;
    stat.appendChild(detailEl);
  }
  return stat;
}

export function renderCompletionView() {
  const data = state.lastCompletion;
  if (!data) {
    setView("home");
    return document.createElement("div");
  }

  const completedRoutine = getRoutineById(data.routineId);
  const wrapper = document.createElement("div");
  wrapper.className = "completion-view";
  if (completedRoutine) applyRoutineColorStyle(wrapper, completedRoutine);

  const hero = document.createElement("section");
  hero.className = "completion-hero";

  const mark = document.createElement("div");
  mark.className = "completion-mark";
  mark.appendChild(createIcon("check", { size: 34 }));

  const headline = document.createElement("h2");
  headline.className = "completion-headline";
  headline.textContent = data.routineName;
  headline.title = data.routineName;

  hero.append(mark, headline);

  if (data.estimatedMs > 0) {
    const estimateEl = document.createElement("p");
    const isUnderOrOn = data.totalMs <= data.estimatedMs;
    estimateEl.className = `completion-estimate ${isUnderOrOn ? "under" : "over"}`;
    estimateEl.textContent = getCompletionEstimateMessage(data.totalMs, data.estimatedMs);
    hero.appendChild(estimateEl);
  }

  const stats = document.createElement("section");
  stats.className = "completion-stats";

  stats.appendChild(createCompletionStat({
    label: t("complete.time"),
    value: formatDuration(data.totalMs),
    detail: data.estimatedMs > 0
      ? t("timer.ofEstimate", { time: formatDurationLabel(data.estimatedMs) })
      : null,
  }));

  if (data.streak > 0) {
    let streakDetail = null;
    let streakTone = null;
    if (data.isNewPersonalBest) {
      streakDetail = t("complete.newBest");
      streakTone = "good";
    } else if (data.longestStreak > data.streak) {
      streakDetail = t("complete.best", { count: data.longestStreak });
    }
    stats.appendChild(createCompletionStat({
      label: t("complete.streak"),
      value: data.streak === 1
        ? t("complete.streakDay")
        : t("complete.streakDays", { count: data.streak }),
      detail: streakDetail,
      tone: streakTone,
    }));
  }

  if (data.nextDueDate) {
    stats.appendChild(createCompletionStat({
      label: t("complete.next"),
      value: formatDueDateLabel(data.nextDueDate),
      detail: formatSrsIntervalLabel(completedRoutine),
    }));
  }

  const breakdown = document.createElement("section");
  breakdown.className = "completion-breakdown";

  const breakdownTitle = document.createElement("h3");
  breakdownTitle.className = "completion-section-title";
  breakdownTitle.textContent = t("complete.breakdown");

  const activityList = document.createElement("div");
  activityList.className = "summary-list";
  const longestMs = Math.max(1, ...data.activities.map((activity) => activity.timeSpentMs));

  data.activities.forEach((activity) => {
    const item = document.createElement("div");
    item.className = "summary-item";

    const row = document.createElement("div");
    row.className = "summary-item-row";

    const name = document.createElement("span");
    name.className = "summary-item-name";
    name.textContent = activity.name;
    name.title = activity.name;

    const time = document.createElement("strong");
    time.textContent = formatDuration(activity.timeSpentMs);

    row.append(name, time);

    const bar = document.createElement("div");
    bar.className = "summary-item-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(2, (activity.timeSpentMs / longestMs) * 100)}%`;
    bar.appendChild(fill);

    item.append(row, bar);
    activityList.appendChild(item);
  });

  breakdown.append(breakdownTitle, activityList);

  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "primary-btn completion-done-btn";
  doneBtn.textContent = t("app.done");
  doneBtn.addEventListener("click", () => {
    state.lastCompletion = null;
    setView("home");
  });

  wrapper.append(hero, stats, breakdown, doneBtn);
  return wrapper;
}

const TIMER_RING_RADIUS = 92;
const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * TIMER_RING_RADIUS;
const SVG_NS = "http://www.w3.org/2000/svg";

export function formatActivityTimerText(activity) {
  const elapsedMs = getActivityElapsedMs(activity);
  const estimateMs = getActivityEstimatedMs(activity);
  return {
    text: estimateMs > 0
      ? `${formatDuration(elapsedMs)} / ${formatDurationLabel(estimateMs)}`
      : formatDuration(elapsedMs),
    isOver: estimateMs > 0 && elapsedMs > estimateMs,
  };
}

/** Ring shows time vs. estimate when there is one, otherwise steps finished. */
function applyTimerRingProgress(ring, progressCircle, routine) {
  const { hasEstimate, percent, isOver } = getRoutineProgress(routine);
  const { completed, total } = getActivityCompletionCount(routine);
  const fraction = hasEstimate ? percent / 100 : total > 0 ? completed / total : 0;

  progressCircle.style.strokeDashoffset = String(TIMER_RING_CIRCUMFERENCE * (1 - fraction));
  ring.classList.toggle("is-over", isOver);
  ring.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
}

export function syncTimerRing(routine) {
  const ring = document.querySelector(".timer-ring");
  const progressCircle = ring?.querySelector(".timer-ring-progress");
  if (!ring || !progressCircle || !routine) return;
  applyTimerRingProgress(ring, progressCircle, routine);
}

function getTimerFocusActivity(routine) {
  const active = routine.activities.find((activity) => getActivityRunStatus(activity.id) === "active");
  if (active) return { activity: active, mode: "active" };
  const next = routine.activities.find((activity) => getActivityRunStatus(activity.id) === "idle");
  if (next) return { activity: next, mode: "next" };
  return { activity: null, mode: "done" };
}

function createTimerRing(routine) {
  const ring = document.createElement("div");
  ring.className = "timer-ring";
  ring.setAttribute("role", "progressbar");
  ring.setAttribute("aria-valuemin", "0");
  ring.setAttribute("aria-valuemax", "100");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.setAttribute("aria-hidden", "true");

  const track = document.createElementNS(SVG_NS, "circle");
  track.setAttribute("class", "timer-ring-track");
  const progress = document.createElementNS(SVG_NS, "circle");
  progress.setAttribute("class", "timer-ring-progress");
  [track, progress].forEach((circle) => {
    circle.setAttribute("cx", "100");
    circle.setAttribute("cy", "100");
    circle.setAttribute("r", String(TIMER_RING_RADIUS));
  });
  progress.style.strokeDasharray = String(TIMER_RING_CIRCUMFERENCE);
  svg.append(track, progress);
  applyTimerRingProgress(ring, progress, routine);

  const center = document.createElement("div");
  center.className = "timer-ring-center";

  const totalTimeEl = document.createElement("div");
  totalTimeEl.className = "total-time";
  totalTimeEl.textContent = formatDuration(getTotalElapsedMs());

  const sub = document.createElement("div");
  sub.className = "timer-ring-sub";
  const { hasEstimate } = getRoutineProgress(routine);
  if (hasRoutineClockStarted() && !state.timer.isRunning) {
    sub.textContent = t("timer.paused");
    sub.classList.add("is-paused");
  } else if (hasEstimate) {
    sub.textContent = t("timer.ofEstimate", {
      time: formatDurationLabel(getRoutineTotalDurationMs(routine)),
    });
  } else {
    sub.textContent = t("timer.elapsed");
  }

  center.append(totalTimeEl, sub);
  ring.append(svg, center);
  return ring;
}

function createTimerNowCard(routine) {
  const { activity, mode } = getTimerFocusActivity(routine);

  const card = document.createElement("div");
  card.className = `timer-now timer-now--${mode}`;

  const copy = document.createElement("div");
  copy.className = "timer-now-copy";

  const label = document.createElement("div");
  label.className = "timer-now-label";
  label.textContent = mode === "active"
    ? t("timer.now")
    : mode === "next"
      ? t("timer.upNext")
      : t("timer.allDone");

  const name = document.createElement("div");
  name.className = "timer-now-name";
  name.textContent = activity ? activity.name : routine.name;

  copy.append(label, name);

  if (activity) {
    const time = document.createElement("div");
    time.className = "timer-now-time";
    time.dataset.activityId = activity.id;
    const { text, isOver } = formatActivityTimerText(activity);
    time.textContent = text;
    time.classList.toggle("over", isOver);
    copy.appendChild(time);
  }

  const action = document.createElement("button");
  action.type = "button";
  action.className = "primary-btn timer-now-action";
  if (mode === "active") {
    action.append(createIcon("check", { size: 18 }), document.createTextNode(t("app.done")));
    action.addEventListener("click", () => advanceActivityState(activity.id));
  } else if (mode === "next") {
    action.append(createIcon("play", { size: 16 }), document.createTextNode(t("timer.startStep")));
    action.addEventListener("click", () => advanceActivityState(activity.id));
  } else {
    action.append(createIcon("check", { size: 18 }), document.createTextNode(t("timer.finish")));
    action.addEventListener("click", endRoutine);
  }

  card.append(copy, action);
  return card;
}

export function renderTimerView() {
  const routine = getRoutineById(state.currentRoutineId);
  if (!routine) {
    setView("home");
    return document.createElement("div");
  }

  const wrapper = document.createElement("div");
  wrapper.className = "live-timer";
  applyRoutineColorStyle(wrapper, routine);

  const hero = document.createElement("section");
  hero.className = "timer-hero";

  const completionCountEl = document.createElement("div");
  completionCountEl.className = "activity-completion-count";
  const { completed, total } = getActivityCompletionCount(routine);
  completionCountEl.textContent = formatActivityCompletionLabel(routine);
  completionCountEl.classList.toggle("complete", total > 0 && completed === total);

  hero.append(createTimerRing(routine), completionCountEl);

  const steps = document.createElement("section");
  steps.className = "timer-steps";

  const stepsTitle = document.createElement("h2");
  stepsTitle.className = "timer-steps-title";
  stepsTitle.textContent = t("routine.activities");

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
    checkbox.className = "progress-check";
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

    const timeText = document.createElement("span");
    timeText.className = "progress-time";
    timeText.dataset.activityId = activity.id;
    const { text, isOver } = formatActivityTimerText(activity);
    timeText.textContent = text;
    timeText.classList.toggle("over", isOver);

    item.append(checkbox, labelText, timeText);
    progressList.appendChild(item);
  });

  steps.append(stepsTitle, progressList);

  const controls = document.createElement("div");
  controls.className = "timer-controls";

  const pauseResumeBtn = document.createElement("button");
  pauseResumeBtn.type = "button";
  pauseResumeBtn.className = "secondary-btn timer-pause-btn";
  pauseResumeBtn.disabled = !hasRoutineClockStarted();
  pauseResumeBtn.append(
    createIcon(state.timer.isRunning ? "pause" : "play", { size: 16 }),
    document.createTextNode(state.timer.isRunning ? t("app.pause") : t("app.resume"))
  );
  pauseResumeBtn.addEventListener("click", () => {
    if (state.timer.isRunning) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  });

  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "timer-end-btn";
  endBtn.textContent = t("timer.end");
  endBtn.addEventListener("click", requestEndRoutine);

  controls.append(pauseResumeBtn, endBtn);
  wrapper.append(hero, createTimerNowCard(routine), steps, controls);
  return wrapper;
}

export function render({ animateEnter = false } = {}) {
  if (state.currentView === "settings") {
    appEl.innerHTML = "";
    syncSettingsView();
    if (animateEnter) {
      playViewEnter(settingsView);
    }
    return;
  }

  if (state.currentView === "home") {
    appEl.innerHTML = "";
    appEl.appendChild(renderHomeView());
    if (state.routines.length > 0) {
      addButton.classList.remove("hidden");
      setIcon(addButton, "plus", { size: 20 });
      addButton.setAttribute("aria-label", t("app.addRoutine"));
    } else {
      addButton.classList.add("hidden");
    }
    if (animateEnter) playViewEnter(appEl.firstElementChild);
    return;
  }

  if (state.currentView === "history") {
    appEl.innerHTML = "";
    appEl.appendChild(renderHistoryView());
    if (animateEnter) playViewEnter(appEl.firstElementChild);
    return;
  }

  if (state.currentView === "routine") {
    appEl.innerHTML = "";
    appEl.appendChild(renderRoutineView());
    if (animateEnter) playViewEnter(appEl.firstElementChild);
    return;
  }

  if (state.currentView === "timer") {
    appEl.innerHTML = "";
    appEl.appendChild(renderTimerView());
    if (animateEnter) playViewEnter(appEl.firstElementChild);
    return;
  }

  if (state.currentView === "complete") {
    appEl.innerHTML = "";
    appEl.appendChild(renderCompletionView());
    if (animateEnter) playViewEnter(appEl.firstElementChild);
  }
}
