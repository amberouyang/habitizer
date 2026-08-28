const STORAGE_KEY = "habitizer-routines-v1";
const SETTINGS_KEY = "habitizer-settings-v1";

const state = {
  routines: [],
  currentRoutineId: null,
  currentView: "home",
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
};

let liveTimerIntervalId = null;

const appEl = document.getElementById("app");
const pageTitleEl = document.getElementById("pageTitle");
const addButton = document.getElementById("addButton");
const backButton = document.getElementById("backButton");
const menuButton = document.getElementById("menuButton");
const modalOverlay = document.getElementById("nameModal");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");
const settingsModal = document.getElementById("settingsModal");
const settingsClose = document.getElementById("settingsClose");
const cumulativeToggle = document.getElementById("cumulativeToggle");
let settingsButton = null;

const modalState = {
  mode: null,
  routineId: null,
  activityId: null,
};

function openNameModal({ title, placeholder, confirmLabel, mode, routineId = null, activityId = null, initialValue = "" }) {
  modalState.mode = mode;
  modalState.routineId = routineId;
  modalState.activityId = activityId;

  modalTitle.textContent = title;
  modalInput.placeholder = placeholder;
  modalInput.value = initialValue;
  modalConfirm.textContent = confirmLabel;
  modalOverlay.classList.remove("hidden");
  modalOverlay.setAttribute("aria-hidden", "false");
  modalInput.focus();
}

function closeNameModal() {
  modalOverlay.classList.add("hidden");
  modalOverlay.setAttribute("aria-hidden", "true");
  modalInput.value = "";
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

function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    Object.assign(settings, JSON.parse(stored));
  }
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
  cumulativeToggle.checked = settings.cumulativeMode;
  settingsModal.classList.remove("hidden");
  settingsModal.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
  settingsModal.setAttribute("aria-hidden", "true");
  settings.cumulativeMode = cumulativeToggle.checked;
  saveSettings();
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
  });
}

function submitRoutineCreation() {
  const name = modalInput.value.trim();
  if (!name) {
    modalInput.focus();
    return;
  }

  const newRoutine = {
    id: crypto.randomUUID(),
    name,
    estimatedMinutes: 10,
    activities: [],
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

  const value = window.prompt("Estimated routine time (minutes):", routine.estimatedMinutes || 0);
  if (value === null) return;

  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) {
    window.alert("Please enter a valid number of minutes.");
    return;
  }

  routine.estimatedMinutes = minutes;
  saveRoutines();
  render();
}

function deleteRoutine(routineId) {
  const routine = getRoutineById(routineId);
  if (!routine) return;

  const confirmed = window.confirm(`Delete "${routine.name}"?`);
  if (!confirmed) return;

  state.routines = state.routines.filter((item) => item.id !== routineId);
  saveRoutines();
  setView("home");
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
  const routine = getRoutineById(routineId);
  if (!routine) return;

  routine.activities = routine.activities.filter((item) => item.id !== activityId);
  saveRoutines();
  render();
}

let isAnimatingActivitySwap = false;

