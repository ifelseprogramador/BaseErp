import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Phone, User } from "lucide-react";
import type { ActionResult } from "@/core/action-result";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FacilWizard, type WizardStep } from "../facil-wizard";

const steps: WizardStep[] = [
  {
    id: "nome",
    title: "Qual o nome?",
    icon: User,
    fields: ["name"],
    content: <input aria-label="Nome" name="name" required minLength={2} />,
  },
  {
    id: "telefone",
    title: "Qual o telefone?",
    icon: Phone,
    fields: ["phone"],
    content: <input aria-label="Telefone" name="phone" />,
  },
];
const review = [
  { name: "name", label: "Nome" },
  { name: "phone", label: "Telefone" },
];

function setup(action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>) {
  render(<FacilWizard action={action} steps={steps} review={review} cancelHref="/clientes" />);
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { selector: "input" }), { target: { value } });
}

afterEach(cleanup);

describe("FacilWizard", () => {
  it("não avança com campo obrigatório vazio", () => {
    setup(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    expect(screen.getByText("Passo 1 de 3")).toBeTruthy();
  });

  it("avança, mostra a revisão e envia o FormData com os mesmos names", async () => {
    const action = vi.fn(async () => ({ ok: true }));
    setup(action);

    type("Nome", "Maria");
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    type("Telefone", "11999990000");
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));

    expect(screen.getByText("Está tudo certo?")).toBeTruthy();
    expect(screen.getByText("Maria")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /salvar/i }));
    });
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const sent = (action.mock.calls[0] as unknown as [ActionResult, FormData])[1];
    expect(sent.get("name")).toBe("Maria");
    expect(sent.get("phone")).toBe("11999990000");
  });

  it("erro do servidor leva à etapa do campo e NÃO apaga o que estava certo", async () => {
    const action = vi.fn(async () => ({
      ok: false,
      errors: { name: ["Informe um nome válido."] },
    }));
    setup(action);

    type("Nome", "Maria");
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    type("Telefone", "11999990000");
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /salvar/i }));
    });

    await waitFor(() => expect(screen.getByText("Passo 1 de 3")).toBeTruthy());
    expect(screen.getByText("Informe um nome válido.")).toBeTruthy();
    const phone = screen.getByLabelText("Telefone", { selector: "input" }) as HTMLInputElement;
    const name = screen.getByLabelText("Nome", { selector: "input" }) as HTMLInputElement;
    expect(phone.value).toBe("11999990000");
    expect(name.value).toBe("Maria");
  });

  it("chama onSuccess quando a ação devolve ok (ação que não redireciona)", async () => {
    const action = vi.fn(async () => ({ ok: true, id: "abc" }));
    const onSuccess = vi.fn();
    render(
      <FacilWizard
        action={action}
        steps={steps}
        review={review}
        cancelHref="/clientes"
        onSuccess={onSuccess}
      />,
    );
    type("Nome", "Maria");
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /salvar/i }));
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ ok: true, id: "abc" }));
  });

  it("o clique que abre a revisão NÃO envia: o 'Salvar' é outro botão e não é submit", async () => {
    const action = vi.fn(async () => ({ ok: true }));
    setup(action);
    type("Nome", "Maria");
    fireEvent.click(screen.getByRole("button", { name: /avançar/i }));
    const avancar = screen.getByRole("button", { name: /avançar/i });
    fireEvent.click(avancar);

    expect(screen.getByText("Está tudo certo?")).toBeTruthy();
    // O botão da etapa foi descartado (não reaproveitado como submit)...
    expect(avancar.isConnected).toBe(false);
    // ...o de salvar nunca dispara o envio nativo do formulário...
    expect(screen.getByRole("button", { name: /salvar/i }).getAttribute("type")).toBe("button");
    // ...e nada foi enviado até a pessoa confirmar.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(action).not.toHaveBeenCalled();
  });

  it("Enter num campo avança a etapa em vez de enviar", () => {
    const action = vi.fn(async () => ({ ok: true }));
    setup(action);
    type("Nome", "Maria");
    fireEvent.keyDown(screen.getByLabelText("Nome", { selector: "input" }), { key: "Enter" });
    expect(screen.getByText("Passo 2 de 3")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });
});
