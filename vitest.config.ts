import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // Ver comentário em vitest.server-only-mock.ts.
      "server-only": path.resolve(__dirname, "vitest.server-only-mock.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    css: true,
    // e2e/ is Playwright's territory, never Vitest's.
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Coverage é significativa para lógica de negócio, não para
      // primitivas de UI geradas ou arquivos de config.
      include: ["src/modules/**/*.{ts,tsx}", "src/core/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/__tests__/**",
        "src/components/ui/**",
        "src/db/migrations/**",
      ],
    },
  },
});
