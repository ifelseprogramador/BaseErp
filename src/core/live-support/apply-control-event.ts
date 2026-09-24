"use client";

import type { ControlEvent } from "./control-events";

/**
 * Aplica um evento de controle remoto recebido do admin na página REAL do
 * usuário (não é uma simulação numa iframe — é a página de verdade). Só
 * chamado quando `controlGranted` é true para a sessão.
 */
export function applyControlEvent(event: ControlEvent, cursorEl: HTMLElement | null) {
  const hasFrac = event.type === "move" || event.type === "click";
  const x = Math.round(hasFrac ? event.xFrac * window.innerWidth : 0);
  const y = Math.round(hasFrac ? event.yFrac * window.innerHeight : 0);

  if (event.type === "move") {
    if (cursorEl) {
      cursorEl.style.transform = `translate(${x}px, ${y}px)`;
    }
    const el = document.elementFromPoint(x, y);
    if (el) {
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: x, clientY: y }));
    }
    return;
  }

  if (event.type === "click") {
    const el = document.elementFromPoint(x, y);
    if (el instanceof HTMLElement) {
      el.focus?.({ preventScroll: true });
      el.click();
    }
    return;
  }

  if (event.type === "key") {
    applyKey(event.key);
  }

  if (event.type === "scroll") {
    window.scrollBy(event.deltaX, event.deltaY);
  }
}

function applyKey(key: string) {
  const el = document.activeElement;

  if (key === "Enter") {
    if (el instanceof HTMLInputElement && el.form) {
      el.form.requestSubmit();
    } else if (el instanceof HTMLElement) {
      el.click();
    }
    return;
  }

  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;

  if (key === "Backspace") {
    setNativeValue(el, el.value.slice(0, -1));
  } else if (key.length === 1) {
    setNativeValue(el, el.value + key);
  }
}

/**
 * React "sequestra" o setter nativo de `.value` para detectar mudanças —
 * atribuir `el.value = x` direto não dispara o `onChange`. Este é o
 * contorno padrão: chama o setter original da classe (HTMLInputElement),
 * não o que o React sobrescreveu na instância.
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
