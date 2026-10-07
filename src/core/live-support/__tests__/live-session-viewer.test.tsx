import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const channel = {
  on: () => channel,
  subscribe: () => channel,
  unsubscribe: vi.fn(),
  send: vi.fn(),
};
vi.mock("@/core/live-support/realtime", () => ({
  liveSessionChannelName: (id: string) => `live-session:${id}`,
  getRealtimeChannel: () => channel,
}));
vi.mock("@/core/live-support/actions", () => ({
  endLiveSession: vi.fn().mockResolvedValue({ ok: true }),
  getFullSnapshot: vi.fn().mockResolvedValue({ ok: true }),
  requestAccessToSession: vi.fn().mockResolvedValue({ ok: true }),
  cancelScreenRequest: vi.fn().mockResolvedValue({ ok: true }),
  listSupportMessages: vi.fn().mockResolvedValue({ ok: true, messages: [] }),
  sendSupportMessage: vi.fn(),
}));
vi.mock("rrweb", () => ({
  Replayer: vi.fn(),
  MouseInteractions: { Focus: 5, Blur: 6 },
  ReplayerEvents: { MouseInteraction: "mouse-interaction" },
}));
vi.mock("@/core/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { LiveSessionViewer } = await import("@/core/live-support/components/live-session-viewer");

beforeEach(() => {
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

describe("LiveSessionViewer — barra de controles no celular", () => {
  it("os botões ficam num grupo que quebra de linha (não estoura a tela estreita)", () => {
    render(
      <LiveSessionViewer
        sessionId="s1"
        initialStatus="chat"
        initialControlGranted={false}
        onEnded={() => {}}
      />,
    );

    const end = screen.getByRole("button", { name: "Encerrar conversa" });
    const request = screen.getByRole("button", { name: "Pedir acesso à tela" });

    // Os dois botões ficam no MESMO grupo de ações, e esse grupo e a barra toda quebram linha.
    expect(end.parentElement).toBe(request.parentElement);
    expect(end.parentElement?.className).toContain("flex-wrap");
    expect(end.parentElement?.parentElement?.className).toContain("flex-wrap");
  });

  it("o texto longo do estado quebra de linha em vez de empurrar os botões", () => {
    render(
      <LiveSessionViewer
        sessionId="s1"
        initialStatus="chat"
        initialScreenRequested
        initialControlGranted={false}
        onEnded={() => {}}
      />,
    );

    const badge = screen.getByText(/aguardando a pessoa liberar a tela/);
    expect(badge.className).toContain("whitespace-normal");
    expect(badge.className).toContain("max-w-full");
    expect(screen.getByRole("button", { name: "Cancelar pedido de tela" })).toBeTruthy();
  });

  it("pedido de acesso pendente mostra 'Cancelar pedido' em vez de 'Encerrar sessão'", () => {
    render(
      <LiveSessionViewer
        sessionId="s1"
        initialStatus="pending"
        initialControlGranted={false}
        onEnded={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Encerrar sessão" })).toBeNull();
  });
});
