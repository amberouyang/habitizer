import { state, modalState, createModalColorId } from "./state.js";
import {
  modalInput,
  modalMinutesInput,
} from "./dom.js";
import { parseEstimatedMinutes } from "./utils.js";
import {
  getRoutineById,
  isValidRoutineColor,
  getNextRoutineColorId,
} from "./models.js";
import { saveRoutines } from "./persistence.js";
import {
  openNameModal,
  closeNameModal,
  openConfirmModal,
} from "./modals.js";
import { performDeleteRoutine, performDeleteActivity } from "./delete.js";
import { setView, render } from "./views.js";

export function addRoutine() {
  openNameModal({
    title: "New routine",
    placeholder: "Morning routine",
    confirmLabel: "Create",
    mode: "routine",
    showEstimatedMinutes: true,
    estimatedMinutesDefault: "10",
    showColorPicker: true,
    colorDefault: getNextRoutineColorId(),
  });
}

export function submitRoutineCreation() {
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
    color: isValidRoutineColor(createModalColorId) ? createModalColorId : getNextRoutineColorId(),
    estimatedMinutes,
    activities: [],
    completionDates: [],
  };

  state.routines.unshift(newRoutine);
  saveRoutines();
  closeNameModal();
  setView("routine", newRoutine.id);
}

export function renameRoutine(routineId) {
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

export function editRoutineTime(routineId) {
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

export function submitRoutineTime() {
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

export function deleteRoutine(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  openConfirmModal({
    title: "Delete routine?",
    message: `Delete "${routine.name}"? You can undo this briefly after confirming.`,
    confirmLabel: "Delete",
    onConfirm: () => performDeleteRoutine(routineId),
  });
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

export function duplicateRoutine(routineId) {
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

export function openAddActivityModal(routineId) {
  openNameModal({
    title: "New activity",
    placeholder: "Stretch",
    confirmLabel: "Add",
    mode: "activity",
    routineId,
  });
}

export function renameActivity(routineId, activityId) {
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

export function deleteActivity(routineId, activityId) {
  performDeleteActivity(routineId, activityId);
}
