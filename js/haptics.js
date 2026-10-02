import { settings } from "./state.js";

/** True when the Vibration API is available (common on Android Chrome; rare on iOS). */
export function hapticsSupported() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Soft device vibration when supported. No-ops on desktop/iOS Safari.
 * @param {"step"|"complete"} kind
 * @param {{ force?: boolean }} [options]
 */
export function triggerHaptic(kind = "step", { force = false } = {}) {
  if (!force && !settings.haptics) return;
  if (!hapticsSupported()) return;

  try {
    const pattern = kind === "complete" ? [18, 36, 22] : 12;
    navigator.vibrate(pattern);
  } catch {
    // Ignore Vibration API failures.
  }
}
