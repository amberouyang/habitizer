/**
 * The only module that talks to localStorage directly.
 * Every read/write goes through these wrappers so storage errors
 * (private mode, quota exceeded, disabled storage) never crash the app.
 */

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
