"use client";

import { useImperativeHandle, useRef } from "react";
import { Eraser, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeTextDelta, type ControlEvent } from "../control-events";

/** O que o espelho pode pedir ao campo de digitação. */
export interface RemoteTypingHandle {
  /** Leva o foco ao campo (abre o teclado do celular — chamar dentro de um toque). */
  focus: () => void;
  /** Tira o foco (fecha o teclado). */
  blur: () => void;
  /**
   * Faz o campo COMEÇAR com o texto que o campo remoto já tem: assim o que o dono
   * apaga e digita é relativo a esse texto (apagar o último caractere apaga o
   * último caractere de verdade, em vez de não fazer nada).
   */
  setBase: (text: string) => void;
  isFocused: () => boolean;
}

/** Quantos caracteres "Limpar" manda apagar (mais que qualquer campo comum). */
const CLEAR_ALL = 100_000;

/**
 * Campo de digitação do DONO para escrever no campo que ele tocou na tela da
 * pessoa. No computador o teclado físico já é repassado (`keydown` na janela);
 * no celular isso não funciona — o teclado virtual só aparece para um campo
 * REAL e focado, e muitos teclados (Gboard) nem informam a tecla no `keydown`.
 * Este campo fica focado (o teclado não some) e repassa o que muda como
 * "apagar N + escrever X" (`computeTextDelta`), que também acompanha a
 * correção automática de palavras. Enter envia a tecla Enter e limpa o campo;
 * "Limpar campo" apaga tudo que está no campo remoto.
 */
export function RemoteTypingInput({
  onControl,
  handleRef,
}: {
  onControl: (event: ControlEvent) => void;
  handleRef?: React.Ref<RemoteTypingHandle>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previous = useRef("");

  useImperativeHandle(handleRef, () => ({
    focus: () => inputRef.current?.focus({ preventScroll: true }),
    blur: () => inputRef.current?.blur(),
    isFocused: () => document.activeElement === inputRef.current,
    setBase: (text: string) => {
      if (inputRef.current) inputRef.current.value = text;
      previous.current = text;
    },
  }));

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
    // Ao sair do campo, recomeça do zero: o texto base é lido de novo no próximo toque.
    e.currentTarget.value = "";
    previous.current = "";
  }

  function handleClear() {
    onControl({ type: "text", text: "", deleteCount: CLEAR_ALL });
    if (inputRef.current) inputRef.current.value = "";
    previous.current = "";
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <label
        htmlFor="remote-typing-input"
        className="text-muted-foreground flex items-center gap-1.5"
      >
        <Keyboard className="h-3.5 w-3.5" />
        Toque num campo de texto na tela da pessoa e digite aqui
      </label>
      <div className="flex gap-2">
        <Input
          id="remote-typing-input"
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          // `onMouseDown`: não deixa o botão roubar o foco do campo (o teclado não fecha).
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          title="Apaga todo o texto do campo da pessoa"
        >
          <Eraser className="h-4 w-4" />
          Limpar campo
        </Button>
      </div>
    </div>
  );
}
