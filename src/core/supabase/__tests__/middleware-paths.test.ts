import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isPublicPath } = await import("@/core/supabase/middleware");

describe("isPublicPath", () => {
  it("login e documentos compartilhados dispensam sessão", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/d/abc123")).toBe(true);
  });

  it("os crons e o webhook do Telegram dispensam sessão (cada rota se autentica por conta própria)", () => {
    expect(isPublicPath("/api/cron/backup")).toBe(true);
    expect(isPublicPath("/api/cron/purge-shared")).toBe(true);
    expect(isPublicPath("/api/telegram/webhook")).toBe(true);
  });

  it("o resto continua exigindo login", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/api/health")).toBe(false);
    expect(isPublicPath("/api/telegram/outra-coisa")).toBe(false);
    expect(isPublicPath("/api/telegram")).toBe(false);
  });
});

describe("rotas públicas extras de um vertical", () => {
  it("o que o vertical lista em public-paths-extra também dispensa sessão", async () => {
    vi.resetModules();
    vi.doMock("../public-paths-extra", () => ({ EXTRA_PUBLIC_PATHS: ["/api/webhooks/x/"] }));
    const { isPublicPath: com } = await import("../middleware");
    expect(com("/api/webhooks/x/token")).toBe(true);
    expect(com("/api/webhooks/y/token")).toBe(false);
    expect(com("/login")).toBe(true);
    vi.doUnmock("../public-paths-extra");
    vi.resetModules();
  });
});
