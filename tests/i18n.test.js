import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { t } from "../js/i18n.js";

const read = (path) => readFileSync(path, "utf8");

const i18nSource = read("js/i18n.js");
const [dictionaries, i18nCode] = i18nSource.split("export function sanitizeLanguage");
const namespaces = new Set([...dictionaries.matchAll(/^\s*"(\w+)\.\w+":/gm)].map((m) => m[1]));

// Every "namespace.name" string in the app code, e.g. t("home.title") or data-i18n="app.done".
function findUsedKeys() {
  const sources = readdirSync("js")
    .filter((file) => file.endsWith(".js") && file !== "i18n.js")
    .map((file) => read(`js/${file}`));
  sources.push(i18nCode, read("index.html"));

  const keys = new Set();
  sources.forEach((source) => {
    for (const [, key, namespace] of source.matchAll(/"((\w+)\.\w+)"/g)) {
      if (namespaces.has(namespace)) keys.add(key);
    }
  });
  return [...keys].sort();
}

describe("translations", () => {
  const usedKeys = findUsedKeys();

  it("finds the phrases the app uses", () => {
    expect(usedKeys.length).toBeGreaterThan(100);
    expect(usedKeys).toContain("home.widgetWeekly");
  });

  // Other languages fall back to English, so English must have every phrase.
  it("has English text for every phrase the app uses", () => {
    const missing = usedKeys.filter((key) => t(key) === key);
    expect(missing).toEqual([]);
  });
});
