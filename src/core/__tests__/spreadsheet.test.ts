import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildExport, buildTemplate, readSheet } from "../spreadsheet/xlsx";
import { normalizeHeader, SpreadsheetError, type SheetColumn } from "../spreadsheet/columns";

const columns: SheetColumn[] = [
  { key: "name", header: "Nome", required: true, hint: "Nome completo", example: "Maria" },
  {
    key: "type",
    header: "Tipo",
    hint: "PF ou PJ",
    example: "Pessoa física",
    options: ["Pessoa física", "Pessoa jurídica"],
    aliases: ["tipo de cliente"],
  },
  {
    key: "zip",
    header: "CEP",
    hint: "8 dígitos",
    example: "01310-100",
    normalize: (v) => (/^\d{1,7}$/.test(v) ? v.padStart(8, "0") : v),
  },
  { key: "phone", header: "Telefone", hint: "com DDD", example: "11999998888" },
];

const buf = (text: string | Uint8Array) => Buffer.from(text as never);

describe("normalizeHeader", () => {
  it("ignora acento, caixa, asterisco e '(opcional)'", () => {
    expect(normalizeHeader("Nome *")).toBe("nome");
    expect(normalizeHeader("Inscrição Estadual (opcional)")).toBe("inscricaoestadual");
  });
});

describe("readSheet — xlsx", () => {
  it("modelo gerado: lê de volta o que a pessoa preencheu, com cabeçalho marcado com *", async () => {
    const template = await buildTemplate({ sheetName: "Clientes", title: "Modelo", columns });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(template as unknown as ArrayBuffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Instruções", "Clientes"]);
    const sheet = wb.getWorksheet("Clientes")!;
    expect(sheet.getRow(1).getCell(1).value).toBe("Nome *");
    expect(sheet.getCell(2, 2).dataValidation?.type).toBe("list");

    ["Maria Souza", "Pessoa física", 1310100, "11999998888"].forEach((v, i) => {
      sheet.getCell(2, i + 1).value = v;
    });
    sheet.getCell(4, 1).value = "Ana Lima"; // linha 3 vazia deve ser ignorada
    const filled = Buffer.from(await wb.xlsx.writeBuffer());

    const r = await readSheet({ name: "clientes.xlsx", buffer: filled }, columns, "Clientes");
    expect(r.missingRequired).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({
      row: 2,
      values: { name: "Maria Souza", type: "Pessoa física", zip: "01310100", phone: "11999998888" },
    });
    expect(r.rows[1].row).toBe(4);
  });

  it("exportação tem o mesmo formato e volta íntegra (zeros à esquerda preservados)", async () => {
    const out = await buildExport({
      sheetName: "Clientes",
      columns,
      rows: [{ name: "José", type: "Pessoa jurídica", zip: "01310100", phone: "011999" }],
    });
    const r = await readSheet({ name: "x.xlsx", buffer: out }, columns, "Clientes");
    expect(r.rows[0].values).toMatchObject({ name: "José", zip: "01310100", phone: "011999" });
  });

  it("avisa colunas obrigatórias ausentes e cabeçalhos desconhecidos", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Qualquer").addRows([
      ["Telefone", "Cor favorita"],
      ["1199", "azul"],
    ]);
    const r = await readSheet(
      { name: "a.xlsx", buffer: Buffer.from(await wb.xlsx.writeBuffer()) },
      columns,
      "Clientes",
    );
    expect(r.missingRequired).toEqual(["Nome"]);
    expect(r.unknownHeaders).toEqual(["Cor favorita"]);
  });
});

describe("readSheet — csv e erros", () => {
  it("CSV com ponto e vírgula e sinônimo de cabeçalho", async () => {
    const r = await readSheet(
      { name: "a.csv", buffer: buf("Nome;Tipo de cliente;CEP\nMaria;Pessoa física;1310100\n") },
      columns,
      "Clientes",
    );
    expect(r.rows[0].values).toEqual({ name: "Maria", type: "Pessoa física", zip: "01310100" });
  });

  it("CSV com vírgula e chaves em inglês (formato antigo)", async () => {
    const r = await readSheet(
      { name: "a.csv", buffer: buf('name,phone\n"Silva, João",1199\n') },
      columns,
      "Clientes",
    );
    expect(r.rows[0].values.name).toBe("Silva, João");
  });

  it("CSV em Windows-1252 (Excel em português) mantém os acentos", async () => {
    const latin1 = Buffer.from("Nome;Telefone\nJosé da Conceição;1199\n", "latin1");
    const r = await readSheet({ name: "a.csv", buffer: latin1 }, columns, "Clientes");
    expect(r.rows[0].values.name).toBe("José da Conceição");
  });

  it("recusa formato, arquivo vazio, corrompido e grande demais com mensagem amigável", async () => {
    await expect(readSheet({ name: "a.xls", buffer: buf("x") }, columns, "C")).rejects.toThrow(
      /\.xlsx ou \.csv/,
    );
    await expect(readSheet({ name: "a.csv", buffer: buf("") }, columns, "C")).rejects.toThrow(
      /vazio/,
    );
    await expect(
      readSheet({ name: "a.xlsx", buffer: buf("lixo") }, columns, "C"),
    ).rejects.toBeInstanceOf(SpreadsheetError);
    await expect(
      readSheet({ name: "a.csv", buffer: Buffer.alloc(6 * 1024 * 1024, "a") }, columns, "C"),
    ).rejects.toThrow(/5 MB/);
  });

  it("limita a quantidade de linhas", async () => {
    const csv = "Nome\n" + Array.from({ length: 5001 }, (_, i) => `N${i}`).join("\n");
    await expect(readSheet({ name: "a.csv", buffer: buf(csv) }, columns, "C")).rejects.toThrow(
      /5000/,
    );
  });
});
