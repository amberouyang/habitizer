import { ROUTINE_COLORS, DEFAULT_ROUTINE_COLOR_ID, DEFAULT_CUSTOM_COLOR, STREAK_DISPLAY_MIN } from "./constants.js";
import {
  state,
  settings,
  modalState,
  createModalColorId,
  calendarModalRoutineId,
  deletedRoutines,
  setCreateModalColorId,
  setColorModalRoutineId,
  setCalendarModalRoutineId,
  setConfirmCallback,
  setDeletedRoutines,
} from "./state.js";
import {
  modalOverlay,
  modalTitle,
  modalLabel,
  modalInput,
  modalMinutesGroup,
  modalMinutesInput,
  modalColorGroup,
  modalColorSwatches,
  modalConfirm,
  settingsModal,
  settingsClose,
  darkModeToggle,
  cumulativeToggle,
  deletedRoutinesList,
  confirmModal,
  confirmTitle,
  confirmMessage,
  confirmCancel,
  confirmAction,
  colorModal,
  colorModalSwatches,
  colorModalClose,
  calendarModal,
  calendarModalTitle,
  calendarModalSubtitle,
  calendarModalBody,
  calendarModalClose,
} from "./dom.js";
import {
  formatDeletedAtLabel,
  formatStreakLabel,
  getLocalDateKey,
  getCalendarMonthDate,
  formatCalendarMonthLabel,
  getDateKeyForDay,
  getCalendarWeeks,
  getRoutineCompletionDates,
  getRoutineStreak,
} from "./utils.js";
import {
  getRoutineById,
  getRoutineColorSelection,
  isHexColor,
  isValidRoutineColor,
  normalizeHexColor,
  getNextRoutineColorId,
} from "./models.js";
import {
  saveRoutines,
  saveDeletedRoutines,
  saveSettings,
  applyTheme,
  pruneExpiredDeletedRoutines,
} from "./persistence.js";
import { render } from "./views.js";

function updateSwatchSelection(container, selectedColor) {
  container.querySelectorAll(".color-swatch").forEach((node) => {
    const isCustomSwatch = node.dataset.colorId === "custom";
    const checked = isCustomSwatch
      ? isHexColor(selectedColor)
      : node.dataset.colorId === selectedColor;
    node.setAttribute("aria-checked", String(checked));

    if (isCustomSwatch && isHexColor(selectedColor)) {
      node.style.setProperty("--swatch-color", selectedColor);
      const input = node.querySelector('input[type="color"]');
      if (input) input.value = selectedColor;
    }
  });
}

export function buildColorSwatches(container, selectedColor, onSelect) {
  container.innerHTML = "";

  const initialSelection = isValidRoutineColor(selectedColor)
    ? (normalizeHexColor(selectedColor) || selectedColor)
    : DEFAULT_ROUTINE_COLOR_ID;

  ROUTINE_COLORS.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.dataset.colorId = color.id;
    swatch.style.setProperty("--swatch-color", color.value);
    swatch.title = color.label;
    swatch.setAttribute("role", "radio");
    swatch.setAttribute("aria-label", color.label);
    swatch.setAttribute("aria-checked", String(initialSelection === color.id));
    swatch.addEventListener("click", () => {
      onSelect(color.id, { isCustom: false });
      updateSwatchSelection(container, color.id);
    });
    container.appendChild(swatch);
  });

  const customSelected = isHexColor(initialSelection);
  const customValue = customSelected ? initialSelection : DEFAULT_CUSTOM_COLOR;

  const customSwatch = document.createElement("label");
  customSwatch.className = "color-swatch color-swatch-custom";
  customSwatch.dataset.colorId = "custom";
  customSwatch.title = "Custom color";
  customSwatch.setAttribute("role", "radio");
  customSwatch.setAttribute("aria-label", "Custom color");
  customSwatch.setAttribute("aria-checked", String(customSelected));
  if (customSelected) {
    customSwatch.style.setProperty("--swatch-color", customValue);
  }

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.className = "color-swatch-input";
  colorInput.value = customValue;
  colorInput.setAttribute("aria-label", "Pick a custom color");
  colorInput.addEventListener("input", () => {
    const hex = normalizeHexColor(colorInput.value) || DEFAULT_CUSTOM_COLOR;
    customSwatch.style.setProperty("--swatch-color", hex);
    onSelect(hex, { isCustom: true });
    updateSwatchSelection(container, hex);
  });
  colorInput.addEventListener("click", (event) => {
    event.stopPropagation();
    const hex = normalizeHexColor(colorInput.value) || DEFAULT_CUSTOM_COLOR;
    customSwatch.style.setProperty("--swatch-color", hex);
    onSelect(hex, { isCustom: true });
    updateSwatchSelection(container, hex);
  });

  customSwatch.appendChild(colorInput);
  container.appendChild(customSwatch);
}

