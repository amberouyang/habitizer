import { state, activityDragState, routineDragState } from "./state.js";
import { saveRoutines } from "./persistence.js";
import { getRoutineById } from "./models.js";

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

export function setupActivityDragAndDrop(listEl, routine) {
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

export function setupRoutineDragAndDrop(listEl) {
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
