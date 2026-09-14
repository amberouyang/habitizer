import { loadRoutines, loadDeletedRoutines, loadSettings, seedData } from "./persistence.js";
import { setView } from "./views.js";
import { wireEvents } from "./events.js";
import { restoreTimerSession } from "./timer.js";
import { prepareAppCache, registerServiceWorker } from "./pwa.js";
import { appEl } from "./dom.js";

function showBootError(error) {
  console.error("Habitizer failed to start:", error);
  if (!appEl) return;

  appEl.hidden = false;
  appEl.classList.remove("hidden");

  const empty = document.createElement("div");
  empty.className = "empty-state home-empty-state";

  const title = document.createElement("p");
  title.className = "empty-state-title";
  title.textContent = "Couldn’t load Habitizer";

  const hint = document.createElement("p");
  hint.className = "empty-state-hint";
  hint.textContent =
    "Refresh the page. If it still fails, open this URL in Safari (not the home-screen icon).";

  const detail = document.createElement("p");
  detail.className = "empty-state-hint";
  detail.style.marginTop = "10px";
  detail.style.wordBreak = "break-word";
  detail.style.opacity = "0.85";
  detail.textContent = error?.message || String(error || "Unknown error");

  empty.append(title, hint, detail);
  appEl.replaceChildren(empty);
}

export function init() {
  try {
    loadRoutines();
    loadDeletedRoutines();
    loadSettings();
    seedData();
    wireEvents();
    registerServiceWorker();

    if (!restoreTimerSession()) {
      setView("home");
    }
  } catch (error) {
    showBootError(error);
  }
}

// Never block first paint on cache cleanup.
init();
prepareAppCache().catch((error) => {
  console.warn("Cache prepare failed:", error);
});
