import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, statusChaveCriptografia } from "../crypto";

const B64 = "k3m1m5ZyVhF8m2wq0b7Yx9o0b3Cq5n2wH1zq8r6T4uA="; // 32 bytes em base64
const HEX = "a".repeat(64);

describe("statusChaveCriptografia", () => {
  it("distingue ausente, inválida e ok, sem expor o valor", () => {
    expect(statusChaveCriptografia(undefined)).toEqual({ ok: false, motivo: "ausente" });
    expect(statusChaveCriptografia("")).toEqual({ ok: false, motivo: "ausente" });
    expect(statusChaveCriptografia("   ")).toEqual({ ok: false, motivo: "ausente" });
    expect(statusChaveCriptografia("curta")).toEqual({ ok: false, motivo: "invalida" });
    expect(statusChaveCriptografia(B64)).toEqual({ ok: true });
    expect(statusChaveCriptografia(HEX)).toEqual({ ok: true });
  });
});

describe("chave colada com espaço, quebra de linha ou aspas", () => {
  it("dá exatamente a mesma chave que o valor limpo (dados antigos continuam legíveis)", () => {
    const cifrado = encryptSecret("segredo", B64);
    for (const suja of [` ${B64}`, `${B64}\n`, `"${B64}"`, `'${B64}'`, ` "${B64}" \n`]) {
      expect(statusChaveCriptografia(suja)).toEqual({ ok: true });
      expect(decryptSecret(cifrado, suja)).toBe("segredo");
    }
  });
  it("hex com quebra de linha ou aspas também vale", () => {
    expect(statusChaveCriptografia(`${HEX}\n`)).toEqual({ ok: true });
    expect(statusChaveCriptografia(`"${HEX}"`)).toEqual({ ok: true });
  });
  it("tamanho errado continua inválido", () => {
    expect(statusChaveCriptografia(B64.slice(0, 20))).toEqual({ ok: false, motivo: "invalida" });
    expect(statusChaveCriptografia(`${HEX}ab`)).toEqual({ ok: false, motivo: "invalida" });
  });
});
