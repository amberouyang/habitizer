const APP_BUILD = "2026-09-14-uuidfix2";

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

/** Best-effort cache refresh. Must never block app startup. */
export async function prepareAppCache() {
  if (!("serviceWorker" in navigator)) return;

  try {
    // Always skip SW on LAN IPs. Also force one reload when build changes
    // so stale precached modules (like old utils.js) cannot break imports.
    const seenBuild = localStorage.getItem("habitizer-build");
    const needsRefresh = seenBuild !== APP_BUILD;

    if (isLanHttpHost() || needsRefresh) {
      await clearServiceWorkerCaches();
    }

    if (needsRefresh) {
      localStorage.setItem("habitizer-build", APP_BUILD);
      const url = new URL(window.location.href);
      if (url.searchParams.get("built") !== APP_BUILD) {
        url.searchParams.set("built", APP_BUILD);
        window.location.replace(url.toString());
        return;
      }
    }

    if (isLanHttpHost()) return;
  } catch (error) {
    console.warn("Failed to refresh app cache:", error);
  }
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (isLanHttpHost()) return;

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
