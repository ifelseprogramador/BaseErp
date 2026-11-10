import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FacilPickField } from "../facil-wizard";

const options = Array.from({ length: 8 }, (_, i) => ({
  value: `id-${i}`,
  label: `Cliente ${i}`,
  subtitle: i === 3 ? "Rua das Flores" : undefined,
}));

afterEach(cleanup);

function chosen(container: HTMLElement) {
  const radio = container.querySelector<HTMLInputElement>('input[name="customerId"]:checked');
  return radio?.value;
}

describe("FacilPickField", () => {
  it("avisa quando não há o que escolher", () => {
    render(<FacilPickField name="customerId" options={[]} emptyText="Cadastre um cliente." />);
    expect(screen.getByText("Cadastre um cliente.")).toBeTruthy();
  });

  it("a busca só esconde: o item já escolhido continua no formulário", () => {
    const { container } = render(<FacilPickField name="customerId" options={options} />);
    fireEvent.click(screen.getByLabelText("Cliente 5"));
    expect(chosen(container)).toBe("id-5");

    fireEvent.change(screen.getByLabelText("Procurar", { selector: "input" }), {
      target: { value: "flores" },
    });
    // Só o item 3 (pelo subtítulo) fica visível...
    const visible = Array.from(container.querySelectorAll("label")).filter((el) => !el.hidden);
    expect(visible).toHaveLength(1);
    // ...mas a escolha anterior (escondida) ainda vai no FormData.
    expect(chosen(container)).toBe("id-5");
  });

  it("avisa o pai quando a escolha muda e respeita o padrão", () => {
    const seen: string[] = [];
    const { container } = render(
      <FacilPickField
        name="customerId"
        options={options}
        defaultValue="id-2"
        onChange={(value) => seen.push(value)}
      />,
    );
    expect(chosen(container)).toBe("id-2");
    fireEvent.click(screen.getByLabelText("Cliente 6"));
    expect(seen).toEqual(["id-6"]);
  });

  it("com required, nenhum marcado deixa o grupo inválido", () => {
    const { container } = render(<FacilPickField name="customerId" options={options} required />);
    const first = container.querySelector<HTMLInputElement>('input[name="customerId"]');
    expect(first?.checkValidity()).toBe(false);
    fireEvent.click(screen.getByLabelText("Cliente 1"));
    expect(first?.checkValidity()).toBe(true);
  });
});
