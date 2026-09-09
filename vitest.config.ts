import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{js,jsx,ts,tsx}", "src/**/*.test.{js,jsx,ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "tests/model-inputs/**", "tests/operations/**"],
  },
});
