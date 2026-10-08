import { afterEach, describe, expect, it, vi } from "vitest";

const getNode = vi.fn();
vi.mock("rrweb", () => ({ record: { mirror: { getNode: (id: number) => getNode(id) } } }));

import { applyControlEvent } from "../apply-control-event";

afterEach(() => {
  document.body.innerHTML = "";
  getNode.mockReset();
});

describe("escolha em <select> pelo id do rrweb", () => {
  it("acha o <select> exato mesmo com coordenadas que apontam para outro lugar", async () => {
    const target = document.createElement("select");
    target.innerHTML = "<option>Pix</option><option>Dinheiro</option>";
    document.body.appendChild(target);
    getNode.mockReturnValue(target);
    document.elementFromPoint = vi.fn(() => document.body);
    const onChange = vi.fn();
    target.addEventListener("change", onChange);

    applyControlEvent({ type: "select", xFrac: 0.9, yFrac: 0.9, index: 1, nodeId: 42 }, null);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

    expect(getNode).toHaveBeenCalledWith(42);
    expect(target.selectedIndex).toBe(1);
  });

  it("sem o nó no rrweb, cai para o <select> sob o ponto", async () => {
    const underPoint = document.createElement("select");
    underPoint.innerHTML = "<option>A</option><option>B</option>";
    document.body.appendChild(underPoint);
    getNode.mockReturnValue(null);
    document.elementFromPoint = vi.fn(() => underPoint);

    applyControlEvent({ type: "select", xFrac: 0.1, yFrac: 0.1, index: 1, nodeId: 7 }, null);
    await vi.waitFor(() => expect(underPoint.selectedIndex).toBe(1));
  });
});
