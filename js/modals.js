import { ROUTINE_COLORS, DEFAULT_ROUTINE_COLOR_ID, DEFAULT_CUSTOM_COLOR, STREAK_DISPLAY_MIN, SAVED_COLORS_LIMIT, HOME_WIDGET_IDS, HOME_WIDGET_LABELS } from "./constants.js";
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
  completionSoundToggle,
  deletedRoutinesList,
  homeWidgetsSettings,
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
  formatDuration,
  formatRunCompletedAt,
  formatDurationLabel,
  getLocalDateKey,
  getCalendarMonthDate,
  formatCalendarMonthLabel,
  getDateKeyForDay,
  getCalendarWeeks,
  getRoutineCompletionDates,
  getRoutineRunHistory,
  getRoutineStreak,
  getFastestRunMs,
  getCompletionEstimateMessage,
} from "./utils.js";
import {
  getRoutineById,
  getRoutineColorSelection,
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
  reconcileHomeWidgets,
  setHomeWidgetVisibility,
} from "./persistence.js";
import { render } from "./views.js";

function getPresetValues() {
  return new Set(ROUTINE_COLORS.map((color) => color.value.toLowerCase()));
}

function getSavedColors() {
  if (!Array.isArray(settings.savedColors)) {
    settings.savedColors = [];
  }
  return settings.savedColors;
}

function addSavedColor(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  if (getPresetValues().has(normalized)) return normalized;

  const saved = getSavedColors().filter((color) => color !== normalized);
  saved.unshift(normalized);
  settings.savedColors = saved.slice(0, SAVED_COLORS_LIMIT);
  saveSettings();
  return normalized;
}

function removeSavedColor(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return;
  settings.savedColors = getSavedColors().filter((color) => color !== normalized);
  saveSettings();
}

function swatchMatchesSelection(node, selectedColor) {
  if (node.classList.contains("color-swatch-add")) return false;
  const selectedHex = normalizeHexColor(selectedColor);
  const value = node.dataset.colorValue || node.dataset.colorId;
  if (selectedHex) {
    return normalizeHexColor(value) === selectedHex;
  }
  return value === selectedColor;
}

function updateSwatchSelection(container, selectedColor) {
  container.querySelectorAll(".color-swatch").forEach((node) => {
    if (node.classList.contains("color-swatch-add")) return;
    node.setAttribute("aria-checked", String(swatchMatchesSelection(node, selectedColor)));
  });
}

function createPresetSwatch(color, selectedColor, onSelect, container) {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "color-swatch";
  swatch.dataset.colorId = color.id;
  swatch.dataset.colorValue = color.value;
  swatch.style.setProperty("--swatch-color", color.value);
  swatch.title = color.label;
  swatch.setAttribute("role", "radio");
  swatch.setAttribute("aria-label", color.label);
  swatch.setAttribute("aria-checked", String(selectedColor === color.id));
  swatch.addEventListener("click", () => {
    onSelect(color.id, { isCustom: false });
    updateSwatchSelection(container, color.id);
  });
  return swatch;
}

function createHexSwatch(hex, selectedColor, onSelect, container, { removable = false } = {}) {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "color-swatch color-swatch-saved";
  swatch.dataset.colorValue = hex;
  swatch.style.setProperty("--swatch-color", hex);
  swatch.title = hex;
  swatch.setAttribute("role", "radio");
  swatch.setAttribute("aria-label", removable ? `Saved color ${hex}` : `Custom color ${hex}`);
  swatch.setAttribute("aria-checked", String(normalizeHexColor(selectedColor) === hex));

  swatch.addEventListener("click", () => {
    onSelect(hex, { isCustom: true });
    updateSwatchSelection(container, hex);
  });

  if (!removable) {
    return swatch;
  }

  const wrap = document.createElement("div");
  wrap.className = "color-swatch-wrap";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "color-swatch-remove";
  removeBtn.title = "Remove saved color";
  removeBtn.setAttribute("aria-label", `Remove saved color ${hex}`);
  removeBtn.innerHTML = "<span aria-hidden=\"true\">×</span>";

  removeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openConfirmModal({
      title: "Remove saved color?",
      message: `Remove ${hex} from your saved colors?`,
      confirmLabel: "Remove",
      onConfirm: () => {
        closeConfirmModal();
        const nextSelection = normalizeHexColor(selectedColor) === hex
          ? DEFAULT_ROUTINE_COLOR_ID
          : selectedColor;
        removeSavedColor(hex);
        if (normalizeHexColor(selectedColor) === hex) {
          onSelect(DEFAULT_ROUTINE_COLOR_ID, { isCustom: false });
        }
        buildColorSwatches(container, nextSelection, onSelect);
      },
    });
  });

  wrap.append(swatch, removeBtn);
  return wrap;
}

