import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (msg: { payload: Record<string, unknown> }) => void;

/** Um canal falso por tópico; guarda os handlers para o teste disparar eventos. */
const channels = new Map<string, Record<string, Handler>>();
vi.mock("@/core/live-support/realtime", () => ({
  liveSessionChannelName: (id: string) => `live-session:${id}`,
  userSupportChannelName: (id: string) => `support-user:${id}`,
  adminSupportInboxChannelName: () => "support-admin-inbox",
  getRealtimeChannel: (topic: string) => {
    const handlers = channels.get(topic) ?? {};
    channels.set(topic, handlers);
    const channel = {
      on(_type: string, filter: { event: string }, cb: Handler) {
        handlers[filter.event] = cb;
        return channel;
      },
      subscribe: () => channel,
      unsubscribe: vi.fn(),
      send: vi.fn().mockResolvedValue("ok"),
    };
    return channel;
  },
}));

const approveSupportSession = vi.fn().mockResolvedValue({ ok: true });
const declineSupportSession = vi.fn().mockResolvedValue({ ok: true });
const callForSupport = vi.fn();
const endLiveSession = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/core/live-support/actions", () => ({
  approveSupportSession: (...a: unknown[]) => approveSupportSession(...a),
  declineSupportSession: (...a: unknown[]) => declineSupportSession(...a),
  callForSupport: (...a: unknown[]) => callForSupport(...a),
  endLiveSession: (...a: unknown[]) => endLiveSession(...a),
  expireSupportRequest: vi.fn().mockResolvedValue({ ok: true, status: "pending" }),
  saveFullSnapshot: vi.fn().mockResolvedValue({ ok: true }),
  setControlGranted: vi.fn().mockResolvedValue({ ok: true }),
  listSupportMessages: vi.fn().mockResolvedValue({ ok: true, messages: [] }),
  sendSupportMessage: vi.fn(),
}));

