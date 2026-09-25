"use client";

import { useEffect } from "react";

/**
 * Corrige um problema real de ambiente de desenvolvimento: como vários
 * projetos deste "meta-produto" (BaseERP e cada vertical, ex. mecano-erp)
 * costumam rodar em `npm run dev` na mesma porta (3000) em momentos
 * diferentes, um service worker registrado por um deles (mecano-erp tem
 * um de verdade, para o modo offline — `public/sw.js`) fica associado à
 * origem `http://localhost:3000` no navegador, não ao projeto. Ao abrir
 * este projeto na mesma porta depois, esse service worker antigo pode
 * responder com uma página em cache do OUTRO projeto (sintoma relatado:
 * a tela pisca com a cor/tema de outro sistema antes do F5 corrigir).
 *
 * Este projeto ainda não tem service worker próprio (PWA/offline é uma
 * fase futura do plano) — então é seguro desregistrar qualquer um
 * encontrado e limpar o cache dele. Se este projeto ganhar seu próprio
 * `sw.js` no futuro, este componente deve ser removido (ou ajustado para
 * poupar o registro correto) para não desfazer o próprio cache offline.
 */
export function StaleServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });

    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      });
    }
  }, []);

  return null;
}
