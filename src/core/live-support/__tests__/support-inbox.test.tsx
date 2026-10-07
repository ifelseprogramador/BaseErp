import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handlers: Record<string, (msg: { payload: Record<string, unknown> }) => void> = {};
const channel = {
  on(
    _type: string,
    filter: { event: string },
    cb: (msg: { payload: Record<string, unknown> }) => void,
  ) {
    handlers[filter.event] = cb;
    return channel;
  },
  subscribe: () => channel,
  unsubscribe: vi.fn(),
};
vi.mock("@/core/live-support/realtime", () => ({
  adminSupportInboxChannelName: () => "support-admin-inbox",
  getRealtimeChannel: () => channel,
}));

const acceptSupportRequest = vi.fn().mockResolvedValue({ ok: true });
const requestAccessToSession = vi.fn().mockResolvedValue({ ok: true });
const endLiveSession = vi.fn().mockResolvedValue({ ok: true });
const sendAdminMessage = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/core/live-support/actions", () => ({
  acceptSupportRequest: (...a: unknown[]) => acceptSupportRequest(...a),
  requestAccessToSession: (...a: unknown[]) => requestAccessToSession(...a),
  endLiveSession: (...a: unknown[]) => endLiveSession(...a),
  sendAdminMessage: (...a: unknown[]) => sendAdminMessage(...a),
}));

const playChatSound = vi.fn();
vi.mock("@/core/live-support/chat-sound", () => ({
  playChatSound: () => playChatSound(),
}));
vi.mock("@/core/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { SupportInbox } = await import("@/core/admin/components/support-inbox");

const MISSED = {
  sessionId: "s1",
  organizationId: "o1",
  organizationName: "Oficina X",
  userName: "Maria",
  status: "missed" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(handlers)) delete handlers[key];
});
afterEach(cleanup);

describe("SupportInbox", () => {
  it("sem pedidos, não mostra nada", () => {
    const { container } = render(<SupportInbox initialRequests={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("pedido sem atendimento oferece pedir a tela, enviar mensagem e encerrar", () => {
    render(<SupportInbox initialRequests={[MISSED]} />);

    expect(screen.getByRole("button", { name: "Pedir acesso à tela" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Enviar mensagem/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Encerrar o pedido de Maria/ })).toBeTruthy();
  });

  it("enviar mensagem escreve sem pedir a tela e o pedido vira conversa por texto", async () => {
    const user = userEvent.setup();
    render(<SupportInbox initialRequests={[MISSED]} />);

    await user.click(screen.getByRole("button", { name: /Enviar mensagem/ }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Mensagem"), "Já te ajudo");
    await user.click(within(dialog).getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(sendAdminMessage).toHaveBeenCalledWith("s1", "Já te ajudo"));
    expect(requestAccessToSession).not.toHaveBeenCalled();
    expect(await screen.findByText("Conversa por texto")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir conversa" })).toBeTruthy();
    // Numa conversa por texto, o atalho de mensagem some (escreve-se na ficha).
    expect(screen.queryByRole("button", { name: /Enviar mensagem/ })).toBeNull();
  });

  it("a mensagem vazia não envia", async () => {
    const user = userEvent.setup();
    render(<SupportInbox initialRequests={[MISSED]} />);

    await user.click(screen.getByRole("button", { name: /Enviar mensagem/ }));

    expect(
      (
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Enviar",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(sendAdminMessage).not.toHaveBeenCalled();
  });

  it("encerrar pede confirmação e então descarta o pedido", async () => {
    const user = userEvent.setup();
    render(<SupportInbox initialRequests={[MISSED]} />);

    await user.click(screen.getByRole("button", { name: /Encerrar o pedido de Maria/ }));
    expect(endLiveSession).not.toHaveBeenCalled();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Encerrar pedido" }),
    );

    await waitFor(() => expect(endLiveSession).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(screen.queryByText("Maria")).toBeNull());
  });

  it("voltar na confirmação não encerra nada", async () => {
    const user = userEvent.setup();
    render(<SupportInbox initialRequests={[MISSED]} />);

    await user.click(screen.getByRole("button", { name: /Encerrar o pedido de Maria/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Voltar" }));

    expect(endLiveSession).not.toHaveBeenCalled();
    expect(screen.getByText("Maria")).toBeTruthy();
  });

  it("mensagem nova da pessoa em tempo real toca o aviso e marca como conversa", () => {
    render(<SupportInbox initialRequests={[MISSED]} />);

    act(() =>
      handlers["chat-message"]({
        payload: {
          sessionId: "s1",
          organizationId: "o1",
          organizationName: "Oficina X",
          userName: "Maria",
          preview: "ainda preciso de ajuda",
        },
      }),
    );

    expect(playChatSound).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Conversa por texto")).toBeTruthy();
  });
});
