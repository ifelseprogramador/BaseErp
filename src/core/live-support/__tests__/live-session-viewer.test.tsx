import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("LiveSessionViewer — celular com controle remoto liberado", () => {
  const MIRROR = '[class*="h-[75vh]"]';

  function renderActive(granted = true) {
    render(
      <LiveSessionViewer
        sessionId="s1"
        initialStatus="active"
        initialControlGranted={granted}
        onEnded={() => {}}
      />,
    );
    return document.querySelector(MIRROR) as HTMLElement;
  }

  function controlsSent() {
    return channel.send.mock.calls
      .map(([message]) => message as { event: string; payload: { type: string } })
      .filter((message) => message.event === "control-input")
      .map((message) => message.payload);
  }

  /** Coloca um iframe falso no espelho cujo ponto tocado devolve `target`. */
  function mountIframe(container: HTMLElement, target: unknown) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("width", "1000");
    iframe.setAttribute("height", "800");
    container.appendChild(iframe);
    Object.defineProperty(iframe, "contentDocument", {
      value: { elementFromPoint: () => target },
      configurable: true,
    });
    iframe.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 }) as DOMRect;
    return iframe;
  }

  beforeEach(() => {
    channel.send.mockClear();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });

  describe("teclado", () => {
    it("tocar num campo de texto abre o teclado já com o texto que o campo tem", () => {
      const container = renderActive();
      mountIframe(container, { tagName: "INPUT", type: "text", value: "Maria Silva" });

      fireEvent.click(container, { clientX: 500, clientY: 400 });

      const typing = screen.getByLabelText("Digitar na tela da pessoa") as HTMLInputElement;
      expect(document.activeElement).toBe(typing);
      expect(typing.value).toBe("Maria Silva");
      expect(controlsSent()).toContainEqual(expect.objectContaining({ type: "click" }));
    });

    it("tocar num botão NÃO abre o teclado", () => {
      const container = renderActive();
      mountIframe(container, { tagName: "BUTTON" });

      fireEvent.click(container, { clientX: 500, clientY: 400 });

      expect(document.activeElement).not.toBe(screen.getByLabelText("Digitar na tela da pessoa"));
      // O clique ainda chega ao botão na tela da pessoa.
      expect(controlsSent()).toContainEqual(expect.objectContaining({ type: "click" }));
    });

    it("tocar em texto solto ou checkbox também não abre o teclado", () => {
      const container = renderActive();
      const typing = screen.getByLabelText("Digitar na tela da pessoa") as HTMLInputElement;
      const iframe = mountIframe(container, { tagName: "DIV", textContent: "olá" });

      fireEvent.click(container);
      expect(document.activeElement).not.toBe(typing);

      Object.defineProperty(iframe, "contentDocument", {
        value: { elementFromPoint: () => ({ tagName: "INPUT", type: "checkbox", value: "on" }) },
        configurable: true,
      });
      fireEvent.click(container);
      expect(document.activeElement).not.toBe(typing);
    });

    it("tocar fora de um campo fecha o teclado que estava aberto", () => {
      const container = renderActive();
      const iframe = mountIframe(container, { tagName: "INPUT", type: "text", value: "x" });
      fireEvent.click(container);
      const typing = screen.getByLabelText("Digitar na tela da pessoa");
      expect(document.activeElement).toBe(typing);

      Object.defineProperty(iframe, "contentDocument", {
        value: { elementFromPoint: () => ({ tagName: "BUTTON" }) },
        configurable: true,
      });
      fireEvent.click(container);

      expect(document.activeElement).not.toBe(typing);
    });
  });

  describe("lista suspensa (<select>)", () => {
    const select = {
      tagName: "SELECT",
      selectedIndex: 0,
      options: [{ text: "Pix" }, { text: "Dinheiro" }, { text: "Cartão", disabled: true }],
    };

    it("tocar num <select> mostra as opções e não manda clique", () => {
      const container = renderActive();
      mountIframe(container, select);

      fireEvent.click(container, { clientX: 500, clientY: 400 });

      expect(screen.getByRole("option", { name: "Dinheiro" })).toBeTruthy();
      expect(controlsSent()).toHaveLength(0);
    });

    it("escolher uma opção manda só o índice dela e fecha a lista", () => {
      const container = renderActive();
      mountIframe(container, select);
      fireEvent.click(container, { clientX: 500, clientY: 400 });

      fireEvent.click(screen.getByRole("option", { name: "Dinheiro" }));

      expect(controlsSent()).toEqual([{ type: "select", xFrac: 0.5, yFrac: 0.5, index: 1 }]);
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("opção desativada não pode ser escolhida", () => {
      const container = renderActive();
      mountIframe(container, select);
      fireEvent.click(container);
      expect((screen.getByRole("option", { name: "Cartão" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });

  describe("rolar a tela da pessoa", () => {
    it("arrastar DOIS dedos para cima rola a página dela para baixo", () => {
      const container = renderActive();

      fireEvent.touchStart(container, {
        touches: [
          { clientX: 100, clientY: 300 },
          { clientX: 100, clientY: 300 },
        ],
      });
      fireEvent.touchMove(container, {
        touches: [
          { clientX: 100, clientY: 200 },
          { clientX: 100, clientY: 200 },
        ],
      });

      expect(controlsSent()).toContainEqual({ type: "scroll", deltaX: 0, deltaY: 100 });
    });

    it("dois dedos para baixo rolam para cima; para os lados rola na horizontal", () => {
      const container = renderActive();

      fireEvent.touchStart(container, {
        touches: [
          { clientX: 200, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ],
      });
      fireEvent.touchMove(container, {
        touches: [
          { clientX: 150, clientY: 160 },
          { clientX: 150, clientY: 160 },
        ],
      });

      expect(controlsSent()).toContainEqual({ type: "scroll", deltaX: 50, deltaY: -60 });
    });

    it("movimento mínimo é um toque, não uma rolagem", () => {
      const container = renderActive();

      fireEvent.touchStart(container, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 100, clientY: 100 },
        ],
      });
      fireEvent.touchMove(container, {
        touches: [
          { clientX: 102, clientY: 103 },
          { clientX: 102, clientY: 103 },
        ],
      });
      fireEvent.touchEnd(container);

      expect(controlsSent().filter((c) => c.type === "scroll")).toHaveLength(0);
    });

    it("depois de arrastar, o clique que o navegador dispara é ignorado", () => {
      const container = renderActive();
      mountIframe(container, { tagName: "BUTTON" });

      fireEvent.touchStart(container, {
        touches: [
          { clientX: 100, clientY: 300 },
          { clientX: 100, clientY: 300 },
        ],
      });
      fireEvent.touchMove(container, {
        touches: [
          { clientX: 100, clientY: 200 },
          { clientX: 100, clientY: 200 },
        ],
      });
      fireEvent.touchEnd(container);
      fireEvent.click(container, { clientX: 100, clientY: 200 });

      expect(controlsSent().filter((c) => c.type === "click")).toHaveLength(0);
    });

    it("um toque simples continua sendo um clique", () => {
      const container = renderActive();
      mountIframe(container, { tagName: "BUTTON" });

      fireEvent.touchStart(container, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 100, clientY: 100 },
        ],
      });
      fireEvent.touchEnd(container);
      fireEvent.click(container, { clientX: 100, clientY: 100 });

      expect(controlsSent().filter((c) => c.type === "click")).toHaveLength(1);
    });

    it("sem o controle liberado, arrastar não manda nada (e o espelho rola só localmente)", () => {
      const container = renderActive(false);

      fireEvent.touchStart(container, {
        touches: [
          { clientX: 100, clientY: 300 },
          { clientX: 100, clientY: 300 },
        ],
      });
      fireEvent.touchMove(container, {
        touches: [
          { clientX: 100, clientY: 200 },
          { clientX: 100, clientY: 200 },
        ],
      });

      expect(controlsSent()).toHaveLength(0);
      expect(container.style.touchAction).toBe("");
    });

    it("com o controle liberado, um dedo segue rolando o lado do dono (pan) e o zoom de pinça fica desligado", () => {
      const container = renderActive();
      expect(container.style.touchAction).toBe("pan-x pan-y");
    });

    it("um dedo só nunca rola a tela da pessoa (rola o lado do dono)", () => {
      const container = renderActive();

      fireEvent.touchStart(container, { touches: [{ clientX: 100, clientY: 300 }] });
      fireEvent.touchMove(container, { touches: [{ clientX: 100, clientY: 200 }] });
      fireEvent.touchEnd(container);

      expect(controlsSent().filter((c) => c.type === "scroll")).toHaveLength(0);
    });

    it("dois dedos não deixam o navegador rolar o lado do dono", () => {
      const container = renderActive();
      const two = [
        { clientX: 100, clientY: 300 },
        { clientX: 120, clientY: 300 },
      ];
      const ev = new Event("touchmove", { cancelable: true, bubbles: true });
      Object.defineProperty(ev, "touches", { value: two });
      container.dispatchEvent(ev);

      expect(ev.defaultPrevented).toBe(true);
    });

    it("botões da conversa mandam recolher e mover a caixa dela", () => {
      renderActive();

      fireEvent.click(screen.getByRole("button", { name: /Recolher\/expandir/ }));
      fireEvent.click(screen.getByRole("button", { name: "Mover a conversa dela para esquerda" }));

      expect(controlsSent()).toEqual([
        { type: "panel", action: "toggle" },
        { type: "panel", action: "left" },
      ]);
    });

    it("os botões de rolar andam a página da pessoa para cima e para baixo", () => {
      renderActive();

      fireEvent.click(screen.getByRole("button", { name: "Rolar a tela da pessoa para baixo" }));
      fireEvent.click(screen.getByRole("button", { name: "Rolar a tela da pessoa para cima" }));

      expect(controlsSent()).toEqual([
        { type: "scroll", deltaX: 0, deltaY: 300 },
        { type: "scroll", deltaX: 0, deltaY: -300 },
      ]);
    });

    it("sem o controle liberado, os botões de rolar nem aparecem", () => {
      renderActive(false);
      expect(
        screen.queryByRole("button", { name: "Rolar a tela da pessoa para baixo" }),
      ).toBeNull();
    });
  });
});
