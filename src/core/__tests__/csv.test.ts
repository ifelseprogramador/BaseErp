import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/core/csv";

describe("toCsv", () => {
  it("gera cabeçalho e linhas, com BOM UTF-8", () => {
    const csv = toCsv([{ name: "Ana", city: "São Paulo" }], ["name", "city"]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("name,city");
    expect(csv).toContain("Ana,São Paulo");
  });

  it("escapa campos com vírgula, aspas ou quebra de linha", () => {
    const csv = toCsv([{ name: 'Diz "oi", olá\ntudo bem' }], ["name"]);
    expect(csv).toContain('"Diz ""oi"", olá\ntudo bem"');
  });
});

describe("parseCsv", () => {
  it("lê linhas simples de volta para objetos", () => {
    const rows = parseCsv("name,city\r\nAna,São Paulo\r\n");
    expect(rows).toEqual([{ name: "Ana", city: "São Paulo" }]);
  });

  it("remove o BOM UTF-8 do início do arquivo", () => {
    const rows = parseCsv("﻿name\r\nAna\r\n");
    expect(rows).toEqual([{ name: "Ana" }]);
  });

  it("respeita campos entre aspas com vírgula e aspas escapadas", () => {
    const rows = parseCsv('name,note\r\nAna,"Diz ""oi"", tchau"\r\n');
    expect(rows).toEqual([{ name: "Ana", note: 'Diz "oi", tchau' }]);
  });

  it("volta lista vazia para texto vazio", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("roundtrip: toCsv seguido de parseCsv preserva os dados", () => {
    const original = [{ name: "Ana", note: 'com "aspas", vírgula e\nquebra' }];
    const csv = toCsv(original, ["name", "note"]);
    expect(parseCsv(csv)).toEqual(original);
  });
});
