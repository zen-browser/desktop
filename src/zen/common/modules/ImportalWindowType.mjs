// Importal: window typing for Week 1
// Minimal, reversible, per-window state. Avoids engine/ changes.

export const WINDOW_TYPES = Object.freeze({
  MAIN: "MAIN",
  TASKSPACE: "TASKSPACE",
  AUX: "AUX",
});

const KEY = "__importalWindowType";

export function getWindowType(win = window) {
  return win?.[KEY] || null;
}

export function setWindowType(type, win = window) {
  if (!Object.values(WINDOW_TYPES).includes(type)) {
    throw new Error(`Invalid window type: ${type}`);
  }
  win[KEY] = type;
  return type;
}

// Week 1 heuristic: first browsing window becomes MAIN.
// Later we will replace this with explicit creation paths.
let hasAssignedMainThisSession = false;

export function ensureWindowType(win = window) {
  if (getWindowType(win)) return getWindowType(win);

  if (!hasAssignedMainThisSession) {
    hasAssignedMainThisSession = true;
    return setWindowType(WINDOW_TYPES.MAIN, win);
  }

  // Default for now: subsequent windows are TASKSPACE (temporary).
  return setWindowType(WINDOW_TYPES.TASKSPACE, win);
}
