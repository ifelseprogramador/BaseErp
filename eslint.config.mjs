import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  {
    rules: {
      // Use core/logger.ts em vez de console.* direto — ver
      // docs/arquitetura.md ("Observabilidade"). console.error/warn ainda
      // são permitidos como último recurso dentro do próprio logger (ver
      // override abaixo).
      "no-console": "error",
    },
  },
  {
    // Scripts de CLI (rodam fora do ciclo de request, sem acesso ao
    // contexto do logger) e arquivos de config podem usar console.* direto.
    files: [
      "src/core/logger.ts",
      "**/*.config.{ts,js,mjs}",
      "scripts/**",
      "src/db/migrate.ts",
      "src/db/seed.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/components/ui/**", // shadcn/ui generated components
    "src/db/migrations/**", // drizzle-kit generated SQL/meta
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