function createAddColorControl(selectedColor, onSelect, container) {
  const addSwatch = document.createElement("label");
  addSwatch.className = "color-swatch color-swatch-add";
  addSwatch.title = "Pick a color";
  addSwatch.setAttribute("aria-label", "Pick a color");

  const plus = document.createElement("span");
  plus.className = "color-swatch-add-icon";
  plus.textContent = "+";
  plus.setAttribute("aria-hidden", "true");

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.className = "color-swatch-input";
  colorInput.value = normalizeHexColor(selectedColor) || DEFAULT_CUSTOM_COLOR;
  colorInput.setAttribute("aria-label", "Pick a color");

  const pendingRow = document.createElement("div");
  pendingRow.className = "color-add-pending hidden";

  const preview = document.createElement("span");
  preview.className = "color-swatch color-swatch-pending-preview";
  preview.setAttribute("aria-hidden", "true");

  const pendingLabel = document.createElement("span");
  pendingLabel.className = "color-add-pending-label";
  pendingLabel.textContent = "New color";

  const actions = document.createElement("div");
  actions.className = "color-add-pending-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "color-add-cancel";
  cancelBtn.textContent = "Cancel";

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "color-add-confirm";
  confirmBtn.textContent = "Add";

  let pendingHex = null;

  const hidePending = () => {
    pendingHex = null;
    pendingRow.classList.add("hidden");
    addSwatch.classList.remove("is-picking");
    addSwatch.style.removeProperty("--swatch-color");
  };

  const showPending = (rawValue) => {
    const hex = normalizeHexColor(rawValue);
    if (!hex) return;
    pendingHex = hex;
    colorInput.value = hex;
    preview.style.setProperty("--swatch-color", hex);
    pendingLabel.textContent = hex;
    pendingRow.classList.remove("hidden");
    addSwatch.classList.add("is-picking");
    addSwatch.style.setProperty("--swatch-color", hex);
  };

  colorInput.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  colorInput.addEventListener("input", () => {
    showPending(colorInput.value);
  });

  colorInput.addEventListener("change", () => {
    showPending(colorInput.value);
  });

  cancelBtn.addEventListener("click", () => {
    hidePending();
  });

  confirmBtn.addEventListener("click", () => {
    if (!pendingHex) return;
    const hex = addSavedColor(pendingHex);
    if (!hex) return;
    onSelect(hex, { isCustom: true });
    buildColorSwatches(container, hex, onSelect);
  });

  addSwatch.append(plus, colorInput);
  actions.append(cancelBtn, confirmBtn);
  pendingRow.append(preview, pendingLabel, actions);

  return { addSwatch, pendingRow };
}

