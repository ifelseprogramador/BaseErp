import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ModePage, ModeSection } from "../mode-layout";

afterEach(cleanup);

function Tela({ mode }: { mode: "formal" | "facil" }) {
  return (
    <ModePage mode={mode} title="Backup" subtitle="Cópia dos dados">
      <ModeSection mode={mode} title="Fazer backup agora" description="Baixa um arquivo">
        <button type="button">Baixar</button>
      </ModeSection>
    </ModePage>
  );
}

describe("ModePage / ModeSection", () => {
  it.each(["formal", "facil"] as const)("o mesmo conteúdo existe no layout %s", (mode) => {
    render(<Tela mode={mode} />);
    expect(screen.getByRole("heading", { name: "Backup" })).toBeTruthy();
    expect(screen.getByText("Cópia dos dados")).toBeTruthy();
    expect(screen.getByText("Fazer backup agora")).toBeTruthy();
    expect(screen.getByText("Baixa um arquivo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Baixar" })).toBeTruthy();
  });

  it("o Fácil traz o botão grande de voltar ao Início", () => {
    render(<Tela mode="facil" />);
    expect(screen.getByRole("link", { name: /Início/ }).getAttribute("href")).toBe("/");
  });
});
