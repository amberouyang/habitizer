import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom gives tests a real localStorage and document like the browser.
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
  },
});
