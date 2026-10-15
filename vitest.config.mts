import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: [
        "lib/time.ts",
        "lib/schedule.ts",
        "lib/schemas/**",
        "lib/phone.ts",
        "lib/money.ts",
        "lib/app-env.ts",
      ],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
