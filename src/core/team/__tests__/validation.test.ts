import { describe, expect, it } from "vitest";
import {
  inviteMemberSchema,
  memberAccessSchema,
  parsePriceToCents,
  parseSeatsFormData,
  seatsSchema,
} from "@/core/team/validation";

describe("inviteMemberSchema", () => {
  it("normaliza o e-mail para minúsculas e deduplica módulos", () => {
    const result = inviteMemberSchema.safeParse({
      email: "Maria@Example.com",
      department: "  Oficina ",
      moduleSlugs: ["ordens", "ordens", "clientes"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("maria@example.com");
      expect(result.data.department).toBe("Oficina");
      expect(result.data.moduleSlugs).toEqual(["ordens", "clientes"]);
    }
  });

  it("setor vazio vira undefined", () => {
    const result = inviteMemberSchema.safeParse({
      email: "a@b.com",
      department: "   ",
      moduleSlugs: [],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.department).toBeUndefined();
  });

  it("rejeita e-mail inválido", () => {
    const result = inviteMemberSchema.safeParse({ email: "sem-arroba", moduleSlugs: [] });
    expect(result.success).toBe(false);
  });
});

describe("memberAccessSchema", () => {
  it("rejeita setor com mais de 60 caracteres", () => {
    const result = memberAccessSchema.safeParse({ department: "x".repeat(61), moduleSlugs: [] });
    expect(result.success).toBe(false);
  });
});

describe("parsePriceToCents", () => {
  it("converte vírgula e ponto de milhar", () => {
    expect(parsePriceToCents("29,90")).toBe(2990);
    expect(parsePriceToCents("1.029,90")).toBe(102990);
    expect(parsePriceToCents("30")).toBe(3000);
  });

  it("vazio vira null; inválido vira NaN", () => {
    expect(parsePriceToCents("  ")).toBeNull();
    expect(parsePriceToCents("abc")).toBeNaN();
    expect(parsePriceToCents("-5")).toBeNaN();
  });
});

describe("seatsSchema", () => {
  it("modo de um usuário só exige limite 1", () => {
    expect(
      seatsSchema.safeParse({ multiUser: false, seatLimit: 3, extraSeatPriceCents: null }).success,
    ).toBe(false);
    expect(
      seatsSchema.safeParse({ multiUser: false, seatLimit: 1, extraSeatPriceCents: null }).success,
    ).toBe(true);
  });

  it("multiusuário aceita limite maior que 1 e rejeita zero", () => {
    expect(
      seatsSchema.safeParse({ multiUser: true, seatLimit: 5, extraSeatPriceCents: 2990 }).success,
    ).toBe(true);
    expect(
      seatsSchema.safeParse({ multiUser: true, seatLimit: 0, extraSeatPriceCents: null }).success,
    ).toBe(false);
  });
});

describe("parseSeatsFormData", () => {
  function form(entries: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  }

  it("checkbox desmarcado força limite 1, mesmo com número no campo", () => {
    const result = parseSeatsFormData(form({ seatLimit: "9", extraSeatPrice: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.multiUser).toBe(false);
      expect(result.data.seatLimit).toBe(1);
    }
  });

  it("multiusuário ligado lê limite e preço", () => {
    const result = parseSeatsFormData(
      form({ multiUser: "on", seatLimit: "4", extraSeatPrice: "19,90" }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.seatLimit).toBe(4);
      expect(result.data.extraSeatPriceCents).toBe(1990);
    }
  });

  it("multiusuário ligado sem limite é erro", () => {
    const result = parseSeatsFormData(form({ multiUser: "on", seatLimit: "" }));
    expect(result.success).toBe(false);
  });

  it("preço inválido é erro", () => {
    const result = parseSeatsFormData(
      form({ multiUser: "on", seatLimit: "2", extraSeatPrice: "abc" }),
    );
    expect(result.success).toBe(false);
  });
});
