import { describe, it, expect } from "vitest";
import { createSampleRoutines } from "../js/samples.js";
import { getLocalDateKey } from "../js/utils.js";
import { SCHEMAS } from "../js/migrations.js";

const now = new Date(2026, 9, 27, 18, 0);
const today = getLocalDateKey(now.getTime());

describe("sample routines", () => {
  const routines = createSampleRoutines(now);

  it("creates a few routines with activities and history", () => {
    expect(routines.length).toBeGreaterThanOrEqual(3);
    routines.forEach((routine) => {
      expect(routine.activities.length).toBeGreaterThan(0);
      expect(routine.runHistory.length).toBeGreaterThan(0);
    });
  });

  it("stores history the same way real runs do", () => {
    routines.forEach((routine) => {
      const times = routine.runHistory.map((run) => run.completedAt);
      expect(times).toEqual([...times].sort((a, b) => b - a));
      expect(routine.completionDates).toEqual([...routine.completionDates].sort());
      routine.runHistory.forEach((run) => {
        expect(run.completedAt).toBeLessThanOrEqual(now.getTime());
        expect(run.dateKey <= today).toBe(true);
      });
    });
  });

  it("includes something done today and a spaced-practice routine that's due", () => {
    expect(routines.some((routine) => routine.completionDates.includes(today))).toBe(true);
    const spaced = routines.find((routine) => routine.spacedRepetition);
    expect(spaced.nextDueDate).toBe(today);
  });

  it("is valid current-version routine data", () => {
    expect(SCHEMAS.routines.isValid(routines)).toBe(true);
    expect(new Set(routines.map((routine) => routine.id)).size).toBe(routines.length);
  });
});
