import { settings, state } from "./state.js";
import { getLocalDateKey } from "./utils.js";
import { getDueStatus } from "./schedule.js";
import { t } from "./i18n.js";

const NOTIFIED_KEY = "habitizer-due-notified-v1";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function loadNotifiedMap() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveNotifiedMap(map) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("Could not save reminder state:", error);
  }
}

function getNotifiedIdsForToday() {
  const today = getLocalDateKey();
  const map = loadNotifiedMap();
  const ids = map[today];
  return {
    today,
    map,
    ids: Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [],
  };
}

function markNotified(routineIds) {
  if (!routineIds.length) return;
  const { today, map, ids } = getNotifiedIdsForToday();
  const merged = [...new Set([...ids, ...routineIds])];
  // Keep only today + yesterday to avoid unbounded growth.
  const pruned = { [today]: merged };
  const keys = Object.keys(map).sort();
  if (keys.length) {
    const previous = keys.filter((key) => key !== today).at(-1);
    if (previous && Array.isArray(map[previous])) {
      pruned[previous] = map[previous];
    }
  }
  saveNotifiedMap(pruned);
}

export function getUrgentDueRoutines(routines = state.routines) {
  return (routines || []).filter((routine) => {
    const kind = getDueStatus(routine).kind;
    return kind === "due" || kind === "overdue";
  });
}

function buildNotificationCopy(routines) {
  if (routines.length === 1) {
    const routine = routines[0];
    const kind = getDueStatus(routine).kind;
    if (kind === "overdue") {
      return {
        title: t("reminders.overdueTitle", { name: routine.name }),
        body: t("reminders.overdueBody"),
      };
    }
    return {
      title: t("reminders.dueTitle", { name: routine.name }),
      body: t("reminders.dueBody"),
    };
  }

  const overdueCount = routines.filter((routine) => getDueStatus(routine).kind === "overdue").length;
  const names = routines
    .slice(0, 3)
    .map((routine) => routine.name)
    .join(", ");
  const extra = routines.length > 3 ? t("reminders.andMore", { count: routines.length - 3 }) : "";

  return {
    title: overdueCount > 0
      ? t("reminders.multiOverdueTitle", { count: routines.length })
      : t("reminders.multiDueTitle", { count: routines.length }),
    body: `${names}${extra ? ` ${extra}` : ""}`,
  };
}

function showDueNotification(routines) {
  if (!notificationsSupported() || Notification.permission !== "granted") {
    return false;
  }
  if (!routines.length) return false;

  const { title, body } = buildNotificationCopy(routines);
  const today = getLocalDateKey();

  try {
    const notification = new Notification(title, {
      body,
      tag: `habitizer-due-${today}`,
      renotify: true,
      silent: false,
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {}
      notification.close();
    };
    return true;
  } catch (error) {
    console.warn("Due reminder failed:", error);
    return false;
  }
}

/**
 * Notify for due/overdue spaced-practice routines not yet nudged today.
 * Safe to call often; no-ops when disabled, unsupported, or denied.
 */
export function checkAndNotifyDueRoutines() {
  if (!settings.dueReminders) return { notified: false, count: 0 };
  if (!notificationsSupported() || Notification.permission !== "granted") {
    return { notified: false, count: 0 };
  }

  const urgent = getUrgentDueRoutines();
  if (!urgent.length) return { notified: false, count: 0 };

  const { ids: already } = getNotifiedIdsForToday();
  const pending = urgent.filter((routine) => !already.includes(routine.id));
  if (!pending.length) return { notified: false, count: 0 };

  const shown = showDueNotification(pending);
  if (shown) {
    markNotified(pending.map((routine) => routine.id));
  }
  return { notified: shown, count: pending.length };
}

export async function enableDueReminders() {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return permission;
  }
  settings.dueReminders = true;
  checkAndNotifyDueRoutines();
  return "granted";
}

export function disableDueReminders() {
  settings.dueReminders = false;
}

export function wireDueReminders() {
  const run = () => {
    try {
      checkAndNotifyDueRoutines();
    } catch (error) {
      console.warn("Due reminder check failed:", error);
    }
  };

  // After boot settles, then whenever the app is shown again.
  window.setTimeout(run, 800);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") run();
  });
  window.addEventListener("focus", run);
}
