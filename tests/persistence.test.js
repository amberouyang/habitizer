import { describe, it, expect, beforeEach, vi } from "vitest";
import v1Storage from "./fixtures/v1-storage.json";

/** Write fixture data the way old builds did: plain JSON, flags as bare strings. */
function seed(entries) {
  Object.entries(entries).forEach(([key, value]) => {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  });
}

/** Fresh copies of the app modules, so each test starts from default state. */
async function loadApp() {
  vi.resetModules();
  const { migrateLegacyKeys } = await import("../js/storage.js");
  const { LEGACY_KEY_RENAMES } = await import("../js/constants.js");
  const persistence = await import("../js/persistence.js");
  const appState = await import("../js/state.js");

  // Same order as init() in js/main.js.
  migrateLegacyKeys(LEGACY_KEY_RENAMES);
  persistence.loadRoutines();
  persistence.loadDeletedRoutines();
  persistence.loadSettings();
  persistence.seedData();
  persistence.clearLegacyDemoRoutines();

  return { ...appState, ...persistence };
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("loading v1 data saved by older builds", () => {
  it("keeps every routine, with history and spaced practice intact", async () => {
    seed(v1Storage);
    const { state } = await loadApp();

    expect(state.routines.map((routine) => routine.name)).toEqual(["Morning", "Evening"]);

    const morning = state.routines[0];
    expect(morning.activities).toHaveLength(2);
    expect(morning.completionDates).toEqual(["2026-09-12", "2026-09-13"]);
    expect(morning.runHistory[0].totalMs).toBe(7744);
    expect(morning.spacedRepetition).toBe(true);
    expect(morning.srsLevel).toBe(2);
    expect(morning.srsIntervalDays).toBe(4);
  });

  it("adds defaults for fields the old routine didn't have", async () => {
    seed(v1Storage);
    const { state } = await loadApp();

    const evening = state.routines[1];
    expect(evening.completionDates).toEqual([]);
    expect(evening.runHistory).toEqual([]);
    expect(evening.spacedRepetition).toBe(false);
    expect(evening.srsLevel).toBe(0);
    expect(evening.nextDueDate).toBeNull();
  });

  it("keeps settings and deleted routines", async () => {
    seed(v1Storage);
    const { settings, deletedRoutines } = await loadApp();

    expect(settings.darkMode).toBe(true);
    expect(settings.cumulativeMode).toBe(false);
    expect(settings.language).toBe("es");
    expect(settings.savedColors).toEqual(["#ff7094"]);
    expect(settings.homeWidgets).toEqual(["routines", "weekly"]);
    expect(deletedRoutines.map((entry) => entry.routine.name)).toEqual(["Workout"]);
  });

  it("moves data to habitizer_ keys in the versioned format", async () => {
    seed(v1Storage);
    await loadApp();

    const keys = Object.keys(localStorage);
    expect(keys.every((key) => key.startsWith("habitizer_"))).toBe(true);
    expect(JSON.parse(localStorage.getItem("habitizer_routines")).version).toBe(2);
    expect(JSON.parse(localStorage.getItem("habitizer_settings")).version).toBe(2);
    expect(localStorage.getItem("habitizer_demo_cleared")).toBe("1");
    expect(localStorage.getItem("habitizer-routines-v1")).toBeNull();
  });

  it("keeps the untouched v1 text as a backup", async () => {
    seed(v1Storage);
    await loadApp();

    expect(localStorage.getItem("habitizer_routines_backup_v1"))
      .toBe(JSON.stringify(v1Storage["habitizer-routines-v1"]));
  });

  it("loads the same data again on the next launch", async () => {
    seed(v1Storage);
    const first = await loadApp();
    const firstRoutines = JSON.parse(JSON.stringify(first.state.routines));

    const second = await loadApp();
    expect(second.state.routines).toEqual(firstRoutines);
  });

  it("round-trips through save and load", async () => {
    seed(v1Storage);
    const app = await loadApp();
    app.state.routines[0].name = "Morning (edited)";
    app.saveRoutines();

    const reloaded = await loadApp();
    expect(reloaded.state.routines[0].name).toBe("Morning (edited)");
  });
});

describe("corrupted data", () => {
  it("doesn't crash and starts with defaults", async () => {
    seed({
      habitizer_routines: "[{\"id\":\"r1\",\"name\":\"Morn",
      habitizer_settings: "[1,2,3]",
      habitizer_deleted_routines: "{\"version\":2,\"data\":\"oops\"}",
      habitizer_timer_session: "not json",
      habitizer_due_notified: "{{{",
    });

    const app = await loadApp();

    expect(app.state.routines).toEqual([]);
    expect(app.deletedRoutines).toEqual([]);
    expect(app.settings.darkMode).toBe(false);
    expect(app.settings.cumulativeMode).toBe(true);
    expect(() => app.loadTimerSession()).not.toThrow();
  });

  it("backs up the corrupted text under a separate key", async () => {
    const broken = "[{\"id\":\"r1\",\"name\":\"Morn";
    seed({ habitizer_routines: broken });

    await loadApp();

    const backupKey = Object.keys(localStorage).find((key) => key.startsWith("habitizer_routines_corrupt_"));
    expect(backupKey).toBeDefined();
    expect(localStorage.getItem(backupKey)).toBe(broken);
  });

  it("keeps good stores when only one is corrupted", async () => {
    seed({
      ...v1Storage,
      "habitizer-settings-v1": "{ not json",
    });

    const { state, settings } = await loadApp();

    expect(state.routines.map((routine) => routine.name)).toEqual(["Morning", "Evening"]);
    expect(settings.darkMode).toBe(false);
  });
});