function moveActivity(routineId, activityId, direction) {
  const routine = getRoutineById(routineId);
  if (!routine || isAnimatingActivitySwap) return;

  const index = routine.activities.findIndex((item) => item.id === activityId);
  if (index === -1) return;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= routine.activities.length) return;

  const sourceId = routine.activities[index].id;
  const targetId = routine.activities[targetIndex].id;

  const listEl = document.querySelector(".activity-list");
  const sourceNode = listEl?.querySelector(`.activity-item[data-activity-id="${sourceId}"]`);
  const targetNode = listEl?.querySelector(`.activity-item[data-activity-id="${targetId}"]`);

  if (!listEl || !sourceNode || !targetNode) {
    render();
    return;
  }

  isAnimatingActivitySwap = true;

  const sourceBefore = sourceNode.getBoundingClientRect();
  const targetBefore = targetNode.getBoundingClientRect();

  const [moved] = routine.activities.splice(index, 1);
  routine.activities.splice(targetIndex, 0, moved);
  saveRoutines();

  if (direction === -1) {
    listEl.insertBefore(sourceNode, targetNode);
  } else {
    listEl.insertBefore(sourceNode, targetNode.nextSibling);
  }

  requestAnimationFrame(() => {
    const travelPx = 4;
    const sourceShift = direction === -1 ? -travelPx : travelPx;
    const targetShift = direction === -1 ? travelPx : -travelPx;

    const finalizeSwap = () => {
      sourceNode.style.transition = "";
      targetNode.style.transition = "";
      sourceNode.style.transform = "";
      targetNode.style.transform = "";
      sourceNode.style.boxShadow = "";
      targetNode.style.boxShadow = "";
      isAnimatingActivitySwap = false;
    };

    sourceNode.style.transition = "none";
    targetNode.style.transition = "none";
    sourceNode.style.transform = `translateY(${sourceShift}px)`;
    targetNode.style.transform = `translateY(${targetShift}px)`;
    sourceNode.style.boxShadow = "0 4px 8px rgba(34, 77, 59, 0.02)";
    targetNode.style.boxShadow = "0 4px 8px rgba(34, 77, 59, 0.02)";

    requestAnimationFrame(() => {
      sourceNode.style.transition = "transform 180ms ease-out, box-shadow 180ms ease";
      targetNode.style.transition = "transform 180ms ease-out, box-shadow 180ms ease";
      sourceNode.style.transform = "translateY(0)";
      targetNode.style.transform = "translateY(0)";
      sourceNode.style.boxShadow = "0 2px 6px rgba(34, 77, 59, 0.01)";
      targetNode.style.boxShadow = "0 2px 6px rgba(34, 77, 59, 0.01)";
    });

    sourceNode.addEventListener("transitionend", finalizeSwap, { once: true });
    targetNode.addEventListener("transitionend", finalizeSwap, { once: true });
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

  state.routines.forEach((routine) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "routine-item";
    item.addEventListener("click", () => setView("routine", routine.id));

    const info = document.createElement("div");
    info.className = "routine-info";

    const name = document.createElement("div");
    name.className = "routine-name";
    name.textContent = routine.name;

    const meta = document.createElement("div");
    meta.className = "routine-meta";
    meta.textContent = `${routine.activities.length} activities • ${formatDurationLabel(getRoutineTotalDurationMs(routine))}`;

    const actions = document.createElement("div");
    actions.className = "item-actions";

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

    info.append(name, meta);
    actions.append(renameBtn, deleteBtn);
    item.append(info, actions);
    list.appendChild(item);
  });

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

  const metaButton = document.createElement("button");
  metaButton.type = "button";
  metaButton.className = "small-btn";
  metaButton.textContent = "⏱";
  metaButton.title = "Edit time estimate";
  metaButton.addEventListener("click", () => editRoutineTime(routine.id));

  header.append(title, metaButton);

  const infoRow = document.createElement("div");
  infoRow.className = "summary-row";
  infoRow.innerHTML = `<span>Estimated time</span><strong>${formatDurationLabel(getRoutineTotalDurationMs(routine))}</strong>`;

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

      const label = document.createElement("button");
      label.type = "button";
      label.className = "activity-name";
      label.textContent = activity.name;
      label.title = "Click to rename";
      label.addEventListener("click", () => renameActivity(routine.id, activity.id));

      main.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "drag-controls";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "small-btn";
      upBtn.textContent = "↑";
      upBtn.title = "Move up";
      upBtn.addEventListener("click", () => moveActivity(routine.id, activity.id, -1));

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "small-btn";
      downBtn.textContent = "↓";
      downBtn.title = "Move down";
      downBtn.addEventListener("click", () => moveActivity(routine.id, activity.id, 1));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "small-btn delete-btn";
      deleteBtn.textContent = "✕";
      deleteBtn.title = "Delete activity";
      deleteBtn.addEventListener("click", () => deleteActivity(routine.id, activity.id));

      controls.append(upBtn, downBtn, deleteBtn);
      item.append(main, controls);
      activityList.appendChild(item);
    });
  }

  const actionRow = document.createElement("div");
  actionRow.className = "timer-controls";

  const addActivityButton = document.createElement("button");
  addActivityButton.type = "button";
  addActivityButton.className = "primary-btn bottom-add-button";
  addActivityButton.textContent = "Add activity";
  addActivityButton.addEventListener("click", () => openAddActivityModal(routine.id));

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "primary-btn";
  startBtn.textContent = "Start Routine";
  startBtn.disabled = routine.activities.length === 0;
  startBtn.addEventListener("click", () => startRoutine(routine.id));

  actionRow.appendChild(startBtn);
  wrapper.append(header, infoRow, activityList, addActivityButton, actionRow);
  return wrapper;
}

function updateTimerDisplay() {
  const routine = getRoutineById(state.currentRoutineId);
  if (!routine || state.currentView !== "timer") return;

  const totalTimeEl = document.querySelector(".total-time");
  if (totalTimeEl) {
    totalTimeEl.textContent = formatDuration(getTotalElapsedMs());
  }

  const progressFill = document.querySelector(".routine-progress-fill");
  const progressLabel = document.querySelector(".routine-progress-label");
  if (progressFill && progressLabel) {
    const { percent, isOver } = getRoutineProgress(routine);
    progressFill.style.width = `${percent}%`;
    progressFill.classList.toggle("over", isOver);
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
    if (checkbox) {
      checkbox.checked = nextChecked;
    }
    if (timeEl) {
      timeEl.textContent = formatDuration(getActivityElapsedMs(activity));
    }
  }
}

function endRoutine() {
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
  const summary = routine.activities
    .map((activity) => `${activity.name}: ${formatDuration(Number(activity.timeSpentMs || 0))}`)
    .join("\n");

  // In per-session mode, reset times after showing the summary
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
  setView("home");

  window.alert(`Routine complete!\nTotal time: ${formatDuration(totalMs)}\n${summary}`);
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

  const timerCardChildren = [totalTimeEl];

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
  endBtn.addEventListener("click", endRoutine);

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
modalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    modalConfirm.click();
  }

  if (event.key === "Escape") {
    closeNameModal();
  }
});

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

cumulativeToggle.addEventListener("change", () => {
  settings.cumulativeMode = cumulativeToggle.checked;
  saveSettings();
});

function init() {
  loadRoutines();
  loadSettings();
  seedData();
  setView("home");
}

init();
