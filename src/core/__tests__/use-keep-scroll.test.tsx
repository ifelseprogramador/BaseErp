import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const replace = vi.fn();
let busca = new URLSearchParams("status=aberto");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/pedidos",
  useSearchParams: () => busca,
}));

const { useKeepScroll } = await import("../use-keep-scroll");

function Harness() {
  const { navegar } = useKeepScroll();
  return <button onClick={() => navegar("status=pronto")}>filtrar</button>;
}

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  busca = new URLSearchParams("status=aberto");
  scrollTo = vi.fn();
  Object.defineProperty(window, "scrollTo", { value: scrollTo, configurable: true });
  Object.defineProperty(window, "scrollY", { value: 640, configurable: true });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});
afterEach(cleanup);

describe("useKeepScroll", () => {
  it("navega sem rolar ao topo e devolve o scroll de antes quando a URL nova chega", async () => {
    const { rerender } = render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByText("filtrar"));
    });
    expect(replace).toHaveBeenCalledWith("/pedidos?status=pronto", { scroll: false });

    busca = new URLSearchParams("status=pronto"); // o servidor devolveu a página nova
    await act(async () => rerender(<Harness />));
    expect(scrollTo).toHaveBeenCalledWith(0, 640);
  });

  it("sem parâmetros navega para o caminho limpo", async () => {
    function Limpar() {
      const { navegar } = useKeepScroll();
      return <button onClick={() => navegar("")}>limpar</button>;
    }
    render(<Limpar />);
    await act(async () => {
      fireEvent.click(screen.getByText("limpar"));
    });
    expect(replace).toHaveBeenCalledWith("/pedidos", { scroll: false });
  });

  it("não mexe no scroll se a pessoa não navegou por aqui", async () => {
    const { rerender } = render(<Harness />);
    busca = new URLSearchParams("status=outro");
    await act(async () => rerender(<Harness />));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
