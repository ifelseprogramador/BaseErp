import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Route Handlers e Server Actions não passam pelo layout, então só enxergam as
 * tabelas de módulo (`registerBackupTable`) se importarem `core/load-modules`
 * eles mesmos. Sem isso o backup sai VAZIO e a restauração não traz nada — bug
 * real que já derrubou o backup automático de um dos projetos.
 */
const SRC = path.resolve(__dirname, "../..");
const USES_BACKUP = /\b(buildOrgBackup|buildSystemBackup|restoreOrgBackup|saveAutomaticBackup)\b/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("quem gera ou restaura backup carrega os módulos", () => {
  const entryPoints = walk(SRC).filter((file) => {
    const rel = path.relative(SRC, file);
    if (rel === path.join("core", "backup.ts")) return false;
    const isRouteOrAction = /route\.ts$/.test(rel) || /backup-actions\.ts$/.test(rel);
    return isRouteOrAction && USES_BACKUP.test(readFileSync(file, "utf8"));
  });

  it("encontra pelo menos a rota do cron e a de exportar", () => {
    const rels = entryPoints.map((f) => path.relative(SRC, f));
    expect(rels.some((r) => r.includes(path.join("api", "cron", "backup")))).toBe(true);
    expect(rels.some((r) => r.includes("exportar") || r.endsWith("backup/route.ts"))).toBe(true);
  });

  it.each(entryPoints.map((f) => [path.relative(SRC, f), f]))(
    "%s importa @/core/load-modules",
    (_rel, file) => {
      expect(readFileSync(file, "utf8")).toContain('import "@/core/load-modules"');
    },
  );
});
