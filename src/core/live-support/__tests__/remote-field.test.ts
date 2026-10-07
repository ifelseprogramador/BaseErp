import { describe, expect, it } from "vitest";
import {
  elementAtFraction,
  readEditableField,
  type ElementLike,
} from "@/core/live-support/remote-field";

describe("readEditableField", () => {
  it("campo de texto devolve o texto que ele já tem", () => {
    expect(readEditableField({ tagName: "INPUT", type: "text", value: "Maria" })).toEqual({
      value: "Maria",
    });
    expect(readEditableField({ tagName: "textarea", value: "linha 1\nlinha 2" })).toEqual({
      value: "linha 1\nlinha 2",
    });
  });

  it.each(["", "search", "email", "url", "tel", "password", "number", "TEXT"])(
    "input do tipo '%s' recebe texto",
    (type) => {
      expect(readEditableField({ tagName: "INPUT", type, value: "x" })).not.toBeNull();
    },
  );

  it.each(["checkbox", "radio", "button", "submit", "file", "color", "range", "date", "hidden"])(
    "input do tipo '%s' NÃO abre o teclado",
    (type) => {
      expect(readEditableField({ tagName: "INPUT", type, value: "on" })).toBeNull();
    },
  );

  it("campo só de leitura ou desativado não é editável", () => {
    expect(
      readEditableField({ tagName: "INPUT", type: "text", value: "a", readOnly: true }),
    ).toBeNull();
    expect(
      readEditableField({ tagName: "INPUT", type: "text", value: "a", disabled: true }),
    ).toBeNull();
  });

  it("botão, link, texto solto e nada não são editáveis", () => {
    expect(readEditableField({ tagName: "BUTTON" })).toBeNull();
    expect(readEditableField({ tagName: "A" })).toBeNull();
    expect(readEditableField({ tagName: "DIV", textContent: "olá" })).toBeNull();
    expect(readEditableField(null)).toBeNull();
    expect(readEditableField(undefined)).toBeNull();
  });

  it("contenteditable é editável, mas sem texto base (não é um `value`)", () => {
    expect(readEditableField({ tagName: "DIV", isContentEditable: true })).toEqual({ value: "" });
  });

  it("input sem value legível começa vazio", () => {
    expect(readEditableField({ tagName: "INPUT", type: "text" })).toEqual({ value: "" });
  });
});

describe("elementAtFraction", () => {
  function iframeWith(el: ElementLike | null, width = "1000", height = "800") {
    const calls: [number, number][] = [];
    const iframe = {
      contentDocument: {
        elementFromPoint: (x: number, y: number) => {
          calls.push([x, y]);
          return el;
        },
      },
      getAttribute: (name: string) =>
        name === "width" ? width : name === "height" ? height : null,
      clientWidth: 0,
      clientHeight: 0,
    } as unknown as HTMLIFrameElement;
    return { iframe, calls };
  }

  it("converte a fração do toque em pixels da tela GRAVADA (sem depender do zoom)", () => {
    const target = { tagName: "INPUT", type: "text", value: "oi" };
    const { iframe, calls } = iframeWith(target);

    expect(elementAtFraction(iframe, 0.5, 0.25)).toBe(target);
    expect(calls).toEqual([[500, 200]]);
  });

  it("sem iframe, sem documento ou sem tamanho: null", () => {
    expect(elementAtFraction(null, 0.5, 0.5)).toBeNull();
    expect(
      elementAtFraction({ contentDocument: null } as unknown as HTMLIFrameElement, 0.5, 0.5),
    ).toBeNull();
    expect(elementAtFraction(iframeWith({}, "0", "0").iframe, 0.5, 0.5)).toBeNull();
  });
});
