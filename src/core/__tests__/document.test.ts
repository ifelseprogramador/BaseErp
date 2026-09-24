import { describe, expect, it } from "vitest";
import { formatDocument, isValidCnpj, isValidCpf, isValidDocument } from "@/core/document";

describe("isValidCpf", () => {
  it("aceita um CPF válido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("rejeita dígitos repetidos", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("rejeita tamanho errado ou dígito verificador incorreto", () => {
    expect(isValidCpf("123.456.789-00")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("aceita um CNPJ válido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita dígitos repetidos ou inválido", () => {
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-00")).toBe(false);
  });
});

describe("isValidDocument", () => {
  it("distingue CPF de CNPJ pelo tamanho", () => {
    expect(isValidDocument("529.982.247-25")).toBe(true);
    expect(isValidDocument("11.222.333/0001-81")).toBe(true);
    expect(isValidDocument("123")).toBe(false);
  });
});

describe("formatDocument", () => {
  it("formata CPF", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
  });

  it("formata CNPJ", () => {
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("devolve o valor original se não bater tamanho conhecido", () => {
    expect(formatDocument("123")).toBe("123");
  });
});
