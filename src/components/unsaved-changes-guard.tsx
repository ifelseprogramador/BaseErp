"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Avisa antes de sair de uma tela com alterações NÃO salvas. Funciona com um
 * atributo: todo `<form data-unsaved-guard>` passa a ser vigiado — mexeu em algum
 * campo, o formulário fica "sujo" até ser enviado. Enquanto houver um sujo:
 *  - clicar num link interno (menu, voltar para a lista…) abre a pergunta
 *    "Continuar editando / Descartar e sair / Salvar";
 *  - o botão Voltar do sistema (`guardNavigation`) faz o mesmo;
 *  - fechar a aba ou recarregar mostra o aviso do próprio navegador.
 * "Salvar" envia o formulário e FICA na tela: se o servidor recusar algum campo,
 * a pessoa vê o erro em vez de perder o que digitou ao sair.
 * Limite: o botão Voltar do navegador/celular não é interceptado.
 */

const GUARDED_FORM = "form[data-unsaved-guard]";
/** Valor-baseline que nunca é igual a um instantâneo: "já veio alterado". */
const ALWAYS_DIRTY = "\u0000alterado";

/**
 * "Sujo" = o conteúdo do formulário agora é diferente do que era quando a pessoa
 * começou a mexer. Comparamos o conteúdo (FormData) em vez de ouvir só `input`/
 * `change`, porque componentes como o Select e o Switch do Base UI trocam o valor
 * sem disparar nenhum evento nativo de formulário.
 */
const baselines = new Map<HTMLFormElement, string>();
let askBeforeLeaving: ((go: () => void) => void) | null = null;

function snapshot(form: HTMLFormElement): string {
  const entries: [string, string][] = [];
  new FormData(form).forEach((value, key) => {
    entries.push([key, typeof value === "string" ? value : value.name]);
  });
  return JSON.stringify(entries);
}

function rememberBaseline(form: HTMLFormElement | null, alreadyChanged = false) {
  if (form && !baselines.has(form))
    baselines.set(form, alreadyChanged ? ALWAYS_DIRTY : snapshot(form));
}

function dirtyFormList(): HTMLFormElement[] {
  const list: HTMLFormElement[] = [];
  for (const [form, baseline] of baselines) {
    if (!form.isConnected) baselines.delete(form);
    else if (snapshot(form) !== baseline) list.push(form);
  }
  return list;
}

function hasDirtyForm() {
  return dirtyFormList().length > 0;
}

/**
 * Para navegações feitas por código (ex.: o botão Voltar). Devolve `true` se há
 * alterações não salvas — a pergunta já foi aberta e `go` só roda se a pessoa
 * escolher sair; `false` se pode navegar na hora.
 */
export function guardNavigation(go: () => void): boolean {
  if (!askBeforeLeaving || !hasDirtyForm()) return false;
  askBeforeLeaving(go);
  return true;
}

function formOf(target: EventTarget | null): HTMLFormElement | null {
  return target instanceof Element
    ? (target.closest(GUARDED_FORM) as HTMLFormElement | null)
    : null;
}

export function UnsavedChangesGuard() {
  const router = useRouter();
  const [pendingGo, setPendingGo] = useState<(() => void) | null>(null);
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    // Antes de a pessoa mexer (foco, toque, tecla) guardamos o conteúdo original.
    function beforeEdit(event: Event) {
      rememberBaseline(formOf(event.target));
    }
    // Se só vimos a mudança (sem ter visto o antes), já conta como alterado.
    function afterEdit(event: Event) {
      const form = formOf(event.target);
      rememberBaseline(form, true);
      // Campo SEM `name` não entra no FormData: o evento é o único sinal que temos.
      const field = event.target;
      if (form && field instanceof Element && !field.getAttribute("name")) {
        baselines.set(form, ALWAYS_DIRTY);
      }
    }
    function markClean(event: Event) {
      const form = formOf(event.target);
      if (form) baselines.delete(form);
    }
    function scan(root: ParentNode) {
      root
        .querySelectorAll<HTMLFormElement>(GUARDED_FORM)
        .forEach((form) => rememberBaseline(form));
    }
    scan(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches(GUARDED_FORM)) rememberBaseline(node as HTMLFormElement);
            scan(node);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasDirtyForm()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!hasDirtyForm() || !(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) {
        return;
      }
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingGo(() => () => routerRef.current.push(url.pathname + url.search + url.hash));
    }

    askBeforeLeaving = (go) => setPendingGo(() => go);
    for (const type of ["focusin", "pointerdown", "keydown"]) {
      document.addEventListener(type, beforeEdit, true);
    }
    document.addEventListener("input", afterEdit, true);
    document.addEventListener("change", afterEdit, true);
    document.addEventListener("submit", markClean, true);
    document.addEventListener("reset", markClean, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      askBeforeLeaving = null;
      observer.disconnect();
      for (const type of ["focusin", "pointerdown", "keydown"]) {
        document.removeEventListener(type, beforeEdit, true);
      }
      document.removeEventListener("input", afterEdit, true);
      document.removeEventListener("change", afterEdit, true);
      document.removeEventListener("submit", markClean, true);
      document.removeEventListener("reset", markClean, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  function discardAndLeave() {
    const go = pendingGo;
    baselines.clear();
    setPendingGo(null);
    go?.();
  }

  function saveHere() {
    setPendingGo(null);
    for (const form of dirtyFormList()) form.requestSubmit();
  }

  return (
    <Dialog open={pendingGo !== null} onOpenChange={(open) => !open && setPendingGo(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterações não salvas</DialogTitle>
          <DialogDescription>
            Você mudou dados que ainda não foram salvos. Quer salvar antes de sair?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingGo(null)}>
            Continuar editando
          </Button>
          <Button variant="destructive" onClick={discardAndLeave}>
            Descartar e sair
          </Button>
          <Button onClick={saveHere}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
