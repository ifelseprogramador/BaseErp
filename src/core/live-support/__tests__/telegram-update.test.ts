import { describe, expect, it } from "vitest";
import {
  formatConversationOpened,
  formatForwardedMessage,
  formatScreenStarted,
  isOwnerChat,
  parseOwnerCommand,
  parseTelegramUpdate,
  planOwnerReply,
  secretMatches,
} from "@/core/live-support/telegram-update";

function update(message: Record<string, unknown>) {
  return { update_id: 1, message };
}

describe("parseTelegramUpdate", () => {
  it("lê texto, chat, remetente e a mensagem respondida", () => {
    const inbound = parseTelegramUpdate(
      update({
        message_id: 42,
        text: "  Oi, já vou ver  ",
        chat: { id: 555 },
        from: { id: 555 },
        reply_to_message: { message_id: 40 },
      }),
    );
    expect(inbound).toEqual({
      messageId: 42,
      chatId: 555,
      fromId: 555,
      text: "Oi, já vou ver",
      replyToMessageId: 40,
    });
  });

  it("sem 'Responder', replyToMessageId é null", () => {
    const inbound = parseTelegramUpdate(update({ message_id: 1, text: "oi", chat: { id: 1 } }));
    expect(inbound?.replyToMessageId).toBeNull();
    expect(inbound?.fromId).toBeNull();
  });

  it.each([
    ["lixo", "texto"],
    ["nulo", null],
    ["sem mensagem (ex.: edição)", { update_id: 1, edited_message: {} }],
    ["foto sem texto", update({ message_id: 1, chat: { id: 1 }, photo: [{}] })],
    ["texto vazio", update({ message_id: 1, text: "   ", chat: { id: 1 } })],
    ["sem chat", update({ message_id: 1, text: "oi" })],
    ["id de mensagem inválido", update({ message_id: "1", text: "oi", chat: { id: 1 } })],
  ])("ignora %s", (_label, input) => {
    expect(parseTelegramUpdate(input)).toBeNull();
  });
});

describe("isOwnerChat", () => {
  it("só o chat configurado passa, comparando como texto (inclui id negativo)", () => {
    expect(isOwnerChat({ chatId: 555 }, "555")).toBe(true);
    expect(isOwnerChat({ chatId: -100123 }, " -100123 ")).toBe(true);
    expect(isOwnerChat({ chatId: 556 }, "555")).toBe(false);
  });

  it("sem chat configurado, ninguém passa", () => {
    expect(isOwnerChat({ chatId: 555 }, undefined)).toBe(false);
    expect(isOwnerChat({ chatId: 555 }, "")).toBe(false);
  });
});

describe("secretMatches", () => {
  it("aceita só o segredo exato", () => {
    expect(secretMatches("abc123", "abc123")).toBe(true);
    expect(secretMatches("abc124", "abc123")).toBe(false);
    expect(secretMatches("abc12", "abc123")).toBe(false);
  });

  it("sem segredo configurado ou sem cabeçalho, recusa tudo", () => {
    expect(secretMatches("abc", undefined)).toBe(false);
    expect(secretMatches(null, "abc")).toBe(false);
    expect(secretMatches("", "")).toBe(false);
  });
});

describe("parseOwnerCommand", () => {
  it("/fim e /encerrar encerram, com ou sem @bot", () => {
    expect(parseOwnerCommand("/fim")).toEqual({ kind: "end" });
    expect(parseOwnerCommand("/Encerrar")).toEqual({ kind: "end" });
    expect(parseOwnerCommand("/fim@meu_bot")).toEqual({ kind: "end" });
  });

  it("o resto é mensagem (inclusive texto que só contém /fim no meio)", () => {
    expect(parseOwnerCommand("  tudo bem?  ")).toEqual({ kind: "message", body: "tudo bem?" });
    expect(parseOwnerCommand("quando vc der /fim me avisa")).toEqual({
      kind: "message",
      body: "quando vc der /fim me avisa",
    });
  });
});

describe("planOwnerReply — a conversa muda do Telegram para o painel", () => {
  it("pedido sem atendimento ou ainda esperando: a primeira resposta abre a conversa", () => {
    expect(planOwnerReply({ status: "missed", command: "message" })).toBe("open_and_message");
    expect(planOwnerReply({ status: "pending", command: "message" })).toBe("open_and_message");
  });

  it("conversa por texto aberta: só grava a mensagem", () => {
    expect(planOwnerReply({ status: "chat", command: "message" })).toBe("message");
  });

  it("com a tela compartilhada, o Telegram deixa de ser o canal", () => {
    expect(planOwnerReply({ status: "active", command: "message" })).toBe("hint_panel");
    expect(planOwnerReply({ status: "active", command: "end" })).toBe("hint_panel");
  });

  it("conversa encerrada não recebe nada", () => {
    for (const status of ["ended", "declined"]) {
      expect(planOwnerReply({ status, command: "message" })).toBe("hint_closed");
    }
  });

  it("/fim encerra uma conversa aberta", () => {
    expect(planOwnerReply({ status: "chat", command: "end" })).toBe("end");
    expect(planOwnerReply({ status: "missed", command: "end" })).toBe("end");
  });
});

describe("textos enviados ao Telegram", () => {
  it("encaminhar a mensagem do usuário diz quem é e como responder", () => {
    const text = formatForwardedMessage({
      userName: "Maria",
      organizationName: "Oficina X",
      body: "Não consigo emitir",
    });
    expect(text).toContain("Maria (Oficina X)");
    expect(text).toContain("Não consigo emitir");
    expect(text).toContain("Responder");
  });

  it("conversa aberta explica o fluxo e o /fim", () => {
    const text = formatConversationOpened({ userName: "Maria", organizationName: "Oficina X" });
    expect(text).toContain("Maria");
    expect(text).toContain("/fim");
  });

  it("tela liberada avisa que a conversa saiu do Telegram", () => {
    const text = formatScreenStarted({
      userName: "Maria",
      organizationName: "Oficina X",
      adminUrl: "https://app.exemplo.com/admin",
    });
    expect(text).toContain("não é mais por aqui");
    expect(text).toContain("https://app.exemplo.com/admin");
  });
});
