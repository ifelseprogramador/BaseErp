import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyControlEvent } from "@/core/live-support/apply-control-event";
import { computeTextDelta, type ControlEvent } from "@/core/live-support/control-events";
import { RemoteTypingInput } from "@/core/live-support/components/remote-typing-input";

afterEach(cleanup);

describe("computeTextDelta", () => {
  it.each([
    ["", "a", { deleteCount: 0, text: "a" }],
    ["ab", "abc", { deleteCount: 0, text: "c" }],
    ["abc", "ab", { deleteCount: 1, text: "" }],
    ["abc", "", { deleteCount: 3, text: "" }],
    ["", "", { deleteCount: 0, text: "" }],
    // teclado de celular reescrevendo a palavra durante a composição
    ["cafe", "café", { deleteCount: 1, text: "é" }],
    ["ola", "olá mundo", { deleteCount: 1, text: "á mundo" }],
    // colar por cima de parte do texto
    ["abcdef", "abXY", { deleteCount: 4, text: "XY" }],
  ])("%j → %j", (previous, next, expected) => {
    expect(computeTextDelta(previous, next)).toEqual(expected);
  });

  it("aplicar o delta ao texto anterior sempre reproduz o texto novo", () => {
    const pairs = [
      ["", "teste"],
      ["teste", "tes"],
      ["maria", "mário"],
      ["abc", "xyz"],
      ["um dois", "um"],
    ];
    for (const [previous, next] of pairs) {
      const { deleteCount, text } = computeTextDelta(previous, next);
      expect(previous.slice(0, previous.length - deleteCount) + text).toBe(next);
    }
  });
});

describe("applyControlEvent — texto vindo do celular do dono", () => {
  function focused<T extends HTMLInputElement | HTMLTextAreaElement>(el: T, value = "") {
    document.body.appendChild(el);
    el.value = value;
    el.focus();
    return el;
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("escreve no campo focado e dispara o evento de input (o React enxerga a mudança)", () => {
    const input = focused(document.createElement("input"), "Mar");
    const onInput = vi.fn();
    input.addEventListener("input", onInput);

    applyControlEvent({ type: "text", text: "ia", deleteCount: 0 }, null);

    expect(input.value).toBe("Maria");
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it("apaga do fim antes de escrever (correção de palavra)", () => {
    const input = focused(document.createElement("input"), "cafe");

    applyControlEvent({ type: "text", text: "é", deleteCount: 1 }, null);

    expect(input.value).toBe("café");
  });

  it("funciona em textarea e nunca apaga mais do que existe", () => {
    const area = focused(document.createElement("textarea"), "oi");

    applyControlEvent({ type: "text", text: "!", deleteCount: 99 }, null);

    expect(area.value).toBe("!");
  });

  it("sem campo de texto focado na tela da pessoa, não faz nada", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    expect(() =>
      applyControlEvent({ type: "text", text: "x", deleteCount: 0 }, null),
    ).not.toThrow();
  });
});

describe("RemoteTypingInput", () => {
  function setup() {
    const sent: ControlEvent[] = [];
    render(<RemoteTypingInput onControl={(event) => sent.push(event)} />);
    return { sent, input: screen.getByLabelText("Digitar na tela da pessoa") as HTMLInputElement };
  }

  it("repassa cada letra digitada como texto", async () => {
    const user = userEvent.setup();
    const { sent, input } = setup();

    await user.click(input);
    await user.keyboard("oi");

    expect(sent).toEqual([
      { type: "text", text: "o", deleteCount: 0 },
      { type: "text", text: "i", deleteCount: 0 },
    ]);
  });

  it("apagar vira 'apagar 1'", async () => {
    const user = userEvent.setup();
    const { sent, input } = setup();

    await user.click(input);
    await user.keyboard("ab{Backspace}");

    expect(sent.at(-1)).toEqual({ type: "text", text: "", deleteCount: 1 });
  });

  it("teclado que reescreve a palavra (café) manda só o que mudou", () => {
    const { sent, input } = setup();

    fireEvent.input(input, { target: { value: "cafe" } });
    fireEvent.input(input, { target: { value: "café" } });

    expect(sent).toEqual([
      { type: "text", text: "cafe", deleteCount: 0 },
      { type: "text", text: "é", deleteCount: 1 },
    ]);
  });

  it("Enter envia a tecla Enter e limpa o campo para a próxima", async () => {
    const user = userEvent.setup();
    const { sent, input } = setup();

    await user.click(input);
    await user.keyboard("ok{Enter}x");

    expect(sent).toContainEqual({ type: "key", key: "Enter" });
    expect(sent.at(-1)).toEqual({ type: "text", text: "x", deleteCount: 0 });
    expect(input.value).toBe("x");
  });

  it("ao sair do campo, recomeça do zero (não apaga o que já foi para a tela dela)", async () => {
    const user = userEvent.setup();
    const { sent, input } = setup();

    await user.click(input);
    await user.keyboard("ab");
    await user.tab();
    await user.click(input);
    await user.keyboard("c");

    expect(sent.at(-1)).toEqual({ type: "text", text: "c", deleteCount: 0 });
  });
});
