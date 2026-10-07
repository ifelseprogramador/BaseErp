import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const handleOwnerMessage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/core/live-support/telegram-bridge", () => ({
  handleOwnerMessage: (...args: unknown[]) => handleOwnerMessage(...args),
}));
vi.mock("@/core/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { POST } = await import("../route");

const original = {
  secret: process.env.TELEGRAM_WEBHOOK_SECRET,
  chat: process.env.TELEGRAM_CHAT_ID,
};

function request(body: unknown, secret?: string) {
  return new Request("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const OWNER_MESSAGE = {
  update_id: 1,
  message: { message_id: 9, text: "Já estou vendo", chat: { id: 555 }, from: { id: 555 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_WEBHOOK_SECRET = "segredo-do-teste";
  process.env.TELEGRAM_CHAT_ID = "555";
});

afterEach(() => {
  if (original.secret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
  else process.env.TELEGRAM_WEBHOOK_SECRET = original.secret;
  if (original.chat === undefined) delete process.env.TELEGRAM_CHAT_ID;
  else process.env.TELEGRAM_CHAT_ID = original.chat;
});

describe("POST /api/telegram/webhook", () => {
  it("sem o segredo no cabeçalho: 401 e nada é processado", async () => {
    const response = await POST(request(OWNER_MESSAGE));
    expect(response.status).toBe(401);
    expect(handleOwnerMessage).not.toHaveBeenCalled();
  });

  it("segredo errado: 401", async () => {
    const response = await POST(request(OWNER_MESSAGE, "outro-segredo"));
    expect(response.status).toBe(401);
    expect(handleOwnerMessage).not.toHaveBeenCalled();
  });

  it("segredo não configurado no servidor: recusa mesmo com cabeçalho", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const response = await POST(request(OWNER_MESSAGE, "qualquer"));
    expect(response.status).toBe(401);
  });

  it("mensagem do dono: processa e responde 200", async () => {
    const response = await POST(request(OWNER_MESSAGE, "segredo-do-teste"));
    expect(response.status).toBe(200);
    expect(handleOwnerMessage).toHaveBeenCalledTimes(1);
    expect(handleOwnerMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 555, text: "Já estou vendo", messageId: 9 }),
    );
  });

  it("mensagem de OUTRA pessoa que falou com o bot: ignora em silêncio (200, nada processado)", async () => {
    const stranger = {
      update_id: 2,
      message: { message_id: 1, text: "oi", chat: { id: 999 }, from: { id: 999 } },
    };
    const response = await POST(request(stranger, "segredo-do-teste"));
    expect(response.status).toBe(200);
    expect(handleOwnerMessage).not.toHaveBeenCalled();
  });

  it("update que não é texto, ou corpo inválido: 200 sem processar (o Telegram não reenvia)", async () => {
    const photo = { update_id: 3, message: { message_id: 1, chat: { id: 555 } } };
    expect((await POST(request(photo, "segredo-do-teste"))).status).toBe(200);
    expect((await POST(request("não é json{", "segredo-do-teste"))).status).toBe(200);
    expect(handleOwnerMessage).not.toHaveBeenCalled();
  });
});