export function openNameModal({
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
  showColorPicker = false,
  colorDefault = null,
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

  if (showColorPicker) {
    modalColorGroup.classList.remove("hidden");
    setCreateModalColorId(colorDefault || getNextRoutineColorId());
    buildColorSwatches(modalColorSwatches, createModalColorId, (colorValue) => {
      setCreateModalColorId(colorValue);
    });
  } else {
    modalColorGroup.classList.add("hidden");
    modalColorSwatches.innerHTML = "";
    setCreateModalColorId(DEFAULT_ROUTINE_COLOR_ID);
  }

  modalConfirm.textContent = confirmLabel;
  modalOverlay.classList.remove("hidden");
  modalOverlay.setAttribute("aria-hidden", "false");
  modalInput.focus();
  modalInput.select();
}

export function closeNameModal() {
  modalOverlay.classList.add("hidden");
  modalOverlay.setAttribute("aria-hidden", "true");
  modalInput.value = "";
  modalInput.type = "text";
  modalInput.maxLength = 40;
  modalInput.removeAttribute("min");
  modalInput.removeAttribute("step");
  modalMinutesGroup.classList.add("hidden");
  modalMinutesInput.value = "";
  modalColorGroup.classList.add("hidden");
  modalColorSwatches.innerHTML = "";
  setCreateModalColorId(DEFAULT_ROUTINE_COLOR_ID);
  modalState.mode = null;
  modalState.routineId = null;
  modalState.activityId = null;
}

function setRoutineColor(routineId, colorValue, { close = true } = {}) {
  const routine = getRoutineById(routineId);
  if (!routine || !isValidRoutineColor(colorValue)) return;

  routine.color = normalizeHexColor(colorValue) || colorValue;
  saveRoutines();
  if (close) {
    closeColorModal();
  }
  render();
}

export function openColorModal(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  setColorModalRoutineId(routineId);
  buildColorSwatches(colorModalSwatches, getRoutineColorSelection(routine), (colorValue, meta = {}) => {
    setRoutineColor(routineId, colorValue, { close: !meta.isCustom });
  });

  colorModal.classList.remove("hidden");
  colorModal.setAttribute("aria-hidden", "false");
  colorModalSwatches.querySelector('[aria-checked="true"]')?.focus();
}

export function closeColorModal() {
  colorModal.classList.add("hidden");
  colorModal.setAttribute("aria-hidden", "true");
  setColorModalRoutineId(null);
  colorModalSwatches.innerHTML = "";
}

function changeRoutineCalendarMonth(delta) {
  state.routineCalendarOffset += delta;
  if (!calendarModal.classList.contains("hidden")) {
    refreshCalendarModalContent();
  }
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

export function openCalendarModal(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  if (routineId !== state.calendarRoutineId) {
    state.routineCalendarOffset = 0;
    state.calendarRoutineId = routineId;
  }

  setCalendarModalRoutineId(routineId);
  updateCalendarModal(routine);
  calendarModal.classList.remove("hidden");
  calendarModal.setAttribute("aria-hidden", "false");
  calendarModalClose.focus();
}

export function closeCalendarModal() {
  calendarModal.classList.add("hidden");
  calendarModal.setAttribute("aria-hidden", "true");
  setCalendarModalRoutineId(null);
  calendarModalBody.replaceChildren();
  calendarModalSubtitle.textContent = "";
  calendarModalSubtitle.classList.add("hidden");
}

export function openSettings() {
  darkModeToggle.checked = settings.darkMode;
  cumulativeToggle.checked = settings.cumulativeMode;
  renderDeletedRoutinesList();
  settingsModal.classList.remove("hidden");
  settingsModal.setAttribute("aria-hidden", "false");
}

export function closeSettings() {
  settingsModal.classList.add("hidden");
  settingsModal.setAttribute("aria-hidden", "true");
  settings.darkMode = darkModeToggle.checked;
  settings.cumulativeMode = cumulativeToggle.checked;
  applyTheme();
  saveSettings();
}

export function openConfirmModal({ title, message, confirmLabel, onConfirm }) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmAction.textContent = confirmLabel;
  setConfirmCallback(onConfirm);
  confirmModal.classList.remove("hidden");
  confirmModal.setAttribute("aria-hidden", "false");
  confirmCancel.focus();
}

export function closeConfirmModal() {
  confirmModal.classList.add("hidden");
  confirmModal.setAttribute("aria-hidden", "true");
  setConfirmCallback(null);
}

export function restoreDeletedRoutine(entryId) {
  const entry = deletedRoutines.find((item) => item.id === entryId);
  if (!entry) return;

  const insertIndex = Math.min(entry.routineIndex, state.routines.length);
  state.routines.splice(insertIndex, 0, entry.routine);
  setDeletedRoutines(deletedRoutines.filter((item) => item.id !== entryId));

  saveRoutines();
  saveDeletedRoutines();
  renderDeletedRoutinesList();
  render();
}

export function requestPermanentDeleteArchivedRoutine(entryId) {
  const entry = deletedRoutines.find((item) => item.id === entryId);
  if (!entry) return;

  openConfirmModal({
    title: "Delete forever?",
    message: `Permanently delete "${entry.routine.name}"? This cannot be undone.`,
    confirmLabel: "Delete forever",
    onConfirm: () => permanentlyDeleteArchivedRoutine(entryId),
  });
}

function permanentlyDeleteArchivedRoutine(entryId) {
  closeConfirmModal();
  setDeletedRoutines(deletedRoutines.filter((item) => item.id !== entryId));
  saveDeletedRoutines();
  renderDeletedRoutinesList();
}

export function renderDeletedRoutinesList() {
  if (!deletedRoutinesList) return;

  pruneExpiredDeletedRoutines();
  deletedRoutinesList.innerHTML = "";

  if (deletedRoutines.length === 0) {
    const empty = document.createElement("p");
    empty.className = "deleted-routines-empty";
    empty.textContent = "No recently deleted routines.";
    deletedRoutinesList.appendChild(empty);
    return;
  }

  deletedRoutines.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "deleted-routine-item";

    const info = document.createElement("div");
    info.className = "deleted-routine-info";

    const name = document.createElement("div");
    name.className = "deleted-routine-name";
    name.textContent = entry.routine.name;
    name.title = entry.routine.name;

    const meta = document.createElement("div");
    meta.className = "deleted-routine-meta";
    meta.textContent = `Deleted ${formatDeletedAtLabel(entry.deletedAt)}`;

    info.append(name, meta);

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "secondary-btn deleted-routine-restore";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", () => restoreDeletedRoutine(entry.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "small-btn delete-btn deleted-routine-delete";
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Delete forever";
    deleteBtn.setAttribute("aria-label", `Delete ${entry.routine.name} forever`);
    deleteBtn.addEventListener("click", () => requestPermanentDeleteArchivedRoutine(entry.id));

    const actions = document.createElement("div");
    actions.className = "deleted-routine-actions";
    actions.append(restoreBtn, deleteBtn);

    item.append(info, actions);
    deletedRoutinesList.appendChild(item);
  });
}
