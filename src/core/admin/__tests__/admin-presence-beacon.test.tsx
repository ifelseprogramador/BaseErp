import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const adminHeartbeat = vi.fn(async () => ({ ok: true }));
vi.mock("@/core/live-support/actions", () => ({ adminHeartbeat }));

const { AdminPresenceBeacon } = await import("../components/admin-presence-beacon");

function visibilidade(v: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: v, configurable: true });
}
const avancar = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
  vi.clearAllMocks();
  window.localStorage.clear();
  visibilidade("visible");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AdminPresenceBeacon (poucas chamadas)", () => {
  it("bate ao abrir e depois só a cada ~60 s, não a cada 20 s", async () => {
    render(<AdminPresenceBeacon />);
    expect(adminHeartbeat).toHaveBeenCalledTimes(1);
    await avancar(40_000); // dois ticks de 20 s, ainda dentro do intervalo
    expect(adminHeartbeat).toHaveBeenCalledTimes(1);
    await avancar(20_000);
    expect(adminHeartbeat).toHaveBeenCalledTimes(2);
  });

  it("aba em segundo plano não bate", async () => {
    visibilidade("hidden");
    render(<AdminPresenceBeacon />);
    await avancar(5 * 60_000);
    expect(adminHeartbeat).not.toHaveBeenCalled();
  });

  it("não bate se outra aba do navegador bateu há pouco", async () => {
    window.localStorage.setItem("admin-presence:last-beat", String(Date.now() - 5_000));
    render(<AdminPresenceBeacon />);
    expect(adminHeartbeat).not.toHaveBeenCalled();
    await avancar(60_000);
    expect(adminHeartbeat).toHaveBeenCalledTimes(1);
  });

  it("para depois de 20 min sem mexer na tela e volta a bater assim que a pessoa volta", async () => {
    render(<AdminPresenceBeacon />);
    await avancar(20 * 60_000); // ainda presente: bate de minuto em minuto
    const ate20 = adminHeartbeat.mock.calls.length;
    expect(ate20).toBeGreaterThan(10);
    await avancar(10 * 60_000); // ausente: nenhuma batida nova
    expect(adminHeartbeat.mock.calls.length).toBe(ate20);
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    expect(adminHeartbeat.mock.calls.length).toBe(ate20 + 1); // bate na hora
  });

  it("atividade da pessoa renova o prazo de ausência", async () => {
    render(<AdminPresenceBeacon />);
    await avancar(15 * 60_000);
    act(() => {
      window.dispatchEvent(new Event("keydown"));
    });
    const antes = adminHeartbeat.mock.calls.length;
    await avancar(15 * 60_000); // 30 min no total, mas só 15 desde a última atividade
    expect(adminHeartbeat.mock.calls.length).toBeGreaterThan(antes);
  });
});
