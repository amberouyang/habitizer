const STORAGE_KEY = "habitizer-routines-v1";
const SETTINGS_KEY = "habitizer-settings-v1";

const state = {
  routines: [],
  currentRoutineId: null,
  currentView: "home",
  lastCompletion: null,
  routineCalendarOffset: 0,
  calendarRoutineId: null,
  timer: {
    routineId: null,
    isRunning: false,
    elapsedMs: 0,
    lastTimestamp: null,
    completedActivityIds: new Set(),
    activityStartTimes: {},
  },
};

const settings = {
  cumulativeMode: true,
  darkMode: false,
};

const ROUTINE_COLORS = [
  { id: "sage", label: "Sage", value: "#2f6f52" },
  { id: "ocean", label: "Ocean", value: "#2f5f8f" },
  { id: "lavender", label: "Lavender", value: "#6b5b95" },
  { id: "coral", label: "Coral", value: "#c96b5a" },
  { id: "amber", label: "Amber", value: "#c9893f" },
  { id: "rose", label: "Rose", value: "#b85c7a" },
  { id: "slate", label: "Slate", value: "#5a6b7a" },
  { id: "teal", label: "Teal", value: "#2a7a72" },
];

const DEFAULT_ROUTINE_COLOR_ID = ROUTINE_COLORS[0].id;

let liveTimerIntervalId = null;

const appEl = document.getElementById("app");
const pageTitleEl = document.getElementById("pageTitle");
const addButton = document.getElementById("addButton");
const backButton = document.getElementById("backButton");
const menuButton = document.getElementById("menuButton");
const modalOverlay = document.getElementById("nameModal");
const modalTitle = document.getElementById("modalTitle");
const modalLabel = document.getElementById("modalLabel");
const modalInput = document.getElementById("modalInput");
const modalMinutesGroup = document.getElementById("modalMinutesGroup");
const modalMinutesInput = document.getElementById("modalMinutesInput");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");
const settingsModal = document.getElementById("settingsModal");
const settingsClose = document.getElementById("settingsClose");
const darkModeToggle = document.getElementById("darkModeToggle");
const cumulativeToggle = document.getElementById("cumulativeToggle");
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmCancel = document.getElementById("confirmCancel");
const confirmAction = document.getElementById("confirmAction");
let confirmCallback = null;
const colorModal = document.getElementById("colorModal");
const colorModalSwatches = document.getElementById("colorModalSwatches");
const colorModalClose = document.getElementById("colorModalClose");
let colorModalRoutineId = null;
const calendarModal = document.getElementById("calendarModal");
const calendarModalTitle = document.getElementById("calendarModalTitle");
const calendarModalSubtitle = document.getElementById("calendarModalSubtitle");
const calendarModalBody = document.getElementById("calendarModalBody");
const calendarModalClose = document.getElementById("calendarModalClose");
let calendarModalRoutineId = null;
const undoToast = document.getElementById("undoToast");
const undoToastMessage = document.getElementById("undoToastMessage");
const undoToastAction = document.getElementById("undoToastAction");
let settingsButton = null;

const UNDO_DELETE_MS = 5000;
let pendingDeleteTimeoutId = null;
const pendingDelete = {
  type: null,
  routineId: null,
  routine: null,
  routineIndex: null,
  activity: null,
  activityIndex: null,
};

const modalState = {
  mode: null,
  routineId: null,
  activityId: null,
};

function openNameModal({
  title,
  placeholder,
  confirmLabel,
  mode,
  routineId = null,
  activityId = null,
  initialValue = "",
  label = "Name",
  inputType = "text",
  showEstimatedMinutes = false,
  estimatedMinutesDefault = "10",
}) {
  modalState.mode = mode;
  modalState.routineId = routineId;
  modalState.activityId = activityId;

  modalTitle.textContent = title;
  modalLabel.textContent = label;
  modalInput.placeholder = placeholder;
  modalInput.value = initialValue;
  modalInput.type = inputType;
  modalInput.maxLength = inputType === "text" ? 40 : 524288;

  if (inputType === "number") {
    modalInput.min = "0";
    modalInput.step = "1";
  } else {
    modalInput.removeAttribute("min");
    modalInput.removeAttribute("step");
  }

  if (showEstimatedMinutes) {
    modalMinutesGroup.classList.remove("hidden");
    modalMinutesInput.value = estimatedMinutesDefault;
  } else {
    modalMinutesGroup.classList.add("hidden");
    modalMinutesInput.value = "";
  }

  modalConfirm.textContent = confirmLabel;
  modalOverlay.classList.remove("hidden");
  modalOverlay.setAttribute("aria-hidden", "false");
  modalInput.focus();
  modalInput.select();
}

function closeNameModal() {
  modalOverlay.classList.add("hidden");
  modalOverlay.setAttribute("aria-hidden", "true");
  modalInput.value = "";
  modalInput.type = "text";
  modalInput.maxLength = 40;
  modalInput.removeAttribute("min");
  modalInput.removeAttribute("step");
  modalMinutesGroup.classList.add("hidden");
  modalMinutesInput.value = "";
  modalState.mode = null;
  modalState.routineId = null;
  modalState.activityId = null;
}

