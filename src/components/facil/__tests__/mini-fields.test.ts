import { describe, expect, it } from "vitest";
import { catalogoBordadoMiniFields, customerMiniFields, vehicleMiniFields } from "../mini-fields";

describe("customerMiniFields", () => {
  it("só o nome é obrigatório por padrão; o resto fica em 'Mais dados'", () => {
    const fields = customerMiniFields();
    expect(fields.filter((f) => f.required).map((f) => f.key)).toEqual(["name"]);
    const advanced = fields.filter((f) => f.advanced).map((f) => f.key);
    expect(advanced).toEqual(
      expect.arrayContaining(["type", "document", "email", "zip", "city", "ie", "legalName"]),
    );
    expect(advanced).not.toContain("notes");
  });

  it("cobre todos os campos do cadastro completo (observações só se pedido)", () => {
    const keys = customerMiniFields({ withNotes: true }).map((f) => f.key);
    for (const k of ["ibgeCode", "state", "district", "complement", "im", "tradeName", "notes"]) {
      expect(keys).toContain(k);
    }
  });

  it("onde a validação exige telefone, ele fica obrigatório e à vista", () => {
    const phone = customerMiniFields({ phoneRequired: true }).find((f) => f.key === "phone");
    expect(phone?.required).toBe(true);
    expect(phone?.advanced).toBeUndefined();
  });

  it("o tipo começa em Pessoa (pf)", () => {
    expect(customerMiniFields().find((f) => f.key === "type")?.defaultValue).toBe("pf");
  });
});

describe("vehicleMiniFields", () => {
  it("só a placa é obrigatória; ano, cor, combustível, km e chassi são opcionais", () => {
    const fields = vehicleMiniFields();
    expect(fields.filter((f) => f.required).map((f) => f.key)).toEqual(["plate"]);
    expect(fields.filter((f) => f.advanced).map((f) => f.key)).toEqual([
      "year",
      "color",
      "fuel",
      "currentKm",
      "chassis",
    ]);
  });
});

describe("catalogoBordadoMiniFields", () => {
  it("inclui os dados fiscais do cadastro completo em 'Mais dados'", () => {
    const advanced = catalogoBordadoMiniFields()
      .filter((f) => f.advanced)
      .map((f) => f.key);
    expect(advanced).toEqual(expect.arrayContaining(["unidade", "ncm", "cfop", "origem", "cst"]));
  });
});
