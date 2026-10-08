import { describe, expect, it } from "vitest";
import { isDegenerateViewportEvent } from "../replay-events";

describe("isDegenerateViewportEvent", () => {
  it("descarta Meta e ViewportResize com tamanho 0 (aba em segundo plano)", () => {
    expect(isDegenerateViewportEvent({ type: 4, data: { width: 0, height: 0 } })).toBe(true);
    expect(isDegenerateViewportEvent({ type: 4, data: { width: 800, height: 0 } })).toBe(true);
    expect(isDegenerateViewportEvent({ type: 3, data: { source: 4, width: 0, height: 600 } })).toBe(
      true,
    );
  });

  it("mantém eventos com tamanho real e eventos de outro tipo", () => {
    expect(isDegenerateViewportEvent({ type: 4, data: { width: 1280, height: 720 } })).toBe(false);
    expect(
      isDegenerateViewportEvent({ type: 3, data: { source: 4, width: 390, height: 700 } }),
    ).toBe(false);
    expect(isDegenerateViewportEvent({ type: 3, data: { source: 0 } })).toBe(false);
    expect(isDegenerateViewportEvent({ type: 2, data: {} })).toBe(false);
    expect(isDegenerateViewportEvent(null)).toBe(false);
  });
});
