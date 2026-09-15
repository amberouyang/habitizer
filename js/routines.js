import { state, modalState, createModalColorId } from "./state.js";
import {
  modalInput,
  modalMinutesInput,
} from "./dom.js";
import { parseEstimatedMinutes } from "./utils.js";
import { createId } from "./id.js";
import {
  getRoutineById,
  isValidRoutineColor,
  getNextRoutineColorId,
  syncRoutineEstimatedMinutes,
} from "./models.js";
import { saveRoutines } from "./persistence.js";
import { t } from "./i18n.js";
import {
  openNameModal,
  closeNameModal,
  openConfirmModal,
} from "./modals.js";
import { performDeleteRoutine, performDeleteActivity } from "./delete.js";
import { setView, render } from "./views.js";
import {
  copySpacedRepetitionFields,
  setSpacedRepetitionEnabled,
} from "./schedule.js";

export function addRoutine() {
  openNameModal({
    title: t("modal.newRoutine"),
    placeholder: t("modal.morningPlaceholder"),
    confirmLabel: t("app.create"),
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
    id: createId(),
    name,
    color: isValidRoutineColor(createModalColorId) ? createModalColorId : getNextRoutineColorId(),
    estimatedMinutes,
    activities: [],
    completionDates: [],
    runHistory: [],
    spacedRepetition: false,
    srsLevel: 0,
    nextDueDate: null,
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
    title: t("modal.renameRoutine"),
    placeholder: t("modal.routineNamePlaceholder"),
    confirmLabel: t("app.rename"),
    mode: "rename",
    routineId,
    initialValue: routine.name,
  });
}

export function editRoutineTime(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  openNameModal({
    title: t("modal.estimatedTime"),
    label: "Minutes",
    placeholder: "15",
    confirmLabel: t("app.save"),
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
    title: t("modal.deleteRoutineTitle"),
    message: t("modal.deleteRoutineMessage", { name: routine.name }),
    confirmLabel: t("app.delete"),
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
    id: createId(),
    name: getDuplicateRoutineName(routine.name),
    color: routine.color || getNextRoutineColorId(),
    estimatedMinutes: Number(routine.estimatedMinutes || 0),
    activities: routine.activities.map((activity) => ({
      id: createId(),
      name: activity.name,
      estimatedMinutes: Number(activity.estimatedMinutes || 0),
      timeSpentMs: 0,
    })),
    completionDates: [],
    runHistory: [],
    spacedRepetition: false,
    srsLevel: 0,
    nextDueDate: null,
  };
  copySpacedRepetitionFields(routine, duplicate);

  const sourceIndex = state.routines.findIndex((item) => item.id === routineId);
  state.routines.splice(sourceIndex + 1, 0, duplicate);
  syncRoutineEstimatedMinutes(duplicate);
  saveRoutines();
  setView("routine", duplicate.id);
}

export function toggleRoutineSpacedRepetition(routineId, enabled) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  setSpacedRepetitionEnabled(routine, enabled);
  saveRoutines();
  render();
}

export function openAddActivityModal(routineId) {
  openNameModal({
    title: t("modal.newActivity"),
    placeholder: t("modal.activityPlaceholder"),
    confirmLabel: t("app.addAction"),
    mode: "activity",
    routineId,
    showEstimatedMinutes: true,
    estimatedMinutesDefault: "5",
  });
}

export function renameActivity(routineId, activityId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const activity = routine.activities.find((item) => item.id === activityId);
  if (!activity) return;

  openNameModal({
    title: t("modal.editActivity"),
    placeholder: t("modal.activityNamePlaceholder"),
    confirmLabel: t("app.save"),
    mode: "renameActivity",
    routineId,
    activityId,
    initialValue: activity.name,
    showEstimatedMinutes: true,
    estimatedMinutesDefault: String(activity.estimatedMinutes ?? 5),
  });
}

export function deleteActivity(routineId, activityId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const activity = routine.activities.find((item) => item.id === activityId);
  if (!activity) return;

  openConfirmModal({
    title: t("modal.deleteActivityTitle"),
    message: t("modal.deleteActivityMessage", { name: activity.name }),
    confirmLabel: t("app.delete"),
    onConfirm: () => performDeleteActivity(routineId, activityId),
  });
}
