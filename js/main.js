import { loadRoutines, loadDeletedRoutines, loadSettings, seedData } from "./persistence.js";
import { setView } from "./views.js";
import { wireEvents } from "./events.js";
import { restoreTimerSession } from "./timer.js";
import { registerServiceWorker } from "./pwa.js";

export function init() {
  loadRoutines();
  loadDeletedRoutines();
  loadSettings();
  seedData();
  wireEvents();
  registerServiceWorker();

  if (!restoreTimerSession()) {
    setView("home");
  }
}

init();
