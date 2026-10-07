import { afterEach, describe, expect, it, vi } from "vitest";
import { applyControlEvent } from "../apply-control-event";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function stubElementAt(el: Element | null) {
  document.elementFromPoint = vi.fn(() => el);
}

describe("applyControlEvent", () => {
  it("clique percorre pointerdown/mousedown antes do click (menus abrem ao apertar)", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    stubElementAt(button);
    const seen: string[] = [];
    for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
      button.addEventListener(type, () => seen.push(type));
    }

    applyControlEvent({ type: "click", xFrac: 0.5, yFrac: 0.5 }, null);

    expect(seen.indexOf("mousedown")).toBeLessThan(seen.indexOf("click"));
    expect(seen).toContain("mouseup");
    expect(seen.filter((t) => t === "click")).toHaveLength(1);
  });

  it("select escolhe a opção pelo índice e avisa o formulário", () => {
    const select = document.createElement("select");
    select.innerHTML = "<option>Pix</option><option>Dinheiro</option>";
    document.body.appendChild(select);
    stubElementAt(select);
    const onChange = vi.fn();
    select.addEventListener("change", onChange);

    applyControlEvent({ type: "select", xFrac: 0.1, yFrac: 0.1, index: 1 }, null);

    expect(select.selectedIndex).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("select ignora opção desativada ou inexistente", () => {
    const select = document.createElement("select");
    select.innerHTML = "<option>Pix</option><option disabled>Cartão</option>";
    document.body.appendChild(select);
    stubElementAt(select);

    applyControlEvent({ type: "select", xFrac: 0, yFrac: 0, index: 1 }, null);
    applyControlEvent({ type: "select", xFrac: 0, yFrac: 0, index: 9 }, null);

    expect(select.selectedIndex).toBe(0);
  });
});
