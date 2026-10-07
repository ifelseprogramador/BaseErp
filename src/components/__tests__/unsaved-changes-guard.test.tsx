import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back: vi.fn() }) }));

import { UnsavedChangesGuard, guardNavigation } from "../unsaved-changes-guard";

function setup(guarded = true) {
  const submit = vi.fn((e: Event) => e.preventDefault());
  render(
    <>
      <UnsavedChangesGuard />
      <a href="/zzz-teste">Clientes</a>
      <a href="https://outro.com/x">Fora</a>
      <form data-unsaved-guard={guarded ? "" : undefined} onSubmit={(e) => submit(e.nativeEvent)}>
        <input aria-label="nome" />
        <button type="submit">Gravar</button>
      </form>
    </>,
  );
  return { submit, input: screen.getByLabelText("nome") };
}

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe("UnsavedChangesGuard", () => {
  it("sem alterações, o link navega normalmente", () => {
    setup();
    const notPrevented = fireEvent.click(screen.getByText("Clientes"));
    expect(notPrevented).toBe(true);
    expect(screen.queryByText("Alterações não salvas")).toBeNull();
  });

  it("com alterações, o clique em link interno pergunta antes de sair", () => {
    const { input } = setup();
    fireEvent.input(input, { target: { value: "Maria" } });

    const notPrevented = fireEvent.click(screen.getByText("Clientes"));

    expect(notPrevented).toBe(false);
    expect(screen.getByText("Alterações não salvas")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("'Descartar e sair' navega para onde a pessoa queria ir", () => {
    const { input } = setup();
    fireEvent.input(input, { target: { value: "Maria" } });
    fireEvent.click(screen.getByText("Clientes"));

    fireEvent.click(screen.getByRole("button", { name: "Descartar e sair" }));

    expect(push).toHaveBeenCalledWith("/zzz-teste");
  });

  it("'Continuar editando' fica na tela e não navega", () => {
    const { input } = setup();
    fireEvent.input(input, { target: { value: "Maria" } });
    fireEvent.click(screen.getByText("Clientes"));

    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));

    expect(push).not.toHaveBeenCalled();
  });

  it("'Salvar' envia o formulário e não navega", () => {
    const { input, submit } = setup();
    fireEvent.input(input, { target: { value: "Maria" } });
    fireEvent.click(screen.getByText("Clientes"));

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(submit).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("depois de enviar o formulário, sair não pergunta mais", () => {
    const { input } = setup();
    fireEvent.input(input, { target: { value: "Maria" } });
    fireEvent.submit(input.closest("form")!);

    expect(fireEvent.click(screen.getByText("Clientes"))).toBe(true);
  });

  it("formulário sem o atributo não é vigiado, e link externo nunca é interceptado", () => {
    const { input } = setup(false);
    fireEvent.input(input, { target: { value: "x" } });
    expect(fireEvent.click(screen.getByText("Clientes"))).toBe(true);

    cleanup();
    const again = setup();
    fireEvent.input(again.input, { target: { value: "x" } });
    expect(fireEvent.click(screen.getByText("Fora"))).toBe(true);
  });

  it("guardNavigation (botão Voltar) pergunta quando há alterações", () => {
    const { input } = setup();
    const go = vi.fn();
    expect(guardNavigation(go)).toBe(false);

    fireEvent.input(input, { target: { value: "x" } });
    let asked = false;
    act(() => {
      asked = guardNavigation(go);
    });
    expect(asked).toBe(true);
    expect(go).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Descartar e sair" }));
    expect(go).toHaveBeenCalledTimes(1);
  });
});