vi.mock("rrweb", () => ({
  EventType: { Meta: 4, FullSnapshot: 2 },
  record: Object.assign(
    vi.fn(() => vi.fn()),
    { takeFullSnapshot: vi.fn() },
  ),
}));
vi.mock("@/core/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { LiveSupportWidget } = await import("@/core/live-support/components/live-support-widget");

function fire(topic: string, event: string, payload: Record<string, unknown> = {}) {
  act(() => channels.get(topic)?.[event]?.({ payload }));
}

const CHAT = {
  id: "s1",
  status: "chat" as const,
  initiatedBy: "user" as const,
  controlGranted: false,
  screenRequested: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  channels.clear();
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

describe("LiveSupportWidget — conversa por texto (resposta do suporte pelo Telegram)", () => {
  it("sem sessão, mostra só o botão de chamar suporte", () => {
    render(<LiveSupportWidget userId="u1" initialSession={null} />);

    expect(screen.getByTitle("Chamar suporte")).toBeTruthy();
    expect(screen.queryByText("Conversa com o suporte")).toBeNull();
  });

  it("quando o suporte responde, a caixa de conversa abre sozinha na tela da pessoa", () => {
    render(<LiveSupportWidget userId="u1" initialSession={null} />);

    fire("support-user:u1", "chat-open", { sessionId: "s1" });

    expect(screen.getByText("Conversa com o suporte")).toBeTruthy();
    expect(screen.queryByTitle("Chamar suporte")).toBeNull();
  });

  it("ao entrar no app com a conversa já aberta (resposta chegou com ela offline), a caixa aparece", () => {
    render(<LiveSupportWidget userId="u1" initialSession={CHAT} />);

    expect(screen.getByText("Conversa com o suporte")).toBeTruthy();
    // Conversa só por texto: sem a barra "sessão ativa" e sem aviso de permissão.
    expect(screen.queryByText(/Sessão de suporte ativa/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("conversa por texto tem botão para encerrar", async () => {
    const user = userEvent.setup();
    render(<LiveSupportWidget userId="u1" initialSession={CHAT} />);

    await user.click(screen.getByRole("button", { name: "Encerrar conversa" }));

    expect(endLiveSession).toHaveBeenCalledWith("s1");
    await waitFor(() => expect(screen.queryByText("Conversa com o suporte")).toBeNull());
  });
});

describe("LiveSupportWidget — pedido de tela dentro da conversa", () => {
  it("o pedido de tela aparece como aviso de permissão, sem fechar a conversa", () => {
    render(<LiveSupportWidget userId="u1" initialSession={CHAT} />);

    fire("live-session:s1", "screen-request");

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/quer ver sua tela/)).toBeTruthy();
    expect(screen.getByText("Conversa com o suporte")).toBeTruthy();
  });

  it("recusar a tela fecha o aviso e a conversa continua", async () => {
    const user = userEvent.setup();
    render(<LiveSupportWidget userId="u1" initialSession={{ ...CHAT, screenRequested: true }} />);

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Recusar" }));

    expect(declineSupportSession).toHaveBeenCalledWith("s1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Conversa com o suporte")).toBeTruthy();
  });

  it("permitir a tela vira a MESMA sessão ativa, com a caixa de conversa no lugar", async () => {
    const user = userEvent.setup();
    render(<LiveSupportWidget userId="u1" initialSession={{ ...CHAT, screenRequested: true }} />);

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Permitir" }));

    expect(approveSupportSession).toHaveBeenCalledWith("s1");
    expect(await screen.findByText(/Sessão de suporte ativa/)).toBeTruthy();
    expect(screen.getByText("Conversa com o suporte")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("se o suporte cancelar o pedido de tela, o aviso some sozinho", () => {
    render(<LiveSupportWidget userId="u1" initialSession={{ ...CHAT, screenRequested: true }} />);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fire("live-session:s1", "status", { status: "chat" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Conversa com o suporte")).toBeTruthy();
  });

  it("encerrar a conversa pelo outro lado fecha tudo", () => {
    render(<LiveSupportWidget userId="u1" initialSession={CHAT} />);

    fire("live-session:s1", "status", { status: "ended" });

    expect(screen.queryByText("Conversa com o suporte")).toBeNull();
    expect(screen.getByTitle("Chamar suporte")).toBeTruthy();
  });
});

describe("LiveSupportWidget — chamar suporte sem ninguém online", () => {
  it("avisa que o suporte não está online e não abre sessão", async () => {
    callForSupport.mockResolvedValue({ ok: true, sessionId: "s9", status: "missed" });
    const user = userEvent.setup();
    render(<LiveSupportWidget userId="u1" initialSession={null} />);

    await user.click(screen.getByTitle("Chamar suporte"));

    expect(await screen.findByText(/não está online no momento/)).toBeTruthy();
    expect(screen.queryByText("Conversa com o suporte")).toBeNull();
  });

  it("depois do aviso, quando o suporte responde, a conversa abre e o aviso sai", async () => {
    callForSupport.mockResolvedValue({ ok: true, sessionId: "s9", status: "missed" });
    const user = userEvent.setup();
    render(<LiveSupportWidget userId="u1" initialSession={null} />);
    await user.click(screen.getByTitle("Chamar suporte"));
    await screen.findByText(/não está online no momento/);

    fire("support-user:u1", "chat-open", { sessionId: "s9" });

    expect(screen.getByText("Conversa com o suporte")).toBeTruthy();
    expect(screen.queryByText(/não está online no momento/)).toBeNull();
  });
});

describe("LiveSupportWidget — telas estreitas (celular)", () => {
  const ACTIVE = {
    id: "s1",
    status: "active" as const,
    initiatedBy: "user" as const,
    controlGranted: false,
  };

  it("a barra de sessão ativa quebra de linha e o botão Encerrar continua alcançável", () => {
    render(<LiveSupportWidget userId="u1" initialSession={ACTIVE} />);

    const end = screen.getByRole("button", { name: /^Encerrar$/ });
    const banner = end.closest("div.bg-blue-600");
    expect(banner).toBeTruthy();
    expect(banner?.className).toContain("flex-wrap");
    // O texto longo cede espaço (encolhe/quebra) em vez de empurrar os controles para fora.
    const text = screen.getByText(/Sessão de suporte ativa/);
    expect(text.className).toContain("min-w-0");
    expect(text.className).toContain("basis-48");
  });

  it("os cartões fixos nunca passam da largura da tela", async () => {
    callForSupport.mockResolvedValue({ ok: true, sessionId: "s9", status: "missed" });
    const user = userEvent.setup();
    render(<LiveSupportWidget userId="u1" initialSession={null} />);

    await user.click(screen.getByTitle("Chamar suporte"));

    const notice = (await screen.findByText(/não está online no momento/)).closest("[role=status]");
    expect(notice?.className).toContain("max-w-[calc(100vw-2rem)]");
  });

  it("o cartão de espera pelo atendimento quebra de linha e mantém o Cancelar visível", () => {
    render(
      <LiveSupportWidget
        userId="u1"
        initialSession={{
          id: "s1",
          status: "pending",
          initiatedBy: "user",
          controlGranted: false,
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
        }}
      />,
    );

    const cancel = screen.getByRole("button", { name: "Cancelar" });
    expect(cancel.parentElement?.className).toContain("flex-wrap");
    expect(cancel.parentElement?.className).toContain("max-w-[calc(100vw-2rem)]");
  });
});
