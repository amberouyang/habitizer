import { state, settings, modalState, confirmCallback } from "./state.js";
import {
  backButton,
  addButton,
  menuButton,
  modalOverlay,
  modalInput,
  modalMinutesInput,
  modalConfirm,
  modalCancel,
  settingsModal,
  settingsClose,
  confirmModal,
  confirmCancel,
  confirmAction,
  colorModal,
  colorModalClose,
  calendarModal,
  calendarModalClose,
  darkModeToggle,
  cumulativeToggle,
  undoToastAction,
} from "./dom.js";
import { saveRoutines, saveSettings, saveTimerSession, applyTheme } from "./persistence.js";
import { getRoutineById } from "./models.js";
import {
  closeNameModal,
  closeSettings,
  closeConfirmModal,
  closeColorModal,
  closeCalendarModal,
  openSettings,
} from "./modals.js";
import {
  addRoutine,
  submitRoutineCreation,
  submitRoutineTime,
  openAddActivityModal,
} from "./routines.js";
import { undoDelete } from "./delete.js";
import { setView, render } from "./views.js";

export function wireEvents() {
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
      const routineId = modalState.routineId;

      if (!routine || !name) {
        modalInput.focus();
        return;
      }

      routine.name = name;
      saveRoutines();
      closeNameModal();

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

  window.addEventListener("pagehide", () => {
    if (state.timer.routineId) {
      saveTimerSession();
    }
  });
}
