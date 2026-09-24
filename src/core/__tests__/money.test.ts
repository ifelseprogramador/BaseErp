import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  formatCents,
  multiplyCents,
  parseReaisInput,
  sumCents,
  toCents,
} from "@/core/money";

describe("toCents", () => {
  it("converte reais para centavos arredondando", () => {
    expect(toCents(150.9)).toBe(15090);
    expect(toCents(10)).toBe(1000);
  });
});

describe("parseReaisInput", () => {
  it("aceita vírgula decimal", () => {
    expect(parseReaisInput("150,90")).toBe(15090);
  });

  it("aceita ponto decimal", () => {
    expect(parseReaisInput("150.90")).toBe(15090);
  });

  it("aceita separador de milhar com vírgula decimal", () => {
    expect(parseReaisInput("1.234,56")).toBe(123456);
  });

  it("retorna null para texto vazio ou inválido", () => {
    expect(parseReaisInput("")).toBeNull();
    expect(parseReaisInput("   ")).toBeNull();
    expect(parseReaisInput("abc")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formata como moeda brasileira", () => {
    expect(formatCents(15090)).toBe("R$ 150,90");
    expect(formatCents(0)).toBe("R$ 0,00");
  });
});

describe("sumCents", () => {
  it("soma uma lista de valores", () => {
    expect(sumCents([100, 200, 300])).toBe(600);
    expect(sumCents([])).toBe(0);
  });
});

describe("multiplyCents", () => {
  it("multiplica e arredonda", () => {
    expect(multiplyCents(333, 3)).toBe(999);
    expect(multiplyCents(100, 1.5)).toBe(150);
  });
});

describe("applyDiscount", () => {
  it("subtrai o desconto do subtotal", () => {
    expect(applyDiscount(10000, 2000)).toBe(8000);
  });

  it("nunca deixa o resultado negativo", () => {
    expect(applyDiscount(1000, 5000)).toBe(0);
  });
});
