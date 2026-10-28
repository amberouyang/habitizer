import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadVersioned, saveVersioned, migrateLegacyKeys, writeRaw, readRaw } from "../js/storage.js";

const schema = {
  version: 2,
  isValid: Array.isArray,
  migrations: { 1: (items) => items.map((item) => ({ ...item, added: true })) },
};

const corruptKeys = (key) => Object.keys(localStorage).filter((k) => k.startsWith(`${key}_corrupt_`));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadVersioned", () => {
  it("returns the fallback when nothing is saved", () => {
    expect(loadVersioned("habitizer_test", schema, () => ["default"])).toEqual(["default"]);
  });

  it("upgrades v1 data, saves it as the current version, and keeps the original", () => {
    localStorage.setItem("habitizer_test", JSON.stringify([{ id: "a" }]));

    const data = loadVersioned("habitizer_test", schema, () => []);

    expect(data).toEqual([{ id: "a", added: true }]);
    expect(JSON.parse(localStorage.getItem("habitizer_test"))).toEqual({
      version: 2,
      data: [{ id: "a", added: true }],
    });
    expect(localStorage.getItem("habitizer_test_backup_v1")).toBe('[{"id":"a"}]');
  });

  it("leaves current-version data alone", () => {
    saveVersioned("habitizer_test", schema, [{ id: "a" }]);
    const before = localStorage.getItem("habitizer_test");

    expect(loadVersioned("habitizer_test", schema, () => [])).toEqual([{ id: "a" }]);
    expect(localStorage.getItem("habitizer_test")).toBe(before);
    expect(localStorage.getItem("habitizer_test_backup_v1")).toBeNull();
  });

  it("uses data from a newer build as-is", () => {
    localStorage.setItem("habitizer_test", JSON.stringify({ version: 9, data: [{ id: "future" }] }));
    expect(loadVersioned("habitizer_test", schema, () => [])).toEqual([{ id: "future" }]);
  });

  it.each([
    ["invalid JSON", "[{\"id\":"],
    ["the wrong shape", "{\"not\":\"a list\"}"],
    ["wrapped data with the wrong shape", "{\"version\":2,\"data\":\"oops\"}"],
    ["data a migration can't handle", "\"just a string\""],
  ])("backs up %s and returns the fallback", (_label, raw) => {
    localStorage.setItem("habitizer_test", raw);

    const data = loadVersioned("habitizer_test", schema, () => ["default"]);

    expect(data).toEqual(["default"]);
    const backups = corruptKeys("habitizer_test");
    expect(backups).toHaveLength(1);
    expect(localStorage.getItem(backups[0])).toBe(raw);
    expect(localStorage.getItem("habitizer_test")).toBeNull();
  });

  it("keeps the corrupted original if the backup can't be written", () => {
    localStorage.setItem("habitizer_test", "not json");
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function setItem(key, value) {
      if (key.includes("_corrupt_")) throw new Error("QuotaExceededError");
      return realSetItem.call(this, key, value);
    });

    expect(loadVersioned("habitizer_test", schema, () => [])).toEqual([]);
    expect(localStorage.getItem("habitizer_test")).toBe("not json");
  });
});

describe("migrateLegacyKeys", () => {
  it("moves old keys to new names without changing the value", () => {
    localStorage.setItem("old-key", "[1,2,3]");
    migrateLegacyKeys({ "old-key": "habitizer_new" });
    expect(localStorage.getItem("habitizer_new")).toBe("[1,2,3]");
    expect(localStorage.getItem("old-key")).toBeNull();
  });

  it("keeps the new key when both exist", () => {
    localStorage.setItem("old-key", "old");
    localStorage.setItem("habitizer_new", "new");
    migrateLegacyKeys({ "old-key": "habitizer_new" });
    expect(localStorage.getItem("habitizer_new")).toBe("new");
    expect(localStorage.getItem("old-key")).toBeNull();
  });

  it("keeps the old key if the new one can't be written", () => {
    localStorage.setItem("old-key", "precious");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    migrateLegacyKeys({ "old-key": "habitizer_new" });
    expect(localStorage.getItem("old-key")).toBe("precious");
  });
});

describe("raw wrappers", () => {
  it("don't throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readRaw("habitizer_x")).toBeNull();
    expect(writeRaw("habitizer_x", "1")).toBe(false);
  });
});
