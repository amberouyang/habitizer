import { state, settings, modalState, confirmCallback, confirmSecondaryCallback, liveTimerIntervalId, setLiveTimerIntervalId } from "./state.js";
import { saveRoutines, saveSettings, saveTimerSession, applyTheme } from "./persistence.js";
import { getRoutineById, syncRoutineEstimatedMinutes } from "./models.js";
import { parseEstimatedMinutes } from "./utils.js";
import { createId } from "./id.js";
import {
  modalOverlay,
  modalInput,
  modalMinutesInput,
  modalConfirm,
  modalCancel,
  confirmModal,
  confirmCancel,
  confirmSecondary,
  confirmAction,
  colorModal,
  colorModalClose,
  calendarModal,
  calendarModalClose,
  darkModeToggle,
  cumulativeToggle,
  completionSoundToggle,
  hapticsToggle,
  languageSelect,
  exportBackupBtn,
  importBackupBtn,
  importBackupInput,
  dueRemindersToggle,
  undoToastAction,
  backButton,
  addButton,
  tabBar,
} from "./dom.js";
import {
  closeNameModal,
  closeSettings,
  closeConfirmModal,
  closeColorModal,
  closeCalendarModal,
  syncSettingsView,
  openConfirmModal,
} from "./modals.js";
import { playCompletionSound } from "./audio.js";
import { hapticsSupported, triggerHaptic } from "./haptics.js";
import { t, applyDocumentLanguage, sanitizeLanguage } from "./i18n.js";
import {
  addRoutine,
  submitRoutineCreation,
  submitRoutineTime,
  openAddActivityModal,
} from "./routines.js";
import { undoDelete } from "./delete.js";
import { exportBackup, readBackupFile, applyBackup, mergeBackup } from "./backup.js";
import { setView, render } from "./views.js";
import { minimizeTimer } from "./timer.js";
import {
  STORAGE_KEY,
  SETTINGS_KEY,
  DELETED_ROUTINES_KEY,
  TIMER_SESSION_KEY,
} from "./constants.js";
import {
  notificationsSupported,
  enableDueReminders,
  disableDueReminders,
  checkAndNotifyDueRoutines,
} from "./reminders.js";

function resetLocalData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(DELETED_ROUTINES_KEY);
  localStorage.removeItem(TIMER_SESSION_KEY);
  window.location.reload();
}

