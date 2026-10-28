/**
 * The only module that talks to localStorage directly.
 * Every read/write goes through these wrappers so storage errors
 * (private mode, quota exceeded, disabled storage) never crash the app.
 */
import { unwrap, wrap, migrate } from "./migrations.js";

export function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Could not read ${key}:`, error);
    return null;
  }
}

export function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Could not save ${key}:`, error);
    return false;
  }
}

export function removeRaw(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Could not remove ${key}:`, error);
  }
}

/** Save `data` for a store as { version, data }. */
export function saveVersioned(key, schema, data) {
  return writeRaw(key, JSON.stringify(wrap(schema, data)));
}

/**
 * Load a store and upgrade it to the schema's current version.
 * Returns `fallback()` when nothing is saved yet, or when the saved data is
 * corrupted (bad JSON, failed migration, wrong shape). Corrupted text is
 * first copied to `<key>_corrupt_<timestamp>` so it can be recovered by hand.
 * Before upgrading older data, the original text is copied once to
 * `<key>_backup_v<oldVersion>` so a buggy migration can't lose it.
 */
export function loadVersioned(key, schema, fallback) {
  const raw = readRaw(key);
  if (raw === null) return fallback();

  try {
    const { version, data } = unwrap(JSON.parse(raw));

    if (version > schema.version) {
      // Saved by a newer build (e.g. an old cached tab). Use it as-is rather
      // than guessing how to downgrade it.
      console.warn(`${key} is v${version}, newer than this build (v${schema.version}).`);
      if (!schema.isValid(data)) throw new Error("Unexpected data shape");
      return data;
    }

    const upgraded = version < schema.version ? migrate(schema, data, version) : data;
    if (!schema.isValid(upgraded)) throw new Error("Unexpected data shape");

    if (version < schema.version) {
      const backupKey = `${key}_backup_v${version}`;
      if (readRaw(backupKey) === null) writeRaw(backupKey, raw);
      saveVersioned(key, schema, upgraded);
    }
    return upgraded;
  } catch (error) {
    console.warn(`${key} is corrupted; starting with defaults.`, error);
    quarantineCorrupt(key, raw);
    return fallback();
  }
}

/** Keep unreadable data under a separate key, then clear the original. */
function quarantineCorrupt(key, raw) {
  const backupKey = `${key}_corrupt_${Date.now()}`;
  // Only clear the original if the copy really landed (storage may be full).
  if (writeRaw(backupKey, raw) && readRaw(backupKey) === raw) {
    removeRaw(key);
  }
}

/**
 * Move values saved under old key names to their new names.
 * The old key is only removed once the new key is confirmed to hold a value,
 * so a failed write (e.g. storage full) leaves the original data untouched.
 * If both exist, the new key wins: it is the one the app has been writing.
 */
export function migrateLegacyKeys(renames) {
  Object.entries(renames).forEach(([oldKey, newKey]) => {
    const oldValue = readRaw(oldKey);
    if (oldValue === null) return;

    if (readRaw(newKey) === null) {
      writeRaw(newKey, oldValue);
    }
    if (readRaw(newKey) !== null) {
      removeRaw(oldKey);
    }
  });
}
