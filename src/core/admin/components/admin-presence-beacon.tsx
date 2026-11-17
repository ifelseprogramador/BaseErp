"use client";

import { useEffect } from "react";
import { adminHeartbeat } from "@/core/live-support/actions";
import {
  ADMIN_HEARTBEAT_INTERVAL_MS,
  ADMIN_IDLE_PAUSE_MS,
  shouldSendAdminHeartbeat,
} from "@/core/live-support/wait";

/** Última batida enviada por QUALQUER aba deste navegador (evita uma batida por aba). */
const LAST_BEAT_KEY = "admin-presence:last-beat";

function readLastBeat(): number | null {
  try {
    const n = Number(window.localStorage.getItem(LAST_BEAT_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeLastBeat(at: number) {
  try {
    window.localStorage.setItem(LAST_BEAT_KEY, String(at));
  } catch {
    // Sem localStorage: cada aba decide sozinha (só perde a economia entre abas).
  }
}

/**
 * Marca o dono da plataforma como ONLINE enquanto o painel `/admin` está em uso.
 * É isto que o "Chamar suporte" consulta no servidor: com batida recente, o pedido
 * espera atendimento; sem, vira "perdido" na hora e o Telegram avisa.
 *
 * Cada batida é uma função na Vercel e uma escrita no Supabase, então só bate
 * quando faz sentido (`shouldSendAdminHeartbeat`): aba visível, pessoa presente
 * (mexeu na tela nos últimos 20 min) e nenhuma outra aba bateu há pouco. A
 * decisão roda a cada 20 s no navegador, sem rede; a batida em si sai a cada ~60 s.
 * Ao voltar da ausência, bate na hora.
 */
export function AdminPresenceBeacon() {
  useEffect(() => {
    let lastActivityAt = Date.now();

    function tick() {
      const now = Date.now();
      const send = shouldSendAdminHeartbeat({
        now,
        lastBeatAt: readLastBeat(),
        lastActivityAt,
        visible: document.visibilityState === "visible",
      });
      if (!send) return;
      writeLastBeat(now);
      void adminHeartbeat();
    }

    function onActivity() {
      const now = Date.now();
      const wasIdle = now - lastActivityAt > ADMIN_IDLE_PAUSE_MS;
      lastActivityAt = now;
      if (wasIdle) tick();
    }

    tick();
    const interval = setInterval(tick, Math.min(20_000, ADMIN_HEARTBEAT_INTERVAL_MS));
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;
    for (const e of events)
      window.addEventListener(e, onActivity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      for (const e of events) window.removeEventListener(e, onActivity, { capture: true });
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return null;
}
