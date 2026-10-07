"use client";

import { useRef } from "react";
import { Keyboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { computeTextDelta, type ControlEvent } from "../control-events";

/**
 * Campo de digitação do DONO para escrever no campo que ele tocou na tela da
 * pessoa. No computador o teclado físico já é repassado (`keydown` na janela);
 * no celular isso não funciona — o teclado virtual só aparece para um campo
 * REAL e focado, e muitos teclados (Gboard) nem informam a tecla no `keydown`.
 * Este campo fica focado (o teclado não some) e repassa o que muda como
 * "apagar N + escrever X" (`computeTextDelta`), que também acompanha a
 * correção automática de palavras. Enter envia a tecla Enter e limpa o campo.
 */
export function RemoteTypingInput({
  onControl,
  inputRef,
}: {
  onControl: (event: ControlEvent) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const previous = useRef("");

  function handleInput(e: React.FormEvent<HTMLInputElement>) {
    const next = e.currentTarget.value;
    const delta = computeTextDelta(previous.current, next);
    previous.current = next;
    if (delta.deleteCount === 0 && delta.text === "") return;
    onControl({ type: "text", text: delta.text, deleteCount: delta.deleteCount });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    onControl({ type: "key", key: "Enter" });
    e.currentTarget.value = "";
    previous.current = "";
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    // Ao sair do campo, recomeça do zero: o que foi digitado já está na tela dela.
    e.currentTarget.value = "";
    previous.current = "";
  }

  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground flex items-center gap-1.5">
        <Keyboard className="h-3.5 w-3.5" />
        Toque num campo na tela da pessoa e digite aqui
      </span>
      <Input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        placeholder="Digitar na tela da pessoa..."
        aria-label="Digitar na tela da pessoa"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </label>
  );
}
