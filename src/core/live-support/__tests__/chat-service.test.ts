import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const recordAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/core/admin/audit", () => ({ recordAudit: (...a: unknown[]) => recordAudit(...a) }));

const broadcast = vi.fn().mockResolvedValue(undefined);
vi.mock("@/core/supabase/realtime-sender", () => ({
  sendBroadcast: (...a: unknown[]) => broadcast(...a),
}));

const { postAdminChatMessage, announceAdminChatMessage } =
  await import("@/core/live-support/chat-service");

/** Banco falso: registra o que foi atualizado/inserido, sem Postgres. */
function fakeDb() {
  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  const db = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push(values);
        },
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          inserts.push(values);
          return [{ id: "m1", body: values.body, createdAt: new Date("2026-10-07T10:00:00Z") }];
        },
      }),
    }),
  };
  return { db: db as never, updates, inserts };
}

const BASE = { id: "s1", organizationId: "o1", subjectUserId: "u1" };

beforeEach(() => vi.clearAllMocks());

describe("postAdminChatMessage", () => {
  it("pedido sem atendimento: abre a conversa por texto e grava a mensagem do dono", async () => {
    const { db, updates, inserts } = fakeDb();

    const result = await postAdminChatMessage(db, {
      session: { ...BASE, status: "missed" },
      adminId: "admin1",
      body: "Já vou ajudar",
      auditAction: "live_support.conversa_painel",
    });

    expect(result.opened).toBe(true);
    expect(updates).toEqual([{ status: "chat", adminUserId: "admin1", expiresAt: null }]);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "live_support.conversa_painel", organizationId: "o1" }),
    );
    expect(inserts).toEqual([
      {
        sessionId: "s1",
        organizationId: "o1",
        senderUserId: "admin1",
        senderRole: "admin",
        body: "Já vou ajudar",
      },
    ]);
  });

  it("conversa já aberta: só grava a mensagem, sem reabrir nem auditar de novo", async () => {
    const { db, updates, inserts } = fakeDb();

    const result = await postAdminChatMessage(db, {
      session: { ...BASE, status: "chat" },
      adminId: "admin1",
      body: "E agora?",
      auditAction: "live_support.conversa_painel",
    });

    expect(result.opened).toBe(false);
    expect(updates).toHaveLength(0);
    expect(recordAudit).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(1);
  });
});

describe("announceAdminChatMessage", () => {
  const row = { id: "m1", body: "oi", createdAt: new Date("2026-10-07T10:00:00Z") };

  it("conversa nova: abre a caixa da pessoa e entrega a mensagem", async () => {
    await announceAdminChatMessage({ sessionId: "s1", subjectUserId: "u1", row, opened: true });

    expect(broadcast).toHaveBeenNthCalledWith(1, "support-user:u1", "chat-open", {
      sessionId: "s1",
    });
    expect(broadcast).toHaveBeenNthCalledWith(2, "live-session:s1", "message", {
      id: "m1",
      role: "admin",
      body: "oi",
      createdAt: "2026-10-07T10:00:00.000Z",
    });
  });

  it("conversa já aberta: só entrega a mensagem", async () => {
    await announceAdminChatMessage({ sessionId: "s1", subjectUserId: "u1", row, opened: false });

    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledWith("live-session:s1", "message", expect.anything());
  });
});
