"use client";

import type { ControlEvent } from "./control-events";

/**
 * Aplica um evento de controle remoto recebido do admin na página REAL do
 * usuário (não é uma simulação numa iframe — é a página de verdade). Só
 * chamado quando `controlGranted` é true para a sessão.
 */
export function applyControlEvent(event: ControlEvent, cursorEl: HTMLElement | null) {
  const hasFrac = event.type === "move" || event.type === "click" || event.type === "select";
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
      pressSequence(el, x, y);
      el.click();
    }
    return;
  }

  if (event.type === "select") {
    const byPoint = () => document.elementFromPoint(x, y)?.closest("select") ?? null;
    if (event.nodeId === undefined) {
      commitSelect(byPoint(), event.index);
    } else {
      // O `<select>` exato (o que o dono tocou no espelho), pelo id do rrweb — não
      // depende de as coordenadas do espelho e da página baterem ao pixel.
      void findRecordedSelect(event.nodeId).then((node) =>
        commitSelect(node ?? byPoint(), event.index),
      );
    }
    return;
  }

  if (event.type === "key") {
    applyKey(event.key);
  }

  if (event.type === "text") {
    applyText(event.text, event.deleteCount);
  }

  if (event.type === "panel") {
    applyPanel(event.action);
  }

  if (event.type === "scroll") {
    window.scrollBy(event.deltaX, event.deltaY);
  }
}

async function findRecordedSelect(nodeId: number): Promise<HTMLSelectElement | null> {
  try {
    const { record } = await import("rrweb");
    const node = record.mirror.getNode(nodeId);
    return node instanceof HTMLSelectElement ? node : null;
  } catch {
    return null;
  }
}

/** Escolhe a opção `index` e avisa o formulário (input + change). */
function commitSelect(select: HTMLSelectElement | null, index: number) {
  const option = select?.options[index];
  if (!select || !option || option.disabled) return;
  select.selectedIndex = index;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Menus e listas feitos em JS (Base UI/Radix) abrem no "apertar" do mouse
 * (pointerdown/mousedown), não no `click`. Só `el.click()` não os abria; este é o
 * mesmo caminho que um clique de verdade percorre antes do `click`.
 */
function pressSequence(el: HTMLElement, x: number, y: number) {
  const base = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
  if (typeof PointerEvent !== "undefined") {
    el.dispatchEvent(
      new PointerEvent("pointerdown", { ...base, pointerType: "mouse", isPrimary: true }),
    );
  }
  el.dispatchEvent(new MouseEvent("mousedown", base));
  if (typeof PointerEvent !== "undefined") {
    el.dispatchEvent(
      new PointerEvent("pointerup", { ...base, pointerType: "mouse", isPrimary: true }),
    );
  }
  el.dispatchEvent(new MouseEvent("mouseup", base));
}

const PANEL_KEYS = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" };
const PANEL_NUDGES = 3; // 3 passos de teclado (16 px cada) por toque

/** Recolhe/expande a caixa de conversa da pessoa, ou a empurra para um lado. */
function applyPanel(action: "toggle" | "left" | "right" | "up" | "down") {
  if (action === "toggle") {
    document
      .querySelector<HTMLElement>(
        '[aria-label="Recolher conversa"], [aria-label="Expandir conversa"]',
      )
      ?.click();
    return;
  }
  const bar = document.querySelector<HTMLElement>(
    '[role="group"][aria-label^="Barra da conversa"]',
  );
  for (let i = 0; i < PANEL_NUDGES; i += 1) {
    bar?.dispatchEvent(
      new KeyboardEvent("keydown", { key: PANEL_KEYS[action], bubbles: true, cancelable: true }),
    );
  }
}

/** Texto vindo do campo de digitação do admin (celular): edita o campo focado. */
function applyText(text: string, deleteCount: number) {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  const keep = Math.max(0, el.value.length - Math.max(0, deleteCount));
  setNativeValue(el, el.value.slice(0, keep) + text);
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
