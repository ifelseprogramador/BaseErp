import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUPPORT_WAIT_SECONDS,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_SUPPORT_WAIT_SECONDS,
  MIN_SUPPORT_WAIT_SECONDS,
  ADMIN_REQUEST_TTL_MINUTES,
  clampWaitSeconds,
  computeAdminRequestExpiresAt,
  computeExpiresAt,
  formatSupportAlert,
  isRequestExpired,
  normalizeChatMessage,
} from "@/core/live-support/wait";

describe("clampWaitSeconds", () => {
  it("mantém valores dentro do intervalo e arredonda", () => {
    expect(clampWaitSeconds(30)).toBe(30);
    expect(clampWaitSeconds(44.6)).toBe(45);
  });

  it("limita ao mínimo e ao máximo configuráveis", () => {
    expect(clampWaitSeconds(1)).toBe(MIN_SUPPORT_WAIT_SECONDS);
    expect(clampWaitSeconds(99999)).toBe(MAX_SUPPORT_WAIT_SECONDS);
  });

  it("valor inválido cai no padrão", () => {
    expect(clampWaitSeconds(Number.NaN)).toBe(DEFAULT_SUPPORT_WAIT_SECONDS);
    expect(clampWaitSeconds(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SUPPORT_WAIT_SECONDS);
  });
});

describe("computeExpiresAt / isRequestExpired", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");

  it("soma a espera configurada (já limitada) ao instante do pedido", () => {
    expect(computeExpiresAt(now, 30).toISOString()).toBe("2026-10-06T12:00:30.000Z");
    expect(computeExpiresAt(now, 0).toISOString()).toBe("2026-10-06T12:00:05.000Z");
  });

  it("não expira antes do prazo e expira depois", () => {
    const expiresAt = computeExpiresAt(now, 30);
    expect(isRequestExpired(expiresAt, new Date(now.getTime() + 10_000))).toBe(false);
    expect(isRequestExpired(expiresAt, new Date(now.getTime() + 31_000))).toBe(true);
  });

  it("tolera pequena diferença de relógio (folga de 2 s) mas não mais que isso", () => {
    const expiresAt = computeExpiresAt(now, 30);
    expect(isRequestExpired(expiresAt, new Date(now.getTime() + 28_500))).toBe(true);
    expect(isRequestExpired(expiresAt, new Date(now.getTime() + 27_000))).toBe(false);
  });

  it("sem prazo (pedido do admin) nunca expira", () => {
    expect(isRequestExpired(null, new Date(now.getTime() + 999_999))).toBe(false);
  });
});

describe("formatSupportAlert", () => {
  it("diz quem é a pessoa e a empresa, e inclui o link quando há", () => {
    const text = formatSupportAlert({
      userName: "Maria",
      organizationName: "Oficina do João",
      adminUrl: "https://app.exemplo.com/admin",
    });
    expect(text).toContain("Maria da empresa Oficina do João");
    expect(text).toContain("https://app.exemplo.com/admin");
  });

  it("sem link, não inventa um", () => {
    const text = formatSupportAlert({ userName: "Maria", organizationName: "X" });
    expect(text).not.toContain("http");
  });
});

describe("normalizeChatMessage", () => {
  it("apara espaços e recusa mensagem vazia", () => {
    expect(normalizeChatMessage("  oi  ")).toBe("oi");
    expect(normalizeChatMessage("   ")).toBeNull();
    expect(normalizeChatMessage("")).toBeNull();
  });

  it("corta mensagens longas demais", () => {
    expect(normalizeChatMessage("a".repeat(MAX_CHAT_MESSAGE_LENGTH + 50))).toHaveLength(
      MAX_CHAT_MESSAGE_LENGTH,
    );
  });
});

describe("computeAdminRequestExpiresAt", () => {
  it("conta o prazo a partir do pedido do admin, não da sessão original", () => {
    const requestedAt = new Date("2026-10-06T18:00:00.000Z");
    expect(computeAdminRequestExpiresAt(requestedAt).getTime() - requestedAt.getTime()).toBe(
      ADMIN_REQUEST_TTL_MINUTES * 60_000,
    );
  });
});
