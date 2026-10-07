import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isTelegramConfigured, sendTelegramMessage, sendTelegramMessageDetailed } =
  await import("@/core/telegram");

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
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));

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
});
