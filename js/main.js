import { loadRoutines, loadDeletedRoutines, loadSettings, seedData } from "./persistence.js";
import { setView } from "./views.js";
import { wireEvents } from "./events.js";

export function init() {
  loadRoutines();
  loadDeletedRoutines();
  loadSettings();
  seedData();
  wireEvents();
  setView("home");
}

init();
