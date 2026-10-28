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
