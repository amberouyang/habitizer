function appBuild() {
  return window.__HABITIZER_BUILD__ || "dev";
}

function isLanHttpHost() {
  const host = window.location.hostname;
  return (
    window.location.protocol === "http:" &&
    host !== "localhost" &&
    host !== "127.0.0.1"
  );
}

async function clearServiceWorkerCaches() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {}

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {}
}

/** Best-effort cache refresh. Must never reload or block startup. */
export async function prepareAppCache() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const build = appBuild();
    const seenBuild = localStorage.getItem("habitizer-build");

    // LAN IP testing: never use a service worker (stale modules break ES imports).
    if (isLanHttpHost()) {
      await clearServiceWorkerCaches();
      if (seenBuild !== build) {
        localStorage.setItem("habitizer-build", build);
      }
      return;
    }

    if (seenBuild !== build) {
      await clearServiceWorkerCaches();
      localStorage.setItem("habitizer-build", build);
    }
  } catch (error) {
    console.warn("Failed to refresh app cache:", error);
  }
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Skip SW on LAN and in local Cursor/dev previews — avoids reload/cache fights.
  if (isLanHttpHost()) return;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  });
}
