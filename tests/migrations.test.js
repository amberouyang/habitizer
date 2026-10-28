import { describe, it, expect } from "vitest";
import { SCHEMAS, unwrap, wrap, migrate } from "../js/migrations.js";

describe("unwrap", () => {
  it("treats data saved before versioning as v1", () => {
    expect(unwrap([{ id: "a" }])).toEqual({ version: 1, data: [{ id: "a" }] });
    expect(unwrap({ darkMode: true })).toEqual({ version: 1, data: { darkMode: true } });
  });

  it("reads the version from wrapped data", () => {
    expect(unwrap({ version: 2, data: [] })).toEqual({ version: 2, data: [] });
  });

  it("round-trips with wrap", () => {
    const saved = wrap(SCHEMAS.routines, [{ id: "a" }]);
    expect(saved.version).toBe(SCHEMAS.routines.version);
    expect(unwrap(saved).data).toEqual([{ id: "a" }]);
  });
});

describe("routines v1 -> v2", () => {
  it("fills missing fields with defaults and keeps everything else", () => {
    const v1 = [
      { id: "r1", name: "Evening", color: "sage", activities: [{ id: "a1", name: "Read" }], customField: 7 },
    ];

    const [routine] = migrate(SCHEMAS.routines, v1, 1);

    expect(routine).toEqual({
      id: "r1",
      name: "Evening",
      color: "sage",
      activities: [{ id: "a1", name: "Read" }],
      customField: 7,
      completionDates: [],
      runHistory: [],
      spacedRepetition: false,
      srsLevel: 0,
      nextDueDate: null,
    });
  });

  it("never overwrites fields that already have values", () => {
    const v1 = [{ id: "r1", name: "Morning", spacedRepetition: true, srsLevel: 3, nextDueDate: "2026-11-01" }];
    const [routine] = migrate(SCHEMAS.routines, v1, 1);
    expect(routine.spacedRepetition).toBe(true);
    expect(routine.srsLevel).toBe(3);
    expect(routine.nextDueDate).toBe("2026-11-01");
  });

  it("drops entries that aren't routine objects", () => {
    const result = migrate(SCHEMAS.routines, [null, "junk", 4, { id: "r1", name: "Ok" }], 1);
    expect(result.map((routine) => routine.id)).toEqual(["r1"]);
  });
});

describe("migrate", () => {
  it("runs every step in order", () => {
    const schema = {
      version: 4,
      migrations: {
        1: (data) => ({ ...data, steps: [...data.steps, 1] }),
        2: (data) => ({ ...data, steps: [...data.steps, 2] }),
        3: (data) => ({ ...data, steps: [...data.steps, 3] }),
      },
    };
    expect(migrate(schema, { steps: [] }, 1).steps).toEqual([1, 2, 3]);
    expect(migrate(schema, { steps: [] }, 3).steps).toEqual([3]);
  });

  it("fails loudly when a step is missing", () => {
    const schema = { version: 3, migrations: { 1: (data) => data } };
    expect(() => migrate(schema, {}, 1)).toThrow("Missing migration from v2 to v3");
  });

  it("has a migration for every older version of every store", () => {
    Object.entries(SCHEMAS).forEach(([, schema]) => {
      for (let version = 1; version < schema.version; version += 1) {
        expect(typeof schema.migrations[version]).toBe("function");
      }
    });
  });
});
