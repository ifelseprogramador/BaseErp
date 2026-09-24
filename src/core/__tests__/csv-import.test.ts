import { describe, expect, it } from "vitest";
import { importCsvRows } from "@/core/csv-import";

describe("importCsvRows", () => {
  it("importa linhas válidas e reporta as inválidas isoladamente", async () => {
    const csv = "name\r\nAna\r\n\r\nBia\r\n";
    const inserted: string[] = [];

    const summary = await importCsvRows<{ name: string }>(
      csv,
      (row) => {
        if (!row.name) return { success: false, error: "Nome obrigatório." };
        return { success: true, data: { name: row.name } };
      },
      async (data) => {
        inserted.push(data.name);
        return { ok: true };
      },
    );

    expect(summary.totalRows).toBe(2);
    expect(summary.imported).toBe(2);
    expect(inserted).toEqual(["Ana", "Bia"]);
  });

  it("processa sequencialmente, isolando falha de uma linha", async () => {
    const csv = "name\r\nAna\r\nBia\r\n";
    const order: string[] = [];

    const summary = await importCsvRows<{ name: string }>(
      csv,
      (row) => ({ success: true, data: { name: row.name } }),
      async (data) => {
        order.push(data.name);
        if (data.name === "Ana") return { ok: false, message: "Já existe." };
        return { ok: true };
      },
    );

    expect(order).toEqual(["Ana", "Bia"]);
    expect(summary.imported).toBe(1);
    expect(summary.results[0]).toEqual({ row: 2, ok: false, message: "Já existe." });
    expect(summary.results[1]).toEqual({ row: 3, ok: true });
  });
});
