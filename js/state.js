import { DEFAULT_ROUTINE_COLOR_ID } from "./constants.js";

export const state = {
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

export const settings = {
  cumulativeMode: true,
  darkMode: false,
};

export let deletedRoutines = [];
export let liveTimerIntervalId = null;
export let pendingDeleteTimeoutId = null;
export let createModalColorId = DEFAULT_ROUTINE_COLOR_ID;
export let colorModalRoutineId = null;
export let calendarModalRoutineId = null;
export let confirmCallback = null;
export let settingsButton = null;

export const pendingDelete = {
  type: null,
  routineId: null,
  routine: null,
  routineIndex: null,
  activity: null,
  activityIndex: null,
};

export const modalState = {
  mode: null,
  routineId: null,
  activityId: null,
};

export const activityDragState = {
  routineId: null,
  activityId: null,
  pointerId: null,
  item: null,
  list: null,
  startY: 0,
};

export const routineDragState = {
  routineId: null,
  pointerId: null,
  item: null,
  list: null,
  startY: 0,
};

export function setDeletedRoutines(value) {
  deletedRoutines = value;
}

export function setLiveTimerIntervalId(id) {
  liveTimerIntervalId = id;
}

export function setPendingDeleteTimeoutId(id) {
  pendingDeleteTimeoutId = id;
}

export function setCreateModalColorId(id) {
  createModalColorId = id;
}

export function setColorModalRoutineId(id) {
  colorModalRoutineId = id;
}

export function setCalendarModalRoutineId(id) {
  calendarModalRoutineId = id;
}

export function setConfirmCallback(cb) {
  confirmCallback = cb;
}