function saveRoutines() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.routines));
}

function loadRoutines() {
  const stored = localStorage.getItem(STORAGE_KEY);
  state.routines = stored ? JSON.parse(stored) : [];
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applyTheme() {
  document.documentElement.dataset.theme = settings.darkMode ? "dark" : "light";
}

function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    Object.assign(settings, JSON.parse(stored));
  }
  settings.darkMode = Boolean(settings.darkMode);
  applyTheme();
  darkModeToggle.checked = settings.darkMode;
  cumulativeToggle.checked = settings.cumulativeMode;
}

function seedData() {
  if (localStorage.getItem(STORAGE_KEY)) {
    return;
  }

  state.routines = [
    {
      id: crypto.randomUUID(),
      name: "Morning Routine",
      color: "sage",
      estimatedMinutes: 15,
      activities: [
        { id: crypto.randomUUID(), name: "Drink water", timeSpentMs: 0 },
        { id: crypto.randomUUID(), name: "Stretch", timeSpentMs: 0 },
        { id: crypto.randomUUID(), name: "Check calendar", timeSpentMs: 0 },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Evening Routine",
      color: "ocean",
      estimatedMinutes: 20,
      activities: [
        { id: crypto.randomUUID(), name: "Brush teeth", timeSpentMs: 0 },
        { id: crypto.randomUUID(), name: "Skincare", timeSpentMs: 0 },
        { id: crypto.randomUUID(), name: "Read", timeSpentMs: 0 },
      ],
    },
  ];

  saveRoutines();
}

function getRoutineById(routineId) {
  return state.routines.find((routine) => routine.id === routineId) || null;
}

function getRoutineColorById(colorId) {
  return ROUTINE_COLORS.find((color) => color.id === colorId) || null;
}

function getRoutineColor(routine) {
  return getRoutineColorById(routine?.color) || getRoutineColorById(DEFAULT_ROUTINE_COLOR_ID);
}

function getRoutineColorValue(routine) {
  return getRoutineColor(routine).value;
}

function getNextRoutineColorId() {
  return ROUTINE_COLORS[state.routines.length % ROUTINE_COLORS.length].id;
}

function applyRoutineColorStyle(element, routine) {
  if (!element) return;
  element.style.setProperty("--routine-color", getRoutineColorValue(routine));
}

function applyProgressFillColor(progressFill, routine) {
  if (!progressFill || !routine) return;

  const { isOver } = getRoutineProgress(routine);
  if (isOver) {
    progressFill.style.removeProperty("background");
  } else {
    progressFill.style.background = getRoutineColorValue(routine);
  }
}

function setRoutineColor(routineId, colorId) {
  const routine = getRoutineById(routineId);
  if (!routine || !getRoutineColorById(colorId)) return;

  routine.color = colorId;
  saveRoutines();
  closeColorModal();
  render();
}

function openColorModal(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  colorModalRoutineId = routineId;
  colorModalSwatches.innerHTML = "";

  ROUTINE_COLORS.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.style.setProperty("--swatch-color", color.value);
    swatch.title = color.label;
    swatch.setAttribute("role", "radio");
    swatch.setAttribute("aria-label", color.label);
    swatch.setAttribute("aria-checked", String(getRoutineColor(routine).id === color.id));
    swatch.addEventListener("click", () => setRoutineColor(routineId, color.id));
    colorModalSwatches.appendChild(swatch);
  });

  colorModal.classList.remove("hidden");
  colorModal.setAttribute("aria-hidden", "false");
  colorModalSwatches.querySelector('[aria-checked="true"]')?.focus();
}

function closeColorModal() {
  colorModal.classList.add("hidden");
  colorModal.setAttribute("aria-hidden", "true");
  colorModalRoutineId = null;
  colorModalSwatches.innerHTML = "";
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDurationLabel(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  return minutes === 0 ? "0 min" : `${minutes} min`;
}

function getLocalDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey, dayOffset) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + dayOffset);
  return getLocalDateKey(date.getTime());
}

function getRoutineCompletionDates(routine) {
  return Array.isArray(routine?.completionDates) ? routine.completionDates : [];
}

function recordRoutineCompletion(routine) {
  if (!routine) return;

  const today = getLocalDateKey();
  const completionDates = getRoutineCompletionDates(routine);

  if (!completionDates.includes(today)) {
    routine.completionDates = [...completionDates, today];
  }
}

