"use client";

import { useEffect } from "react";
import { adminHeartbeat } from "@/core/live-support/actions";
import { ADMIN_HEARTBEAT_INTERVAL_MS } from "@/core/live-support/wait";

/**
 * Marca o dono da plataforma como ONLINE enquanto o painel `/admin` está
 * aberto numa aba visível: bate presença na hora e a cada ~20 s. É isto que o
 * "Chamar suporte" consulta no servidor — com batida recente, o pedido espera
 * atendimento; sem, vira "perdido" na hora e o Telegram avisa. Aba em segundo
 * plano não bate (você não está olhando, então não está "online").
 */
export function AdminPresenceBeacon() {
  useEffect(() => {
    function beat() {
      if (document.visibilityState === "visible") void adminHeartbeat();
    }
    beat();
    const interval = setInterval(beat, ADMIN_HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  return null;
}
