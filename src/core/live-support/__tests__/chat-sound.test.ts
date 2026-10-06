import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  flashTabTitle,
  isSoundEnabled,
  playChatSound,
  setSoundEnabled,
} from "@/core/live-support/chat-sound";

function stubAudioContext(state: "running" | "suspended" = "running") {
  const oscillators: { start: ReturnType<typeof vi.fn>; frequency: { value: number } }[] = [];
  const resume = vi.fn().mockResolvedValue(undefined);
  class FakeAudioContext {
    state = state;
    currentTime = 0;
    destination = {};
    resume = resume;
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: (node: unknown) => node,
      };
    }
    createOscillator() {
      const osc = {
        type: "",
        frequency: { value: 0 },
        connect: () => ({ connect: () => ({}) }),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(window, "AudioContext", { value: FakeAudioContext, configurable: true });
  return { oscillators, resume };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "AudioContext");
});

describe("playChatSound", () => {
  it("toca dois tons e retoma o áudio quando o navegador o deixou suspenso", async () => {
    const { oscillators, resume } = stubAudioContext("suspended");
    // O contexto é criado uma vez e reaproveitado entre testes: reinicia o módulo.
    vi.resetModules();
    const fresh = await import("@/core/live-support/chat-sound");

    fresh.playChatSound();

    expect(oscillators).toHaveLength(2);
    expect(oscillators.map((o) => o.frequency.value)).toEqual([880, 1174.66]);
    expect(resume).toHaveBeenCalled();
  });

  it("sem Web Audio no navegador, não lança", () => {
    expect(() => playChatSound()).not.toThrow();
  });
});

describe("preferência de som", () => {
  it("começa ligado e guarda o que a pessoa escolher", () => {
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    expect(window.localStorage.getItem("support-chat-sound")).toBe("off");
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });
});

describe("flashTabTitle", () => {
  function setVisibility(value: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", { value, configurable: true });
  }

  afterEach(() => {
    setVisibility("visible");
    document.title = "";
  });

  it("com a aba visível, não mexe no título", () => {
    document.title = "Painel";
    setVisibility("visible");
    flashTabTitle("💬 Nova mensagem");
    expect(document.title).toBe("Painel");
  });

  it("com a aba em segundo plano, destaca e restaura ao voltar", () => {
    document.title = "Painel";
    setVisibility("hidden");
    flashTabTitle("💬 Nova mensagem");
    expect(document.title).toBe("💬 Nova mensagem");

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(document.title).toBe("Painel");
  });
});