function getRoutineStreak(routine) {
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

function getLongestStreakFromDates(completionDates) {
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

function getRoutineLongestStreak(routine) {
  return getLongestStreakFromDates(getRoutineCompletionDates(routine));
}

function formatStreakLabel(streak) {
  if (streak <= 0) return null;
  return streak === 1 ? "1 day streak" : `${streak} days in a row`;
}

const STREAK_DISPLAY_MIN = 2;

function formatStreakBadgeText(streak) {
  return String(streak);
}

function formatPersonalBestLabel(longestStreak) {
  if (longestStreak <= 0) return null;
  return longestStreak === 1 ? "Personal best: 1 day" : `Personal best: ${longestStreak} days`;
}

function getCalendarMonthDate(offset = 0) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

function formatCalendarMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function getDateKeyForDay(year, month, day) {
  const monthLabel = String(month + 1).padStart(2, "0");
  const dayLabel = String(day).padStart(2, "0");
  return `${year}-${monthLabel}-${dayLabel}`;
}

function getCalendarWeeks(year, month) {
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

function changeRoutineCalendarMonth(delta) {
  state.routineCalendarOffset += delta;
  if (!calendarModal.classList.contains("hidden")) {
    refreshCalendarModalContent();
  }
}

function routineCompletedToday(routine) {
  return getRoutineCompletionDates(routine).includes(getLocalDateKey());
}

function buildStreakCalendarContent(routine) {
  const completionDates = new Set(getRoutineCompletionDates(routine));
  const monthDate = getCalendarMonthDate(state.routineCalendarOffset);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const today = getLocalDateKey();
  const weeks = getCalendarWeeks(year, month);
  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const calendar = document.createElement("div");
  calendar.className = "streak-calendar";
  calendar.setAttribute("aria-label", "Routine completion calendar");

  const calendarHeader = document.createElement("div");
  calendarHeader.className = "streak-calendar-header";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "small-btn calendar-nav-btn";
  prevBtn.textContent = "‹";
  prevBtn.title = "Previous month";
  prevBtn.setAttribute("aria-label", "Previous month");
  prevBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    changeRoutineCalendarMonth(-1);
  });

  const title = document.createElement("div");
  title.className = "streak-calendar-title";
  title.textContent = formatCalendarMonthLabel(year, month);

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "small-btn calendar-nav-btn";
  nextBtn.textContent = "›";
  nextBtn.title = "Next month";
  nextBtn.setAttribute("aria-label", "Next month");
  nextBtn.disabled = state.routineCalendarOffset >= 0;
  nextBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    changeRoutineCalendarMonth(1);
  });

  calendarHeader.append(prevBtn, title, nextBtn);

  const weekdayRow = document.createElement("div");
  weekdayRow.className = "streak-calendar-weekdays";
  weekdayLabels.forEach((label) => {
    const weekday = document.createElement("span");
    weekday.className = "streak-calendar-weekday";
    weekday.textContent = label;
    weekdayRow.appendChild(weekday);
  });

  const grid = document.createElement("div");
  grid.className = "streak-calendar-grid";

  weeks.forEach((week) => {
    week.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "streak-calendar-day";

      if (day === null) {
        cell.classList.add("is-empty");
        grid.appendChild(cell);
        return;
      }

      const dateKey = getDateKeyForDay(year, month, day);
      const isComplete = completionDates.has(dateKey);
      const isToday = dateKey === today;

      if (isComplete) {
        cell.classList.add("is-complete");
      }
      if (isToday) {
        cell.classList.add("is-today");
      }

      cell.title = isComplete ? `Completed on ${dateKey}` : dateKey;

      const dot = document.createElement("span");
      dot.className = "streak-calendar-dot";
      if (!isComplete) {
        dot.classList.add("is-muted");
      }
      cell.appendChild(dot);
      grid.appendChild(cell);
    });
  });

  const legend = document.createElement("div");
  legend.className = "streak-calendar-legend";
  legend.innerHTML = '<span class="streak-calendar-dot"></span><span>Completed</span>';

  calendar.append(calendarHeader, weekdayRow, grid, legend);
  return calendar;
}

function updateCalendarModal(routine) {
  const streak = getRoutineStreak(routine);
  const streakLabel = formatStreakLabel(streak);

  calendarModalTitle.textContent = "Completion history";
  if (streakLabel && streak >= STREAK_DISPLAY_MIN) {
    calendarModalSubtitle.textContent = streakLabel;
    calendarModalSubtitle.classList.remove("hidden");
  } else {
    calendarModalSubtitle.textContent = "";
    calendarModalSubtitle.classList.add("hidden");
  }

  calendarModalBody.replaceChildren(buildStreakCalendarContent(routine));
}

function refreshCalendarModalContent() {
  const routine = getRoutineById(calendarModalRoutineId);
  if (!routine) return;
  updateCalendarModal(routine);
}

function openCalendarModal(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  if (routineId !== state.calendarRoutineId) {
    state.routineCalendarOffset = 0;
    state.calendarRoutineId = routineId;
  }

  calendarModalRoutineId = routineId;
  updateCalendarModal(routine);
  calendarModal.classList.remove("hidden");
  calendarModal.setAttribute("aria-hidden", "false");
  calendarModalClose.focus();
}

function closeCalendarModal() {
  calendarModal.classList.add("hidden");
  calendarModal.setAttribute("aria-hidden", "true");
  calendarModalRoutineId = null;
  calendarModalBody.replaceChildren();
  calendarModalSubtitle.textContent = "";
  calendarModalSubtitle.classList.add("hidden");
}

function getRoutineMetaText(routine) {
  return [
    `${routine.activities.length} activities`,
    formatDurationLabel(getRoutineTotalDurationMs(routine)),
  ].join(" • ");
}

function getRoutineTotalDurationMs(routine) {
  if (!routine) return 0;
  return Number(routine.estimatedMinutes || 0) * 60 * 1000;
}

