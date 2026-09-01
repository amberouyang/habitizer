import { UNDO_DELETE_MS } from "./constants.js";
import {
  state,
  pendingDelete,
  pendingDeleteTimeoutId,
  setPendingDeleteTimeoutId,
} from "./state.js";
import {
  undoToast,
  undoToastMessage,
} from "./dom.js";
import { saveRoutines, archiveDeletedRoutine } from "./persistence.js";
import { getRoutineById } from "./models.js";
import { closeConfirmModal } from "./modals.js";
import { setView, render } from "./views.js";

export function hasPendingDelete() {
  return pendingDelete.type !== null;
}

export function clearPendingDeleteState() {
  pendingDelete.type = null;
  pendingDelete.routineId = null;
  pendingDelete.routine = null;
  pendingDelete.routineIndex = null;
  pendingDelete.activity = null;
  pendingDelete.activityIndex = null;
}

export function finalizePendingDelete() {
  if (pendingDeleteTimeoutId) {
    clearTimeout(pendingDeleteTimeoutId);
    setPendingDeleteTimeoutId(null);
  }

  if (!hasPendingDelete()) {
    return;
  }

  if (pendingDelete.type === "routine" && pendingDelete.routine) {
    archiveDeletedRoutine(pendingDelete.routine, pendingDelete.routineIndex);
  }

  saveRoutines();
  clearPendingDeleteState();
  hideUndoToast();
}

export function showUndoToast(message) {
  undoToastMessage.textContent = message;
  undoToast.classList.remove("hidden");
  undoToast.setAttribute("aria-hidden", "false");
}

export function hideUndoToast() {
  undoToast.classList.add("hidden");
  undoToast.setAttribute("aria-hidden", "true");
  undoToastMessage.textContent = "";
}

export function performDeleteRoutine(routineId) {
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

  setPendingDeleteTimeoutId(setTimeout(() => {
    finalizePendingDelete();
  }, UNDO_DELETE_MS));
}

export function undoDelete() {
  if (!hasPendingDelete()) return;

  if (pendingDeleteTimeoutId) {
    clearTimeout(pendingDeleteTimeoutId);
    setPendingDeleteTimeoutId(null);
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

export function performDeleteActivity(routineId, activityId) {
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

  setPendingDeleteTimeoutId(setTimeout(() => {
    finalizePendingDelete();
  }, UNDO_DELETE_MS));

  render();
}