export function wireEvents() {
  backButton?.addEventListener("click", () => {
    if (state.currentView === "timer") {
      minimizeTimer();
      return;
    }
    if (state.currentView === "routine") {
      const target = state.returnView === "history" ? "history" : "home";
      state.returnView = "home";
      setView(target);
    }
  });

  addButton?.addEventListener("click", () => {
    if (state.currentView === "home") {
      addRoutine();
    } else if (state.currentView === "routine") {
      openAddActivityModal(state.currentRoutineId);
    }
  });

  tabBar?.addEventListener("click", (event) => {
    const button = event.target.closest(".tab-btn");
    if (!button || !tabBar.contains(button)) return;
    const tab = button.dataset.tab;
    if (!tab || tab === state.currentView) return;
    if (state.currentView === "timer") {
      minimizeTimer(tab);
      return;
    }
    setView(tab);
  });

  modalConfirm?.addEventListener("click", () => {
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

      const estimatedMinutes = parseEstimatedMinutes(modalMinutesInput.value);
      if (estimatedMinutes === null) {
        modalMinutesInput.focus();
        modalMinutesInput.select();
        return;
      }

      routine.activities.push({
        id: createId(),
        name,
        estimatedMinutes,
        timeSpentMs: 0,
      });

      syncRoutineEstimatedMinutes(routine);
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

      const estimatedMinutes = parseEstimatedMinutes(modalMinutesInput.value);
      if (estimatedMinutes === null) {
        modalMinutesInput.focus();
        modalMinutesInput.select();
        return;
      }

      activity.name = name;
      activity.estimatedMinutes = estimatedMinutes;
      syncRoutineEstimatedMinutes(routine);
      saveRoutines();
      closeNameModal();
      render();
      return;
    }
  });

  modalCancel?.addEventListener("click", closeNameModal);

  function handleNameModalKeydown(event) {
    if (event.key === "Enter") {
      modalConfirm?.click();
    }

    if (event.key === "Escape") {
      closeNameModal();
    }
  }

  modalInput?.addEventListener("keydown", handleNameModalKeydown);
  modalMinutesInput?.addEventListener("keydown", handleNameModalKeydown);

  modalOverlay?.addEventListener("click", (event) => {
    if (event.target === modalOverlay) {
      closeNameModal();
    }
  });

  confirmCancel?.addEventListener("click", closeConfirmModal);

  confirmAction?.addEventListener("click", () => {
    if (confirmCallback) {
      confirmCallback();
    }
  });

  confirmSecondary?.addEventListener("click", () => {
    if (confirmSecondaryCallback) {
      confirmSecondaryCallback();
    }
  });

  confirmModal?.addEventListener("click", (event) => {
    if (event.target === confirmModal) {
      closeConfirmModal();
    }
  });

  colorModalClose?.addEventListener("click", closeColorModal);

  colorModal?.addEventListener("click", (event) => {
    if (event.target === colorModal) {
      closeColorModal();
    }
  });

  calendarModalClose?.addEventListener("click", closeCalendarModal);

  calendarModal?.addEventListener("click", (event) => {
    if (event.target === calendarModal) {
      closeCalendarModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (confirmModal && !confirmModal.classList.contains("hidden")) {
      closeConfirmModal();
      return;
    }

    if (colorModal && !colorModal.classList.contains("hidden")) {
      closeColorModal();
      return;
    }

    if (calendarModal && !calendarModal.classList.contains("hidden")) {
      closeCalendarModal();
    }
  });

  darkModeToggle?.addEventListener("change", () => {
    settings.darkMode = darkModeToggle.checked;
    applyTheme();
    saveSettings();
  });

  cumulativeToggle?.addEventListener("change", () => {
    settings.cumulativeMode = cumulativeToggle.checked;
    saveSettings();
  });

  completionSoundToggle?.addEventListener("change", () => {
    settings.completionSound = completionSoundToggle.checked;
    saveSettings();
    if (settings.completionSound) {
      playCompletionSound({ force: true });
    }
  });

  hapticsToggle?.addEventListener("change", () => {
    settings.haptics = hapticsToggle.checked;
    saveSettings();
    if (settings.haptics) {
      triggerHaptic("step", { force: true });
      if (!hapticsSupported()) {
        openConfirmModal({
          title: t("haptics.unsupportedTitle"),
          message: t("haptics.unsupportedMessage"),
          confirmLabel: t("app.done"),
          onConfirm: closeConfirmModal,
        });
      }
    }
  });

  dueRemindersToggle?.addEventListener("change", async () => {
    if (!dueRemindersToggle.checked) {
      disableDueReminders();
      saveSettings();
      return;
    }

    if (!notificationsSupported()) {
      dueRemindersToggle.checked = false;
      disableDueReminders();
      saveSettings();
      openConfirmModal({
        title: t("reminders.unsupportedTitle"),
        message: t("reminders.unsupportedMessage"),
        confirmLabel: t("app.done"),
        onConfirm: closeConfirmModal,
      });
      return;
    }

    const permission = await enableDueReminders();
    if (permission !== "granted") {
      dueRemindersToggle.checked = false;
      disableDueReminders();
      saveSettings();
      openConfirmModal({
        title: t("reminders.deniedTitle"),
        message: t("reminders.deniedMessage"),
        confirmLabel: t("app.done"),
        onConfirm: closeConfirmModal,
      });
      return;
    }

    saveSettings();
    checkAndNotifyDueRoutines();
  });

  languageSelect?.addEventListener("change", () => {
    settings.language = sanitizeLanguage(languageSelect.value);
    saveSettings();
    applyDocumentLanguage();
    render();
    if (state.currentView === "settings") {
      syncSettingsView();
    }
  });

  exportBackupBtn?.addEventListener("click", () => {
    exportBackup();
  });

  importBackupBtn?.addEventListener("click", () => {
    if (!importBackupInput) return;
    importBackupInput.value = "";
    importBackupInput.click();
  });

  document.getElementById("resetDataBtn")?.addEventListener("click", () => {
    openConfirmModal({
      title: t("settings.resetTitle"),
      message: t("settings.resetMessage"),
      confirmLabel: t("settings.resetConfirm"),
      onConfirm: () => {
        closeConfirmModal();
        resetLocalData();
      },
    });
  });

  importBackupInput?.addEventListener("change", async () => {
    const file = importBackupInput.files?.[0];
    if (!file) return;

    try {
      const parsed = await readBackupFile(file);
      const routineCount = parsed.routines.length;

      const finishImport = (mode) => {
        closeConfirmModal();

        if (liveTimerIntervalId) {
          clearInterval(liveTimerIntervalId);
          setLiveTimerIntervalId(null);
        }

        if (mode === "merge") {
          mergeBackup(parsed);
        } else {
          applyBackup(parsed);
        }
        closeSettings();
        setView("home");
        render();
      };

      openConfirmModal({
        title: t("modal.importTitle"),
        message: t("modal.importMessage", { count: routineCount }),
        confirmLabel: t("modal.importMerge"),
        confirmTone: "primary",
        onConfirm: () => finishImport("merge"),
        secondaryLabel: t("modal.importReplace"),
        secondaryTone: "danger",
        onSecondary: () => finishImport("replace"),
      });
    } catch (error) {
      openConfirmModal({
        title: t("modal.importErrorTitle"),
        message: error?.message || t("modal.importErrorFallback"),
        confirmLabel: t("app.done"),
        confirmTone: "primary",
        onConfirm: closeConfirmModal,
      });
    } finally {
      importBackupInput.value = "";
    }
  });

  undoToastAction?.addEventListener("click", undoDelete);

  window.addEventListener("pagehide", () => {
    if (state.timer.routineId) {
      saveTimerSession();
    }
  });
}