function getRoutineProgress(routine) {
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

function getActivityCompletionCount(routine) {
  if (!routine) {
    return { completed: 0, total: 0 };
  }

  return {
    completed: state.timer.completedActivityIds.size,
    total: routine.activities.length,
  };
}

function formatActivityCompletionLabel(routine) {
  const { completed, total } = getActivityCompletionCount(routine);
  if (total === 0) return "0 done";
  return `${completed} of ${total} done`;
}

function getTotalElapsedMs() {
  if (!state.timer.routineId) return 0;

  let total = state.timer.elapsedMs;
  if (state.timer.isRunning && state.timer.lastTimestamp) {
    total += Date.now() - state.timer.lastTimestamp;
  }
  return total;
}

function getActivityElapsedMs(activity) {
  if (!activity) return 0;

  let total = Number(activity.timeSpentMs || 0);
  const start = state.timer.activityStartTimes[activity.id];
  if (start && state.timer.isRunning) {
    total += Date.now() - start;
  }

  return total;
}

function openSettings() {
  darkModeToggle.checked = settings.darkMode;
  cumulativeToggle.checked = settings.cumulativeMode;
  settingsModal.classList.remove("hidden");
  settingsModal.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
  settingsModal.setAttribute("aria-hidden", "true");
  settings.darkMode = darkModeToggle.checked;
  settings.cumulativeMode = cumulativeToggle.checked;
  applyTheme();
  saveSettings();
}

function openConfirmModal({ title, message, confirmLabel, onConfirm }) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmAction.textContent = confirmLabel;
  confirmCallback = onConfirm;
  confirmModal.classList.remove("hidden");
  confirmModal.setAttribute("aria-hidden", "false");
  confirmCancel.focus();
}

function closeConfirmModal() {
  confirmModal.classList.add("hidden");
  confirmModal.setAttribute("aria-hidden", "true");
  confirmCallback = null;
}

function requestEndRoutine() {
  const routine = getRoutineById(state.timer.routineId);
  if (!routine) return;

  openConfirmModal({
    title: "End routine?",
    message: `Stop "${routine.name}"? Your progress will be saved, but the timer will end.`,
    confirmLabel: "End routine",
    onConfirm: endRoutine,
  });
}

function setView(view, routineId = null) {
  state.currentView = view;
  state.currentRoutineId = routineId;

  // Remove click listener from title
  pageTitleEl.onclick = null;
  pageTitleEl.style.cursor = "default";

  if (view === "home") {
    pageTitleEl.textContent = "Habitizer";
    backButton.classList.add("hidden");
    menuButton.classList.remove("hidden");
    // The routine creation control lives below the list on the home screen.
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
    backButton.classList.add("hidden");
    menuButton.classList.add("hidden");
    addButton.classList.add("hidden");
  } else if (view === "complete") {
    pageTitleEl.textContent = "Routine complete";
    backButton.classList.add("hidden");
    menuButton.classList.add("hidden");
    addButton.classList.add("hidden");
  }

  render();
}

function promptForText(message, defaultValue = "") {
  return window.prompt(message, defaultValue);
}

function addRoutine() {
  openNameModal({
    title: "New routine",
    placeholder: "Morning routine",
    confirmLabel: "Create",
    mode: "routine",
    showEstimatedMinutes: true,
    estimatedMinutesDefault: "10",
  });
}

function parseEstimatedMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return null;
  }
  return minutes;
}

function submitRoutineCreation() {
  const name = modalInput.value.trim();
  if (!name) {
    modalInput.focus();
    return;
  }

  const estimatedMinutes = parseEstimatedMinutes(modalMinutesInput.value);
  if (estimatedMinutes === null) {
    modalMinutesInput.focus();
    modalMinutesInput.select();
    return;
  }

  const newRoutine = {
    id: crypto.randomUUID(),
    name,
    color: getNextRoutineColorId(),
    estimatedMinutes,
    activities: [],
    completionDates: [],
  };

  state.routines.unshift(newRoutine);
  saveRoutines();
  closeNameModal();
  setView("routine", newRoutine.id);
}

function renameRoutine(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  openNameModal({
    title: "Rename routine",
    placeholder: "Routine name",
    confirmLabel: "Rename",
    mode: "rename",
    routineId,
    initialValue: routine.name,
  });
}

function editRoutineTime(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  openNameModal({
    title: "Estimated time",
    label: "Minutes",
    placeholder: "15",
    confirmLabel: "Save",
    mode: "time",
    routineId,
    initialValue: String(routine.estimatedMinutes ?? 0),
    inputType: "number",
  });
}

function submitRoutineTime() {
  const routine = getRoutineById(modalState.routineId);
  if (!routine) return;

  const estimatedMinutes = parseEstimatedMinutes(modalInput.value);
  if (estimatedMinutes === null) {
    modalInput.focus();
    modalInput.select();
    return;
  }

  routine.estimatedMinutes = estimatedMinutes;
  saveRoutines();
  closeNameModal();
  render();
}

function deleteRoutine(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  openConfirmModal({
    title: "Delete routine?",
    message: `Delete "${routine.name}"? You can undo this briefly after confirming.`,
    confirmLabel: "Delete",
    onConfirm: () => performDeleteRoutine(routineId),
  });
}

function hasPendingDelete() {
  return pendingDelete.type !== null;
}

