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

const dirtyForms = new Set<HTMLFormElement>();
let askBeforeLeaving: ((go: () => void) => void) | null = null;

function hasDirtyForm() {
  for (const form of dirtyForms) {
    if (!form.isConnected) dirtyForms.delete(form);
  }
  return dirtyForms.size > 0;
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
    function markDirty(event: Event) {
      const form = formOf(event.target);
      if (form) dirtyForms.add(form);
    }
    function markClean(event: Event) {
      const form = formOf(event.target);
      if (form) dirtyForms.delete(form);
    }
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
    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    document.addEventListener("submit", markClean, true);
    document.addEventListener("reset", markClean, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      askBeforeLeaving = null;
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      document.removeEventListener("submit", markClean, true);
      document.removeEventListener("reset", markClean, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  function discardAndLeave() {
    const go = pendingGo;
    dirtyForms.clear();
    setPendingGo(null);
    go?.();
  }

  function saveHere() {
    setPendingGo(null);
    for (const form of [...dirtyForms]) form.requestSubmit();
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
