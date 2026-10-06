import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playChatSound = vi.fn();
vi.mock("@/core/live-support/chat-sound", async () => {
  const actual = await vi.importActual<typeof import("@/core/live-support/chat-sound")>(
    "@/core/live-support/chat-sound",
  );
  return { ...actual, playChatSound: () => playChatSound(), flashTabTitle: vi.fn() };
});

vi.mock("@/core/live-support/actions", () => ({
  listSupportMessages: vi.fn().mockResolvedValue({ ok: true, messages: [] }),
  sendSupportMessage: vi.fn(),
}));

const { SupportChatPanel } = await import("@/core/live-support/components/support-chat-panel");
const { dispatchChatMessage } = await import("@/core/live-support/chat-events");
const { setSoundEnabled } = await import("@/core/live-support/chat-sound");

const SESSION = "s1";

function msg(id: string, role: "admin" | "user", body = "oi") {
  return { id, role, body, createdAt: new Date().toISOString() };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SupportChatPanel — aviso de mensagem nova", () => {
  it("toca o aviso quando chega mensagem do outro lado", async () => {
    render(<SupportChatPanel sessionId={SESSION} side="user" />);

    act(() => dispatchChatMessage(SESSION, msg("m1", "admin")));

    expect(playChatSound).toHaveBeenCalledTimes(1);
  });

  it("não toca para a própria mensagem", () => {
    render(<SupportChatPanel sessionId={SESSION} side="user" />);

    act(() => dispatchChatMessage(SESSION, msg("m1", "user")));

    expect(playChatSound).not.toHaveBeenCalled();
  });

  it("a mesma mensagem (tempo real + releitura) avisa uma vez só", () => {
    render(<SupportChatPanel sessionId={SESSION} side="admin" />);

    act(() => {
      dispatchChatMessage(SESSION, msg("m1", "user"));
      dispatchChatMessage(SESSION, msg("m1", "user"));
    });

    expect(playChatSound).toHaveBeenCalledTimes(1);
  });

  it("ignora mensagem de outra sessão", () => {
    render(<SupportChatPanel sessionId={SESSION} side="user" />);

    act(() => dispatchChatMessage("outra", msg("m1", "admin")));

    expect(playChatSound).not.toHaveBeenCalled();
  });

  it("silenciado, não toca", () => {
    setSoundEnabled(false);
    render(<SupportChatPanel sessionId={SESSION} side="user" />);

    act(() => dispatchChatMessage(SESSION, msg("m1", "admin")));

    expect(playChatSound).not.toHaveBeenCalled();
  });

  it("recolhida, conta as não lidas; ao expandir, zera", async () => {
    const user = userEvent.setup();
    render(<SupportChatPanel sessionId={SESSION} side="user" />);

    await user.click(screen.getByRole("button", { name: "Recolher conversa" }));
    act(() => {
      dispatchChatMessage(SESSION, msg("m1", "admin"));
      dispatchChatMessage(SESSION, msg("m2", "admin"));
    });

    expect(screen.getByLabelText("2 mensagens não lidas")).toBeTruthy();
    expect(playChatSound).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Expandir conversa" }));
    expect(screen.queryByLabelText(/mensagens não lidas/)).toBeNull();
  });

  it("o botão de som liga e desliga a preferência", async () => {
    const user = userEvent.setup();
    render(<SupportChatPanel sessionId={SESSION} side="user" />);
    const header = screen.getByRole("group");

    await user.click(within(header).getByRole("button", { name: "Silenciar aviso sonoro" }));
    expect(window.localStorage.getItem("support-chat-sound")).toBe("off");

    await user.click(within(header).getByRole("button", { name: "Ativar aviso sonoro" }));
    expect(window.localStorage.getItem("support-chat-sound")).toBe("on");
  });
});