function clearPendingDeleteState() {
  pendingDelete.type = null;
  pendingDelete.routineId = null;
  pendingDelete.routine = null;
  pendingDelete.routineIndex = null;
  pendingDelete.activity = null;
  pendingDelete.activityIndex = null;
}

function finalizePendingDelete() {
  if (pendingDeleteTimeoutId) {
    clearTimeout(pendingDeleteTimeoutId);
    pendingDeleteTimeoutId = null;
  }

  if (!hasPendingDelete()) {
    return;
  }

  saveRoutines();
  clearPendingDeleteState();
  hideUndoToast();
}

function showUndoToast(message) {
  undoToastMessage.textContent = message;
  undoToast.classList.remove("hidden");
  undoToast.setAttribute("aria-hidden", "false");
}

function hideUndoToast() {
  undoToast.classList.add("hidden");
  undoToast.setAttribute("aria-hidden", "true");
  undoToastMessage.textContent = "";
}

function performDeleteRoutine(routineId) {
  closeConfirmModal();

  const routine = getRoutineById(routineId);
  if (!routine) return;

  finalizePendingDelete();

  const index = state.routines.findIndex((item) => item.id === routineId);
  pendingDelete.type = "routine";
  pendingDelete.routine = JSON.parse(JSON.stringify(routine));
  pendingDelete.routineIndex = index;

  state.routines = state.routines.filter((item) => item.id !== routineId);

  if (state.currentRoutineId === routineId) {
    state.currentRoutineId = null;
    setView("home");
  } else {
    render();
  }

  showUndoToast("Routine deleted");

  pendingDeleteTimeoutId = setTimeout(() => {
    finalizePendingDelete();
  }, UNDO_DELETE_MS);
}

function undoDelete() {
  if (!hasPendingDelete()) return;

  if (pendingDeleteTimeoutId) {
    clearTimeout(pendingDeleteTimeoutId);
    pendingDeleteTimeoutId = null;
  }

  if (pendingDelete.type === "routine") {
    const insertIndex = Math.min(pendingDelete.routineIndex, state.routines.length);
    state.routines.splice(insertIndex, 0, pendingDelete.routine);
  } else if (pendingDelete.type === "activity") {
    const routine = getRoutineById(pendingDelete.routineId);
    if (routine && pendingDelete.activity) {
      const insertIndex = Math.min(pendingDelete.activityIndex, routine.activities.length);
      routine.activities.splice(insertIndex, 0, pendingDelete.activity);
    }
  }

  clearPendingDeleteState();
  saveRoutines();
  hideUndoToast();
  render();
}

function performDeleteActivity(routineId, activityId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const activity = routine.activities.find((item) => item.id === activityId);
  if (!activity) return;

  finalizePendingDelete();

  const index = routine.activities.findIndex((item) => item.id === activityId);
  pendingDelete.type = "activity";
  pendingDelete.routineId = routineId;
  pendingDelete.activity = JSON.parse(JSON.stringify(activity));
  pendingDelete.activityIndex = index;

  routine.activities = routine.activities.filter((item) => item.id !== activityId);

  showUndoToast("Activity deleted");

  pendingDeleteTimeoutId = setTimeout(() => {
    finalizePendingDelete();
  }, UNDO_DELETE_MS);

  render();
}

function getDuplicateRoutineName(name) {
  const baseName = name.replace(/ \(copy(?: \d+)?\)$/, "");
  let candidate = `${baseName} (copy)`;
  let counter = 2;

  while (state.routines.some((routine) => routine.name === candidate)) {
    candidate = `${baseName} (copy ${counter})`;
    counter += 1;
  }

  return candidate;
}

function duplicateRoutine(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const duplicate = {
    id: crypto.randomUUID(),
    name: getDuplicateRoutineName(routine.name),
    color: routine.color || getNextRoutineColorId(),
    estimatedMinutes: Number(routine.estimatedMinutes || 0),
    activities: routine.activities.map((activity) => ({
      id: crypto.randomUUID(),
      name: activity.name,
      timeSpentMs: 0,
    })),
    completionDates: [],
  };

  const sourceIndex = state.routines.findIndex((item) => item.id === routineId);
  state.routines.splice(sourceIndex + 1, 0, duplicate);
  saveRoutines();
  setView("routine", duplicate.id);
}

function addActivity(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const name = promptForText("Name your new activity:");
  if (!name || !name.trim()) return;

  routine.activities.push({
    id: crypto.randomUUID(),
    name: name.trim(),
    timeSpentMs: 0,
  });

  saveRoutines();
  render();
}

function openAddActivityModal(routineId) {
  openNameModal({
    title: "New activity",
    placeholder: "Stretch",
    confirmLabel: "Add",
    mode: "activity",
    routineId,
  });
}

function renameActivity(routineId, activityId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const activity = routine.activities.find((item) => item.id === activityId);
  if (!activity) return;

  openNameModal({
    title: "Rename activity",
    placeholder: "Activity name",
    confirmLabel: "Rename",
    mode: "renameActivity",
    routineId,
    activityId,
    initialValue: activity.name,
  });
}

function deleteActivity(routineId, activityId) {
  performDeleteActivity(routineId, activityId);
}


