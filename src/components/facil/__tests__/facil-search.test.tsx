import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  FacilItemsField,
  describeLines,
  FacilSearchField,
  type FacilOption,
  type MiniCreate,
} from "../facil-search";

const ana: FacilOption = { value: "c1", label: "Ana Souza", subtitle: "11 99999-0000" };
const bruno: FacilOption = { value: "c2", label: "Bruno Lima" };

afterEach(cleanup);

function hidden(container: HTMLElement, name: string) {
  return container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
}

describe("FacilSearchField", () => {
  it("mostra os mais recentes de cara e busca no servidor ao digitar", async () => {
    const search = vi.fn(async (term: string) => (term ? [bruno] : [ana, bruno]));
    render(<FacilSearchField name="customerId" search={search} />);

    await waitFor(() => expect(screen.getByText("Ana Souza")).toBeTruthy());
    expect(search).toHaveBeenCalledWith("");

    fireEvent.change(screen.getByLabelText("Procurar"), { target: { value: "bru" } });
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("bru"));
    await waitFor(() => expect(screen.queryByText("Ana Souza")).toBeNull());
    expect(screen.getByText("Bruno Lima")).toBeTruthy();
  });

  it("escolher grava o valor no campo do formulário; 'Trocar' volta à busca", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <FacilSearchField
        name="customerId"
        required
        onChange={onChange}
        search={async () => [ana, bruno]}
      />,
    );
    // Sem escolha, o campo obrigatório está inválido.
    expect(hidden(container, "customerId")?.checkValidity()).toBe(false);

    fireEvent.click(await screen.findByText("Ana Souza"));
    expect(hidden(container, "customerId")?.value).toBe("c1");
    expect(hidden(container, "customerId")?.checkValidity()).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(ana);

    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
    expect(hidden(container, "customerId")?.value).toBe("");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("Enter no campo de busca escolhe o único resultado e NÃO envia nem avança", async () => {
    const outer = vi.fn();
    const { container } = render(
      <div onKeyDown={outer}>
        <FacilSearchField name="customerId" search={async (t) => (t ? [bruno] : [ana, bruno])} />
      </div>,
    );
    const input = await screen.findByLabelText("Procurar");
    fireEvent.change(input, { target: { value: "bru" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    fireEvent.keyDown(input, { key: "Enter" });
    expect(hidden(container, "customerId")?.value).toBe("c2");
    expect(outer).not.toHaveBeenCalled();
  });

  it("cadastra na hora e já escolhe o novo registro", async () => {
    const submit = vi.fn(async (values: Record<string, string>) => ({
      ok: true,
      option: { value: "novo", label: values.name, subtitle: values.phone },
    }));
    const create: MiniCreate = {
      id: "cliente",
      label: "Cadastrar novo cliente",
      title: "Novo cliente",
      fields: [
        { key: "name", label: "Nome", required: true },
        { key: "phone", label: "Telefone", type: "tel" },
      ],
      submit,
    };
    const { container } = render(
      <FacilSearchField name="customerId" search={async () => []} creates={[create]} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Cadastrar novo cliente/ }));
    // Nome é obrigatório: sem ele não chama o servidor.
    fireEvent.click(screen.getByRole("button", { name: /Salvar e usar/ }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText("Preencha: Nome.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Carla Dias" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11 98888-7777" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar e usar/ }));

    await waitFor(() => expect(hidden(container, "customerId")?.value).toBe("novo"));
    expect(submit).toHaveBeenCalledWith({ name: "Carla Dias", phone: "11 98888-7777" });
    expect(screen.getByText("Carla Dias")).toBeTruthy();
  });

  it("mostra erro de campo que o mini-formulário não exibe (nunca fica mudo)", async () => {
    const create: MiniCreate = {
      id: "veiculo",
      label: "Cadastrar novo veículo",
      title: "Novo veículo",
      fields: [{ key: "plate", label: "Placa", required: true }],
      // O servidor recusou `year`, que não está na tela.
      submit: async () => ({ ok: false, errors: { year: ["Ano inválido."] } }),
    };
    render(<FacilSearchField name="vehicleId" search={async () => []} creates={[create]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cadastrar novo veículo/ }));
    fireEvent.change(screen.getByLabelText("Placa"), { target: { value: "ABC1D23" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar e usar/ }));
    await waitFor(() => expect(screen.getByText("Ano inválido.")).toBeTruthy());
  });

  it("campos opcionais ficam atrás de 'Mais dados' e vão junto quando preenchidos", async () => {
    const submit = vi.fn(async (values: Record<string, string>) => ({
      ok: true,
      option: { value: "v1", label: values.plate },
    }));
    const create: MiniCreate = {
      id: "veiculo",
      label: "Cadastrar novo veículo",
      title: "Novo veículo",
      fields: [
        { key: "plate", label: "Placa", required: true },
        { key: "year", label: "Ano", type: "number", advanced: true },
        {
          key: "fuel",
          label: "Combustível",
          advanced: true,
          clearable: true,
          choices: [
            { value: "flex", label: "Flex" },
            { value: "diesel", label: "Diesel" },
          ],
        },
      ],
      submit,
    };
    render(<FacilSearchField name="vehicleId" search={async () => []} creates={[create]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cadastrar novo veículo/ }));

    // Escondidos até pedir; só a placa é obrigatória.
    expect(screen.queryByLabelText("Ano")).toBeNull();
    fireEvent.change(screen.getByLabelText("Placa"), { target: { value: "ABC1D23" } });

    fireEvent.click(screen.getByRole("button", { name: /Mais dados/ }));
    fireEvent.change(screen.getByLabelText("Ano"), { target: { value: "2019" } });
    fireEvent.click(screen.getByRole("button", { name: "Flex" }));
    // Tocar de novo desmarca (opcional); marca outra para enviar.
    fireEvent.click(screen.getByRole("button", { name: "Flex" }));
    fireEvent.click(screen.getByRole("button", { name: "Diesel" }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar e usar/ }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith({ plate: "ABC1D23", year: "2019", fuel: "diesel" });
  });

  it("sem preencher os opcionais, salva só com os obrigatórios", async () => {
    const submit = vi.fn(async (values: Record<string, string>) => ({
      ok: true,
      option: { value: "v1", label: values.plate },
    }));
    render(
      <FacilSearchField
        name="vehicleId"
        search={async () => []}
        creates={[
          {
            id: "veiculo",
            label: "Cadastrar novo veículo",
            title: "Novo veículo",
            fields: [
              { key: "plate", label: "Placa", required: true },
              { key: "year", label: "Ano", type: "number", advanced: true },
            ],
            submit,
          },
        ]}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Cadastrar novo veículo/ }));
    fireEvent.change(screen.getByLabelText("Placa"), { target: { value: "ABC1D23" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar e usar/ }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ plate: "ABC1D23", year: "" }));
  });

  it("erro num campo opcional abre a seção para a pessoa ver", async () => {
    const create: MiniCreate = {
      id: "veiculo",
      label: "Cadastrar novo veículo",
      title: "Novo veículo",
      fields: [
        { key: "plate", label: "Placa", required: true },
        { key: "year", label: "Ano", type: "number", advanced: true },
      ],
      submit: async () => ({ ok: false, errors: { year: ["Ano inválido."] } }),
    };
    render(<FacilSearchField name="vehicleId" search={async () => []} creates={[create]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cadastrar novo veículo/ }));
    fireEvent.change(screen.getByLabelText("Placa"), { target: { value: "ABC1D23" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar e usar/ }));
    await waitFor(() => expect(screen.getByText("Ano inválido.")).toBeTruthy());
    expect(screen.getByLabelText("Ano")).toBeTruthy();
  });

  it("mostra o erro do servidor no campo e mantém o que foi digitado", async () => {
    const create: MiniCreate = {
      id: "cliente",
      label: "Cadastrar novo cliente",
      title: "Novo cliente",
      fields: [{ key: "name", label: "Nome", required: true }],
      submit: async () => ({ ok: false, errors: { name: ["Informe o nome completo."] } }),
    };
    render(<FacilSearchField name="customerId" search={async () => []} creates={[create]} />);
    fireEvent.click(await screen.findByRole("button", { name: /Cadastrar novo cliente/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar e usar/ }));
    await waitFor(() => expect(screen.getByText("Informe o nome completo.")).toBeTruthy());
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("A");
  });
});

