import { describe, expect, it } from "vitest";
import { companyProfileSchema } from "../profile/company-validation";

describe("companyProfileSchema", () => {
  it("campos vazios viram null (limpar um dado é permitido)", () => {
    expect(
      companyProfileSchema.parse({ displayName: "", document: "", phone: " ", address: "" }),
    ).toEqual({
      displayName: null,
      document: null,
      phone: null,
      address: null,
    });
  });
  it("aceita CNPJ/CPF válido com ou sem pontuação e recusa inválido", () => {
    expect(companyProfileSchema.safeParse({ document: "11.222.333/0001-81" }).success).toBe(true);
    expect(companyProfileSchema.safeParse({ document: "52998224725" }).success).toBe(true);
    expect(companyProfileSchema.safeParse({ document: "123" }).success).toBe(false);
  });
  it("limita o tamanho dos textos", () => {
    expect(companyProfileSchema.safeParse({ displayName: "x".repeat(121) }).success).toBe(false);
  });
});