const activityDragState = {
  routineId: null,
  activityId: null,
  pointerId: null,
  item: null,
  list: null,
  startY: 0,
};

function getActivityItemAtPointer(listEl, pointerY, dragActivityId) {
  const items = [...listEl.querySelectorAll(".activity-item")];
  return items.find((item) => {
    if (item.dataset.activityId === dragActivityId) return false;
    const rect = item.getBoundingClientRect();
    return pointerY >= rect.top && pointerY <= rect.bottom;
  }) || null;
}

function reorderActivities(routine, fromIndex, toIndex) {
  if (!routine || fromIndex === toIndex) return false;
  if (fromIndex < 0 || toIndex < 0) return false;
  if (fromIndex >= routine.activities.length || toIndex >= routine.activities.length) return false;

  const [moved] = routine.activities.splice(fromIndex, 1);
  routine.activities.splice(toIndex, 0, moved);
  saveRoutines();
  return true;
}

function getActivityDropIndex(listEl, pointerY, dragActivityId) {
  const items = [...listEl.querySelectorAll(".activity-item")];
  const fromIndex = items.findIndex((item) => item.dataset.activityId === dragActivityId);
  if (fromIndex === -1) return fromIndex;

  let insertBeforeIndex = items.length;
  for (let i = 0; i < items.length; i += 1) {
    const rect = items[i].getBoundingClientRect();
    if (pointerY < rect.top + rect.height / 2) {
      insertBeforeIndex = i;
      break;
    }
  }

  let toIndex = insertBeforeIndex;
  if (toIndex > fromIndex) {
    toIndex -= 1;
  }

  return toIndex;
}

function clearActivityDragState() {
  if (activityDragState.item) {
    activityDragState.item.classList.remove("is-dragging");
    activityDragState.item.style.transform = "";
    activityDragState.item.style.zIndex = "";
    activityDragState.item.style.boxShadow = "";
  }

  activityDragState.list?.querySelectorAll(".activity-item").forEach((item) => {
    item.classList.remove("drop-target");
  });

  activityDragState.routineId = null;
  activityDragState.activityId = null;
  activityDragState.pointerId = null;
  activityDragState.item = null;
  activityDragState.list = null;
  activityDragState.startY = 0;

  window.removeEventListener("pointermove", handleActivityPointerMove);
  window.removeEventListener("pointerup", handleActivityPointerUp);
  window.removeEventListener("pointercancel", handleActivityPointerUp);
}

function handleActivityPointerMove(event) {
  if (event.pointerId !== activityDragState.pointerId || !activityDragState.item) return;

  const deltaY = event.clientY - activityDragState.startY;
  activityDragState.item.style.transform = `translateY(${deltaY}px)`;
  activityDragState.item.style.zIndex = "5";
  activityDragState.item.style.boxShadow = "0 10px 24px var(--card-shadow)";

  const { list, activityId } = activityDragState;
  list.querySelectorAll(".activity-item").forEach((item) => {
    item.classList.remove("drop-target");
  });

  const target = getActivityItemAtPointer(list, event.clientY, activityId);
  if (target) {
    target.classList.add("drop-target");
  }
}

function handleActivityPointerUp(event) {
  if (event.pointerId !== activityDragState.pointerId) return;

  const { routineId, activityId, list, item } = activityDragState;
  const routine = getRoutineById(routineId);

  if (routine && list && item) {
    const fromIndex = routine.activities.findIndex((activity) => activity.id === activityId);
    const toIndex = getActivityDropIndex(list, event.clientY, activityId);

    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      reorderActivities(routine, fromIndex, toIndex);
      routine.activities.forEach((activity) => {
        const node = list.querySelector(`[data-activity-id="${activity.id}"]`);
        if (node) {
          list.appendChild(node);
        }
      });
    }
  }

  clearActivityDragState();
}

function setupActivityDragAndDrop(listEl, routine) {
  listEl.querySelectorAll(".drag-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      const item = handle.closest(".activity-item");
      if (!item) return;

      event.preventDefault();
      event.stopPropagation();

      activityDragState.routineId = routine.id;
      activityDragState.activityId = item.dataset.activityId;
      activityDragState.pointerId = event.pointerId;
      activityDragState.item = item;
      activityDragState.list = listEl;
      activityDragState.startY = event.clientY;

      item.classList.add("is-dragging");
      handle.setPointerCapture(event.pointerId);

      window.addEventListener("pointermove", handleActivityPointerMove);
      window.addEventListener("pointerup", handleActivityPointerUp);
      window.addEventListener("pointercancel", handleActivityPointerUp);
    });
  });
}

const routineDragState = {
  routineId: null,
  pointerId: null,
  item: null,
  list: null,
  startY: 0,
};

function reorderRoutines(fromIndex, toIndex) {
  if (fromIndex === toIndex) return false;
  if (fromIndex < 0 || toIndex < 0) return false;
  if (fromIndex >= state.routines.length || toIndex >= state.routines.length) return false;

  const [moved] = state.routines.splice(fromIndex, 1);
  state.routines.splice(toIndex, 0, moved);
  saveRoutines();
  return true;
}

