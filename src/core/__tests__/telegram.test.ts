import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getTelegramWebhookInfo,
  isTelegramConfigured,
  isTelegramWebhookConfigured,
  sendTelegramMessage,
  sendTelegramMessageDetailed,
  setTelegramWebhook,
} = await import("@/core/telegram");

const original = { token: process.env.TELEGRAM_BOT_TOKEN, chat: process.env.TELEGRAM_CHAT_ID };

beforeEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (original.token) process.env.TELEGRAM_BOT_TOKEN = original.token;
  if (original.chat) process.env.TELEGRAM_CHAT_ID = original.chat;
});

describe("telegram", () => {
  it("sem token e chat id: não configurado, não chama a rede e não lança", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(isTelegramConfigured()).toBe(false);
    await expect(sendTelegramMessage("oi")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("configurado: envia para o bot certo com o texto e o chat id", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_CHAT_ID = "999";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTelegramMessage("Maria precisa de suporte")).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    expect(JSON.parse(init.body)).toMatchObject({
      chat_id: "999",
      text: "Maria precisa de suporte",
    });
  });

  it("Telegram fora do ar (erro HTTP): devolve false sem lançar", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_CHAT_ID = "999";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }),
    );

    await expect(sendTelegramMessage("x")).resolves.toBe(false);
  });

  it("falha de rede: devolve false sem lançar", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_CHAT_ID = "999";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede caiu")));

    await expect(sendTelegramMessage("x")).resolves.toBe(false);
  });

  it("detalhado: explica o motivo quando o Telegram recusa (sem expor o token)", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_CHAT_ID = "999";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, description: "Bad Request: chat not found" }),
      }),
    );

    const result = await sendTelegramMessageDetailed("x");

    expect(result).toEqual({
      ok: false,
      reason: "rejected",
      detail: "Bad Request: chat not found",
    });
    expect(JSON.stringify(result)).not.toContain("123:ABC");
  });

  it("detalhado: sem configuração, diz que não está configurado", async () => {
    await expect(sendTelegramMessageDetailed("x")).resolves.toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("devolve o id da mensagem enviada (é por ele que a resposta volta à sessão)", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_CHAT_ID = "999";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 4321 } }),
      }),
    );

    await expect(sendTelegramMessageDetailed("x")).resolves.toEqual({ ok: true, messageId: 4321 });
  });

  it("webhook configurado exige também o segredo", () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_CHAT_ID = "999";
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect(isTelegramWebhookConfigured()).toBe(false);
    process.env.TELEGRAM_WEBHOOK_SECRET = "s";
    expect(isTelegramWebhookConfigured()).toBe(true);
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  it("setTelegramWebhook envia endereço e segredo e só aceita mensagens", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_CHAT_ID = "999";
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, result: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      setTelegramWebhook("https://app.exemplo.com/api/telegram/webhook", "seg"),
    ).resolves.toEqual({
      ok: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/setWebhook");
    expect(JSON.parse(init.body)).toMatchObject({
      url: "https://app.exemplo.com/api/telegram/webhook",
      secret_token: "seg",
      allowed_updates: ["message"],
    });
  });

  it("getTelegramWebhookInfo traduz a resposta do Telegram", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_CHAT_ID = "999";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            url: "https://x/api/telegram/webhook",
            pending_update_count: 2,
            last_error_message: "boom",
          },
        }),
      }),
    );

    await expect(getTelegramWebhookInfo()).resolves.toEqual({
      ok: true,
      info: {
        url: "https://x/api/telegram/webhook",
        pendingUpdateCount: 2,
        lastErrorMessage: "boom",
      },
    });
  });
});
