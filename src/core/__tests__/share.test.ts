import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { decryptSecret, encryptSecret } from "../crypto";
import { shareDocumentSchema } from "../share/document";
import { DEFAULT_SHARE_TEMPLATE, renderShareTemplate } from "../share/template";
import { renderSharePdf } from "../share/pdf";
import { isAllowedSmtpHost } from "../share/email";
import { resolveOrigin } from "../share/origin";
import { purgeCutoff } from "../share/purge";

const KEY = randomBytes(32).toString("base64");

describe("crypto", () => {
  it("criptografa e descriptografa (ida e volta)", () => {
    const enc = encryptSecret("senha-de-app ção", KEY);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("senha");
    expect(decryptSecret(enc, KEY)).toBe("senha-de-app ção");
  });
  it("gera IV diferente a cada vez e rejeita chave errada ou dado adulterado", () => {
    expect(encryptSecret("x", KEY)).not.toBe(encryptSecret("x", KEY));
    const enc = encryptSecret("x", KEY);
    expect(() => decryptSecret(enc, randomBytes(32).toString("base64"))).toThrow();
    const parts = enc.split(":");
    parts[3] = Buffer.from("adulterado").toString("base64");
    expect(() => decryptSecret(parts.join(":"), KEY)).toThrow();
  });
  it("falha com chave ausente ou de tamanho errado", () => {
    expect(() => encryptSecret("x", "curta")).toThrow();
  });
});

const doc = shareDocumentSchema.parse({
  kind: "orcamento",
  title: "Orçamento",
  number: "42",
  issuerName: "Bordados da Ana",
  issuerLines: ["CNPJ 11.222.333/0001-81"],
  customerName: "João Conceição",
  sections: [{ heading: "Prazos", rows: [{ label: "Entrega", value: "15/10/2026" }] }],
  table: {
    columns: [
      { label: "Item" },
      { label: "Qtd", align: "right" },
      { label: "Total", align: "right" },
    ],
    rows: Array.from({ length: 60 }, (_, i) => [
      `Toalha bordada ≤ ${i} — “premium”`,
      "2",
      "R$ 100,00",
    ]),
  },
  totals: [{ label: "Total", value: "R$ 6.000,00", strong: true }],
  notes: "Validade de 7 dias.",
  links: [{ label: "DANFE", url: "https://exemplo.com/danfe.pdf" }],
});

describe("documento compartilhável", () => {
  it("valida limites e links (só http/https)", () => {
    expect(
      shareDocumentSchema.safeParse({ ...doc, links: [{ label: "x", url: "javascript:alert(1)" }] })
        .success,
    ).toBe(false);
    expect(shareDocumentSchema.safeParse({ ...doc, title: "" }).success).toBe(false);
  });
  it("mescla o modelo com as variáveis", () => {
    const msg = renderShareTemplate(DEFAULT_SHARE_TEMPLATE, {
      primeiro_nome: "João",
      documento: "orçamento",
      numero: "42",
      empresa: "Bordados da Ana",
      total: "R$ 6.000,00",
      link: "https://app/d/abc",
    });
    expect(msg).toBe(
      "Olá, João! Segue o orçamento nº 42 de Bordados da Ana, no valor de R$ 6.000,00.\nhttps://app/d/abc",
    );
  });
  it("variável vazia some sem deixar buraco e o link vai ao final se faltar", () => {
    const msg = renderShareTemplate("Oi {primeiro_nome}, pedido {numero} {total} !", {
      primeiro_nome: "Ana",
      numero: "7",
      link: "https://x/d/1",
    });
    expect(msg).toBe("Oi Ana, pedido 7!\nhttps://x/d/1");
    expect(renderShareTemplate("Oi {link}", { link: "L" })).toBe("Oi L");
    expect(renderShareTemplate("Oi", { link: "L" }, { ensureLink: false })).toBe("Oi");
  });
  it("renderiza PDF válido, multipágina, com acentos e caracteres fora do WinAnsi", async () => {
    const bytes = await renderSharePdf(doc);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});

describe("isAllowedSmtpHost", () => {
  it("bloqueia rede interna e aceita hosts públicos", () => {
    for (const h of [
      "localhost",
      "127.0.0.1",
      "10.0.0.5",
      "192.168.1.1",
      "172.20.0.1",
      "169.254.169.254",
      "srv.local",
      "::1",
    ]) {
      expect(isAllowedSmtpHost(h)).toBe(false);
    }
    expect(isAllowedSmtpHost("smtp.gmail.com")).toBe(true);
    expect(isAllowedSmtpHost("200.10.20.30")).toBe(true);
  });
});

describe("resolveOrigin", () => {
  it("variável vazia ou só espaços cai no host da requisição (bug do link relativo)", () => {
    expect(resolveOrigin("", "localhost:3000", null)).toBe("http://localhost:3000");
    expect(resolveOrigin("   ", "app.exemplo.com", null)).toBe("https://app.exemplo.com");
    expect(resolveOrigin(undefined, "app.exemplo.com", "https")).toBe("https://app.exemplo.com");
  });
  it("usa a URL configurada, sem barra final", () => {
    expect(resolveOrigin("https://app.meusite.com.br/", "localhost:3000", null)).toBe(
      "https://app.meusite.com.br",
    );
  });
});

describe("purgeCutoff", () => {
  it("só apaga depois da carência (7 dias por padrão)", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(purgeCutoff(now).toISOString()).toBe("2026-10-03T12:00:00.000Z");
    expect(purgeCutoff(now, 0).toISOString()).toBe(now.toISOString());
  });
});
