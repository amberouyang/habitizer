// localStorage keys. All start with "habitizer_" so they can't clash with other
// apps on the same origin (e.g. other projects on username.github.io).
// SETTINGS_KEY and BUILD_KEY are also read by the inline scripts in index.html.
export const STORAGE_KEY = "habitizer_routines";
export const SETTINGS_KEY = "habitizer_settings";
export const DELETED_ROUTINES_KEY = "habitizer_deleted_routines";
export const TIMER_SESSION_KEY = "habitizer_timer_session";
export const DEMO_CLEAR_KEY = "habitizer_demo_cleared";
export const DUE_NOTIFIED_KEY = "habitizer_due_notified";
export const BUILD_KEY = "habitizer_build";

/** Old key name -> new key name. Moved once on startup by migrateLegacyKeys(). */
export const LEGACY_KEY_RENAMES = {
  "habitizer-routines-v1": STORAGE_KEY,
  "habitizer-settings-v1": SETTINGS_KEY,
  "habitizer-deleted-routines-v1": DELETED_ROUTINES_KEY,
  "habitizer-timer-v1": TIMER_SESSION_KEY,
  "habitizer-cleared-demo-routines-v1": DEMO_CLEAR_KEY,
  "habitizer-due-notified-v1": DUE_NOTIFIED_KEY,
  "habitizer-build": BUILD_KEY,
};
export const DELETED_ROUTINE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Nudge to export again if no backup in this many days. */
export const BACKUP_REMINDER_DAYS = 14;
export const TIMER_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const UNDO_DELETE_MS = 5000;

/** Days until the next practice after each successful spaced-repetition level. */
export const SRS_INTERVAL_DAYS = [1, 2, 4, 7, 14, 30];

export const ROUTINE_COLORS = [
  { id: "sage", label: "Cyan", value: "#0e7490" },
  { id: "ocean", label: "Ocean", value: "#2563eb" },
  { id: "lavender", label: "Lavender", value: "#6366f1" },
  { id: "coral", label: "Coral", value: "#e11d48" },
  { id: "amber", label: "Amber", value: "#d97706" },
  { id: "rose", label: "Rose", value: "#db2777" },
  { id: "slate", label: "Slate", value: "#475569" },
  { id: "teal", label: "Teal", value: "#0f766e" },
];

export const DEFAULT_ROUTINE_COLOR_ID = ROUTINE_COLORS[0].id;
export const DEFAULT_CUSTOM_COLOR = "#5b7cfa";
export const STREAK_DISPLAY_MIN = 2;
export const RUN_HISTORY_LIMIT = 50;
export const SAVED_COLORS_LIMIT = 12;

export const HOME_WIDGET_IDS = ["weekly", "routines"];
export const DEFAULT_HOME_WIDGETS = [...HOME_WIDGET_IDS];