describe("FacilItemsField", () => {
  const oleo: FacilOption = {
    value: "p1",
    label: "Óleo 5W30",
    subtitle: "R$ 35,00",
    priceCents: 3500,
    extras: { type: "peca" },
  };

  function lines(container: HTMLElement) {
    return JSON.parse(hidden(container, "itemsJson")?.value ?? "[]") as Record<string, unknown>[];
  }

  it("adiciona do catálogo com o preço padrão e soma o total", async () => {
    const { container } = render(<FacilItemsField name="itemsJson" search={async () => [oleo]} />);
    expect(lines(container)).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/ }));
    fireEvent.click(await screen.findByText("Óleo 5W30"));

    expect(lines(container)).toEqual([
      { type: "peca", ref: "p1", label: "Óleo 5W30", quantity: 1, unitPriceCents: 3500 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Mais um" }));
    await waitFor(() => expect(lines(container)[0].quantity).toBe(2));
    expect(screen.getAllByText("R$ 70,00").length).toBeGreaterThan(0);
  });

  it("quantidade não desce de 1 e o preço pode ser trocado", async () => {
    const { container } = render(<FacilItemsField name="itemsJson" search={async () => [oleo]} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/ }));
    fireEvent.click(await screen.findByText("Óleo 5W30"));
    fireEvent.click(screen.getByRole("button", { name: "Menos um" }));
    expect(lines(container)[0].quantity).toBe(1);

    fireEvent.change(screen.getByLabelText("Preço de Óleo 5W30"), { target: { value: "40,50" } });
    expect(lines(container)[0].unitPriceCents).toBe(4050);
  });

  it("item avulso entra sem referência de catálogo; remover tira da lista", async () => {
    const free: MiniCreate = {
      id: "avulso",
      label: "Item avulso",
      title: "Item avulso",
      fields: [
        { key: "label", label: "Descrição", required: true },
        { key: "price", label: "Preço", type: "money" },
      ],
      submit: async (values) => ({
        ok: true,
        option: {
          value: "free:1",
          label: values.label,
          priceCents: 1000,
          extras: { type: "servico" },
        },
      }),
    };
    const { container } = render(
      <FacilItemsField name="itemsJson" search={async () => []} creates={[free]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Item avulso/ }));
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Mão de obra" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar e usar/ }));

    await waitFor(() => expect(lines(container)).toHaveLength(1));
    expect(lines(container)[0].ref).toBeUndefined();
    expect(lines(container)[0].type).toBe("servico");

    fireEvent.click(screen.getByRole("button", { name: "Tirar Mão de obra" }));
    expect(lines(container)).toEqual([]);
  });
});

describe("describeLines", () => {
  it("descreve cada item e o total; vazio sem itens ou com JSON inválido", () => {
    const json = JSON.stringify([
      { label: "Óleo", quantity: 2, unitPriceCents: 3500 },
      { label: "Mão de obra", quantity: 1, unitPriceCents: 5000 },
    ]);
    expect(describeLines(json)).toBe(
      "2× Óleo — R$ 70,00\n1× Mão de obra — R$ 50,00\nTotal: R$ 120,00",
    );
    expect(describeLines("[]")).toBe("");
    expect(describeLines("não é json")).toBe("");
  });
});
