"use client";

import { useSyncExternalStore } from "react";

/**
 * Aviso sonoro de mensagem nova no chat do suporte. Sintetizado com Web Audio
 * (dois tons curtos) — sem arquivo de áudio para baixar. O navegador só toca
 * som depois de a pessoa ter interagido com a página (política de
 * autoplay); como ela sempre clicou em algo para chegar até aqui ("Chamar
 * suporte", "Permitir", "Solicitar acesso"), na prática toca. Se o navegador
 * recusar, falha em silêncio — o contador de não lidas continua avisando.
 *
 * A preferência (som ligado/desligado) fica no `localStorage`. Lida por
 * `useSyncExternalStore` — com o servidor sempre "ligado" — para não gerar
 * diferença entre o HTML do servidor e o do navegador.
 */
const STORAGE_KEY = "support-chat-sound";

let audioContext: AudioContext | null = null;
const listeners = new Set<() => void>();

export function isSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // armazenamento bloqueado: vale só até recarregar
  }
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, isSoundEnabled, () => true);
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  // Ataque e queda curtos para não estalar.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Toca o "ding" de mensagem nova. Nunca lança. */
export function playChatSound() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioContext ??= new Ctx();
    const ctx = audioContext;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    tone(ctx, 880, now, 0.14);
    tone(ctx, 1174.66, now + 0.14, 0.2);
  } catch {
    // sem áudio disponível: segue sem som
  }
}

let originalTitle: string | null = null;

/** Com a aba em segundo plano, destaca o título até a pessoa voltar. */
export function flashTabTitle(text: string) {
  if (document.visibilityState !== "hidden") return;
  originalTitle ??= document.title;
  document.title = text;
  const restore = () => {
    if (document.visibilityState !== "visible") return;
    if (originalTitle !== null) document.title = originalTitle;
    originalTitle = null;
    document.removeEventListener("visibilitychange", restore);
  };
  document.addEventListener("visibilitychange", restore);
}
