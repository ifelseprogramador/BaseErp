import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const deleteLoginEvent = vi.fn().mockResolvedValue({ ok: true });
const clearLoginEvents = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../actions", () => ({
  deleteLoginEvent: (...a: unknown[]) => deleteLoginEvent(...a),
  clearLoginEvents: (...a: unknown[]) => clearLoginEvents(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  LoginHistoryCard,
  formatExactDateTime,
  type LoginEntry,
} from "../components/login-history-card";

const entry = (over: Partial<LoginEntry>): LoginEntry => ({
  id: "1",
  email: "ana@empresa.com",
  organizationName: "Empresa A",
  ip: "177.1.2.3",
  city: "Recife",
  region: "PE",
  country: "BR",
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/154.0",
  createdAt: new Date("2026-10-07T17:39:33Z"),
  ...over,
});

beforeEach(() => {
  deleteLoginEvent.mockClear();
  clearLoginEvents.mockClear();
});

function open() {
  fireEvent.click(screen.getByRole("button", { name: /^Histórico de acessos/ }));
}

describe("LoginHistoryCard", () => {
  it("mostra horário exato (com segundos), IP e localização", () => {
    render(<LoginHistoryCard entries={[entry({})]} />);
    open();
    expect(screen.getByText("ana@empresa.com")).toBeTruthy();
    expect(screen.getByText(/07\/10\/2026.*14:39:33/)).toBeTruthy();
    expect(screen.getByText("177.1.2.3")).toBeTruthy();
    expect(screen.getByText(/Recife, PE, BR/)).toBeTruthy();
  });

  it("sem localização: 'Rede local' para IP privado e 'Não identificada' para os demais", () => {
    render(
      <LoginHistoryCard
        entries={[
          entry({ id: "1", ip: "127.0.0.1", city: null, region: null, country: null }),
          entry({ id: "2", ip: "177.9.9.9", city: null, region: null, country: null }),
        ]}
      />,
    );
    open();
    expect(screen.getByText(/Rede local/)).toBeTruthy();
    expect(screen.getByText(/Não identificada/)).toBeTruthy();
  });

  it("apaga um registro específico", async () => {
    render(
      <LoginHistoryCard entries={[entry({ id: "a" }), entry({ id: "b", email: "bia@x.com" })]} />,
    );
    open();

    fireEvent.click(screen.getAllByRole("button", { name: "Apagar registro de acesso" })[0]);

    await waitFor(() => expect(deleteLoginEvent).toHaveBeenCalledWith("a"));
    expect(screen.queryByText("ana@empresa.com")).toBeNull();
    expect(screen.getByText("bia@x.com")).toBeTruthy();
  });

  it("limpa tudo depois de confirmar", async () => {
    render(<LoginHistoryCard entries={[entry({})]} />);
    open();

    fireEvent.click(screen.getByRole("button", { name: "Limpar tudo" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar tudo" }).at(-1)!);

    await waitFor(() => expect(clearLoginEvents).toHaveBeenCalledWith(undefined));
    expect(screen.getByText("Nenhum acesso registrado ainda.")).toBeTruthy();
  });

  it("na ficha da organização, limpar apaga só os acessos dela", async () => {
    render(<LoginHistoryCard entries={[entry({})]} organizationId="org-1" />);
    open();

    fireEvent.click(screen.getByRole("button", { name: "Limpar tudo" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar tudo" }).at(-1)!);

    await waitFor(() => expect(clearLoginEvents).toHaveBeenCalledWith("org-1"));
  });

  it("formata a hora no fuso de Brasília", () => {
    expect(formatExactDateTime("2026-10-07T03:00:00Z")).toMatch(/07\/10\/2026.*00:00:00/);
  });
});
