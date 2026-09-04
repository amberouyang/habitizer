export const STORAGE_KEY = "habitizer-routines-v1";
export const SETTINGS_KEY = "habitizer-settings-v1";
export const DELETED_ROUTINES_KEY = "habitizer-deleted-routines-v1";
export const DELETED_ROUTINE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const UNDO_DELETE_MS = 5000;

export const ROUTINE_COLORS = [
  { id: "sage", label: "Sage", value: "#2f6f52" },
  { id: "ocean", label: "Ocean", value: "#2f5f8f" },
  { id: "lavender", label: "Lavender", value: "#6b5b95" },
  { id: "coral", label: "Coral", value: "#c96b5a" },
  { id: "amber", label: "Amber", value: "#c9893f" },
  { id: "rose", label: "Rose", value: "#b85c7a" },
  { id: "slate", label: "Slate", value: "#5a6b7a" },
  { id: "teal", label: "Teal", value: "#2a7a72" },
];

export const DEFAULT_ROUTINE_COLOR_ID = ROUTINE_COLORS[0].id;
export const DEFAULT_CUSTOM_COLOR = "#5b7cfa";
export const STREAK_DISPLAY_MIN = 2;
