import { describe, expect, it } from "vitest";
import { initialsOf } from "../../components/entity-header";

describe("initialsOf", () => {
  it("usa as duas primeiras palavras e ignora conectores e sufixos", () => {
    expect(initialsOf("Maria da Silva")).toBe("MS");
    expect(initialsOf("Comércio de Bordados e Confecções Ltda")).toBe("CB");
    expect(initialsOf("joão")).toBe("J");
    expect(initialsOf("  ana   lima  ")).toBe("AL");
  });
  it("lida com símbolos, números e vazio", () => {
    expect(initialsOf("123 Bordados")).toBe("1B");
    expect(initialsOf("& Cia")).toBe("C");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("---")).toBe("?");
  });
});
