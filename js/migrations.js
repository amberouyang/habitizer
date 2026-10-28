/**
 * Versioned save format and step-by-step upgrades for saved data.
 *
 * Every store is saved as { version: N, data: ... }. Data written before
 * versioning existed (a bare array/object) is treated as version 1.
 *
 * HOW TO ADD A NEW VERSION (e.g. routines v2 -> v3):
 *   1. Bump `version` in that store's schema below (2 -> 3).
 *   2. Add `2: (data) => upgradedData` to its `migrations`. Key N upgrades N to N+1.
 *      Migrations run in order, so v1 data goes 1 -> 2 -> 3 automatically.
 *   3. Never delete or rename a saved field without migrating it. Prefer adding
 *      new fields with defaults, and only fill them when they are missing.
 *   4. Add a test in tests/ with sample data from the old version.
 *   Never edit an existing migration after it has shipped: users may already
 *   have data that went through it.
 */

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Routines v1 -> v2: drop unusable entries and fill fields older builds didn't save. */
function fillRoutineDefaults(routine) {
  return {
    ...routine,
    activities: Array.isArray(routine.activities) ? routine.activities : [],
    completionDates: Array.isArray(routine.completionDates) ? routine.completionDates : [],
    runHistory: Array.isArray(routine.runHistory) ? routine.runHistory : [],
    spacedRepetition: routine.spacedRepetition ?? false,
    srsLevel: routine.srsLevel ?? 0,
    nextDueDate: routine.nextDueDate ?? null,
  };
}

export const SCHEMAS = {
  routines: {
    version: 2,
    migrations: {
      1: (routines) => routines.filter(isPlainObject).map(fillRoutineDefaults),
    },
  },
  deletedRoutines: {
    version: 2,
    migrations: {
      1: (entries) => entries
        .filter((entry) => isPlainObject(entry) && isPlainObject(entry.routine))
        .map((entry) => ({ ...entry, routine: fillRoutineDefaults(entry.routine) })),
    },
  },
  settings: {
    version: 2,
    migrations: {
      // v2 only introduced the { version, data } wrapper; loadSettings fills defaults.
      1: (settings) => settings,
    },
  },
  timerSession: { version: 1, migrations: {} },
  dueNotified: { version: 1, migrations: {} },
};

/** Split a parsed stored value into its version and data. */
export function unwrap(parsed) {
  if (isPlainObject(parsed) && Number.isInteger(parsed.version) && "data" in parsed) {
    return { version: parsed.version, data: parsed.data };
  }
  return { version: 1, data: parsed };
}

export function wrap(schema, data) {
  return { version: schema.version, data };
}

/** Run each migration from `fromVersion` up to the schema's current version. */
export function migrate(schema, data, fromVersion) {
  let current = data;
  for (let version = fromVersion; version < schema.version; version += 1) {
    const step = schema.migrations[version];
    if (!step) {
      throw new Error(`Missing migration from v${version} to v${version + 1}`);
    }
    current = step(current);
  }
  return current;
}