export function buildColorSwatches(container, selectedColor, onSelect) {
  container.innerHTML = "";

  const initialSelection = isValidRoutineColor(selectedColor)
    ? (normalizeHexColor(selectedColor) || selectedColor)
    : DEFAULT_ROUTINE_COLOR_ID;

  ROUTINE_COLORS.forEach((color) => {
    container.appendChild(createPresetSwatch(color, initialSelection, onSelect, container));
  });

  const saved = getSavedColors();
  const selectedHex = normalizeHexColor(initialSelection);
  if (selectedHex && !saved.includes(selectedHex) && !getPresetValues().has(selectedHex)) {
    // Show the current custom color even if it wasn't saved yet.
    container.appendChild(createHexSwatch(selectedHex, initialSelection, onSelect, container));
  }

  saved.forEach((hex) => {
    container.appendChild(createHexSwatch(hex, initialSelection, onSelect, container, { removable: true }));
  });

  const { addSwatch, pendingRow } = createAddColorControl(initialSelection, onSelect, container);
  container.append(addSwatch, pendingRow);
  updateSwatchSelection(container, initialSelection);
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

function buildRunHistoryContent(routine) {
  const section = document.createElement("section");
  section.className = "run-history";
  section.setAttribute("aria-label", "Recent runs");

  const header = document.createElement("div");
  header.className = "run-history-header";

  const title = document.createElement("h3");
  title.className = "run-history-title";
  title.textContent = "Recent runs";

  header.appendChild(title);

  const fastestMs = getFastestRunMs(routine);
  if (fastestMs != null) {
    const best = document.createElement("p");
    best.className = "run-history-best";
    best.textContent = `Best time: ${formatDuration(fastestMs)}`;
    header.appendChild(best);
  }

  section.appendChild(header);

  const runs = getRoutineRunHistory(routine);
  if (runs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "run-history-empty";
    empty.textContent = "No runs yet. Finish a routine to see durations here.";
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement("div");
  list.className = "run-history-list";

  runs.forEach((run) => {
    const item = document.createElement("div");
    item.className = "run-history-item";

    const top = document.createElement("div");
    top.className = "run-history-item-top";

    const when = document.createElement("span");
    when.className = "run-history-when";
    when.textContent = formatRunCompletedAt(run.completedAt);

    const duration = document.createElement("strong");
    duration.className = "run-history-duration";
    duration.textContent = formatDuration(run.totalMs);

    top.append(when, duration);

    const meta = document.createElement("div");
    meta.className = "run-history-meta";

    const parts = [];
    if (run.activitiesTotal > 0) {
      parts.push(`${run.activitiesCompleted} of ${run.activitiesTotal} activities`);
    }
    if (run.estimatedMs > 0) {
      const estimateMessage = getCompletionEstimateMessage(run.totalMs, run.estimatedMs);
      if (estimateMessage) {
        parts.push(`${formatDurationLabel(run.estimatedMs)} estimate · ${estimateMessage}`);
      }
    }
    meta.textContent = parts.join(" · ");

    if (fastestMs != null && Number(run.totalMs) === fastestMs) {
      item.classList.add("is-best");
    }

    item.append(top, meta);
    list.appendChild(item);
  });

  section.appendChild(list);
  return section;
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

  calendarModalBody.replaceChildren(
    buildStreakCalendarContent(routine),
    buildRunHistoryContent(routine)
  );
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
  completionSoundToggle.checked = settings.completionSound;
  renderHomeWidgetSettings();
  renderDeletedRoutinesList();
  settingsModal.classList.remove("hidden");
  settingsModal.setAttribute("aria-hidden", "false");
}

export function closeSettings() {
  settingsModal.classList.add("hidden");
  settingsModal.setAttribute("aria-hidden", "true");
  settings.darkMode = darkModeToggle.checked;
  settings.cumulativeMode = cumulativeToggle.checked;
  settings.completionSound = completionSoundToggle.checked;
  applyTheme();
  saveSettings();
  render();
}

function renderHomeWidgetSettings() {
  if (!homeWidgetsSettings) return;

  reconcileHomeWidgets();
  homeWidgetsSettings.replaceChildren();

  const visibleCount = settings.homeWidgets.length;

  HOME_WIDGET_IDS.forEach((widgetId) => {
    const isVisible = settings.homeWidgets.includes(widgetId);
    const row = document.createElement("label");
    row.className = "settings-row home-widget-setting-row";
    row.htmlFor = `homeWidgetToggle-${widgetId}`;

    const copy = document.createElement("span");
    copy.className = "settings-copy";

    const title = document.createElement("span");
    title.className = "settings-title";
    title.textContent = HOME_WIDGET_LABELS[widgetId] || widgetId;

    const desc = document.createElement("p");
    desc.className = "settings-desc";
    desc.textContent = isVisible
      ? "On the home screen (Hide there only collapses it)"
      : "Removed from the home screen";

    copy.append(title, desc);

    const toggle = document.createElement("input");
    toggle.id = `homeWidgetToggle-${widgetId}`;
    toggle.className = "toggle-input";
    toggle.type = "checkbox";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", `Show ${HOME_WIDGET_LABELS[widgetId] || widgetId}`);
    toggle.checked = isVisible;
    toggle.disabled = isVisible && visibleCount <= 1;

    toggle.addEventListener("change", () => {
      const ok = setHomeWidgetVisibility(widgetId, toggle.checked);
      if (!ok) {
        toggle.checked = true;
      }
      renderHomeWidgetSettings();
      if (state.currentView === "home") {
        render();
      }
    });

    row.append(copy, toggle);
    homeWidgetsSettings.appendChild(row);
  });
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
