export const STORAGE_KEY = "habitizer-routines-v1";
export const SETTINGS_KEY = "habitizer-settings-v1";
export const DELETED_ROUTINES_KEY = "habitizer-deleted-routines-v1";
export const TIMER_SESSION_KEY = "habitizer-timer-v1";
export const DELETED_ROUTINE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const TIMER_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const UNDO_DELETE_MS = 5000;

export const ROUTINE_COLORS = [
  { id: "sage", label: "Sage", value: "#0e7490" },
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