function getRoutineDropIndex(listEl, pointerY, dragRoutineId) {
  const items = [...listEl.querySelectorAll(".routine-item")];
  const fromIndex = items.findIndex((item) => item.dataset.routineId === dragRoutineId);
  if (fromIndex === -1) return fromIndex;

  let insertBeforeIndex = items.length;
  for (let i = 0; i < items.length; i += 1) {
    const rect = items[i].getBoundingClientRect();
    if (pointerY < rect.top + rect.height / 2) {
      insertBeforeIndex = i;
      break;
    }
  }

  let toIndex = insertBeforeIndex;
  if (toIndex > fromIndex) {
    toIndex -= 1;
  }

  return toIndex;
}

function getRoutineItemAtPointer(listEl, pointerY, dragRoutineId) {
  const items = [...listEl.querySelectorAll(".routine-item")];
  return items.find((item) => {
    if (item.dataset.routineId === dragRoutineId) return false;
    const rect = item.getBoundingClientRect();
    return pointerY >= rect.top && pointerY <= rect.bottom;
  }) || null;
}

function clearRoutineDragState() {
  if (routineDragState.item) {
    routineDragState.item.classList.remove("is-dragging");
    routineDragState.item.style.transform = "";
    routineDragState.item.style.zIndex = "";
    routineDragState.item.style.boxShadow = "";
  }

  routineDragState.list?.querySelectorAll(".routine-item").forEach((item) => {
    item.classList.remove("drop-target");
  });

  routineDragState.routineId = null;
  routineDragState.pointerId = null;
  routineDragState.item = null;
  routineDragState.list = null;
  routineDragState.startY = 0;

  window.removeEventListener("pointermove", handleRoutinePointerMove);
  window.removeEventListener("pointerup", handleRoutinePointerUp);
  window.removeEventListener("pointercancel", handleRoutinePointerUp);
}

function handleRoutinePointerMove(event) {
  if (event.pointerId !== routineDragState.pointerId || !routineDragState.item) return;

  const deltaY = event.clientY - routineDragState.startY;
  routineDragState.item.style.transform = `translateY(${deltaY}px)`;
  routineDragState.item.style.zIndex = "5";
  routineDragState.item.style.boxShadow = "0 10px 24px var(--card-shadow)";

  const { list, routineId } = routineDragState;
  list.querySelectorAll(".routine-item").forEach((item) => {
    item.classList.remove("drop-target");
  });

  const target = getRoutineItemAtPointer(list, event.clientY, routineId);
  if (target) {
    target.classList.add("drop-target");
  }
}

function handleRoutinePointerUp(event) {
  if (event.pointerId !== routineDragState.pointerId) return;

  const { routineId, list, item } = routineDragState;

  if (list && item) {
    const fromIndex = state.routines.findIndex((routine) => routine.id === routineId);
    const toIndex = getRoutineDropIndex(list, event.clientY, routineId);

    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      reorderRoutines(fromIndex, toIndex);
      state.routines.forEach((routine) => {
        const node = list.querySelector(`[data-routine-id="${routine.id}"]`);
        if (node) {
          list.insertBefore(node, list.querySelector(".home-add-button"));
        }
      });
    }
  }

  clearRoutineDragState();
}

function setupRoutineDragAndDrop(listEl) {
  listEl.querySelectorAll(".routine-item .drag-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      const item = handle.closest(".routine-item");
      if (!item) return;

      event.preventDefault();
      event.stopPropagation();

      routineDragState.routineId = item.dataset.routineId;
      routineDragState.pointerId = event.pointerId;
      routineDragState.item = item;
      routineDragState.list = listEl;
      routineDragState.startY = event.clientY;

      item.classList.add("is-dragging");
      handle.setPointerCapture(event.pointerId);

      window.addEventListener("pointermove", handleRoutinePointerMove);
      window.addEventListener("pointerup", handleRoutinePointerUp);
      window.addEventListener("pointercancel", handleRoutinePointerUp);
    });
  });
}

function renderHomeView() {
  const list = document.createElement("section");
  list.className = "routine-list";

  if (state.routines.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No routines yet. Create your first one below.";
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

    info.append(nameRow, meta);
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

  return list;
}

function renderRoutineView() {
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
      label.title = "Click to rename";
      label.addEventListener("click", () => renameActivity(routine.id, activity.id));

      main.append(dragHandle, label);

      const controls = document.createElement("div");
      controls.className = "drag-controls";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "small-btn delete-btn";
      deleteBtn.textContent = "✕";
      deleteBtn.title = "Delete activity";
      deleteBtn.addEventListener("click", () => deleteActivity(routine.id, activity.id));

      controls.appendChild(deleteBtn);
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

function updateTimerDisplay() {
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

function startLiveTimerLoop() {
  if (liveTimerIntervalId) {
    clearInterval(liveTimerIntervalId);
  }

  liveTimerIntervalId = setInterval(() => {
    if (state.currentView === "timer" && state.timer.isRunning) {
      updateTimerDisplay();
    }
  }, 100);
}

function startRoutine(routineId) {
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

function pauseTimer() {
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

function resumeTimer() {
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

function toggleActivityCompletion(activityId, checked) {
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

function endRoutine() {
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

  // In per-session mode, reset times after capturing the summary
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
    liveTimerIntervalId = null;
  }

  saveRoutines();
  setView("complete");
}

function getCompletionEstimateMessage(totalMs, estimatedMs) {
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

function renderCompletionView() {
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

function renderTimerView() {
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
    if (state.timer.completedActivityIds.has(activity.id)) {
      item.classList.add("completed");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.activityId = activity.id;
    checkbox.checked = state.timer.completedActivityIds.has(activity.id);
    checkbox.addEventListener("change", () => {
      toggleActivityCompletion(activity.id, checkbox.checked);
    });

    const labelText = document.createElement("span");
    labelText.className = "progress-label";
    labelText.textContent = activity.name;

    const timeText = document.createElement("span");
    timeText.className = "progress-time";
    timeText.dataset.activityId = activity.id;
    timeText.textContent = formatDuration(getActivityElapsedMs(activity));

    item.append(checkbox, labelText, timeText);
    progressList.appendChild(item);
  });

  timerCard.append(...timerCardChildren, progressList);

  const controls = document.createElement("div");
  controls.className = "timer-controls";

  const pauseResumeBtn = document.createElement("button");
  pauseResumeBtn.type = "button";
  pauseResumeBtn.className = "secondary-btn";
  pauseResumeBtn.textContent = state.timer.isRunning ? "Pause" : "Resume";
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

function render() {
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

backButton.addEventListener("click", () => {
  if (state.currentView === "routine") {
    setView("home");
  }
});

addButton.addEventListener("click", () => {
  if (state.currentView === "home") {
    addRoutine();
  } else if (state.currentView === "routine") {
    openAddActivityModal(state.currentRoutineId);
  }
});

menuButton.addEventListener("click", openSettings);

menuButton.addEventListener("click", openSettings);

modalConfirm.addEventListener("click", () => {
  if (modalState.mode === "routine") {
    submitRoutineCreation();
    return;
  }

  if (modalState.mode === "time") {
    submitRoutineTime();
    return;
  }

  if (modalState.mode === "rename" && modalState.routineId) {
    const routine = getRoutineById(modalState.routineId);
    const name = modalInput.value.trim();
    const routineId = modalState.routineId; // Save routineId before closing modal

    if (!routine || !name) {
      modalInput.focus();
      return;
    }

    routine.name = name;
    saveRoutines();
    closeNameModal();
    
    // If renaming current routine, refresh the view to update title immediately
    if (state.currentView === "routine" && state.currentRoutineId === routineId) {
      setView("routine", routineId);
    } else {
      render();
    }
    return;
  }

  if (modalState.mode === "activity" && modalState.routineId) {
    const routine = getRoutineById(modalState.routineId);
    const name = modalInput.value.trim();

    if (!routine || !name) {
      modalInput.focus();
      return;
    }

    routine.activities.push({
      id: crypto.randomUUID(),
      name,
      timeSpentMs: 0,
    });

    saveRoutines();
    closeNameModal();
    render();
    return;
  }

  if (modalState.mode === "renameActivity" && modalState.routineId && modalState.activityId) {
    const routine = getRoutineById(modalState.routineId);
    const activity = routine?.activities.find((item) => item.id === modalState.activityId);
    const name = modalInput.value.trim();

    if (!routine || !activity || !name) {
      modalInput.focus();
      return;
    }

    activity.name = name;
    saveRoutines();
    closeNameModal();
    render();
    return;
  }
});

modalCancel.addEventListener("click", closeNameModal);

function handleNameModalKeydown(event) {
  if (event.key === "Enter") {
    modalConfirm.click();
  }

  if (event.key === "Escape") {
    closeNameModal();
  }
}

modalInput.addEventListener("keydown", handleNameModalKeydown);
modalMinutesInput.addEventListener("keydown", handleNameModalKeydown);

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeNameModal();
  }
});

settingsClose.addEventListener("click", closeSettings);

settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    closeSettings();
  }
});

confirmCancel.addEventListener("click", closeConfirmModal);

confirmAction.addEventListener("click", () => {
  if (confirmCallback) {
    confirmCallback();
  }
});

confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) {
    closeConfirmModal();
  }
});

colorModalClose.addEventListener("click", closeColorModal);

colorModal.addEventListener("click", (event) => {
  if (event.target === colorModal) {
    closeColorModal();
  }
});

calendarModalClose.addEventListener("click", closeCalendarModal);

calendarModal.addEventListener("click", (event) => {
  if (event.target === calendarModal) {
    closeCalendarModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (!confirmModal.classList.contains("hidden")) {
    closeConfirmModal();
    return;
  }

  if (!colorModal.classList.contains("hidden")) {
    closeColorModal();
    return;
  }

  if (!calendarModal.classList.contains("hidden")) {
    closeCalendarModal();
  }
});

darkModeToggle.addEventListener("change", () => {
  settings.darkMode = darkModeToggle.checked;
  applyTheme();
  saveSettings();
});

cumulativeToggle.addEventListener("change", () => {
  settings.cumulativeMode = cumulativeToggle.checked;
  saveSettings();
});

undoToastAction.addEventListener("click", undoDelete);

function init() {
  loadRoutines();
  loadSettings();
  seedData();
  setView("home");
}

init();
