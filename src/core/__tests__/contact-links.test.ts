import { describe, expect, it } from "vitest";
import { formatPhoneBr, isLikelyMobile, telLink, whatsappLink } from "../contact-links";

describe("contact-links", () => {
  it("whatsappLink adiciona DDI 55 só quando falta e codifica o texto", () => {
    expect(whatsappLink("(11) 99999-8888")).toBe("https://wa.me/5511999998888");
    expect(whatsappLink("+55 11 99999-8888")).toBe("https://wa.me/5511999998888");
    expect(whatsappLink("11999998888", "Olá, tudo bem?")).toBe(
      "https://wa.me/5511999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
  });
  it("distingue celular (WhatsApp) de fixo", () => {
    expect(isLikelyMobile("11999998888")).toBe(true);
    expect(isLikelyMobile("+5511999998888")).toBe(true);
    expect(isLikelyMobile("1133334444")).toBe(false);
    expect(isLikelyMobile("")).toBe(false);
    expect(telLink("1133334444")).toBe("tel:+551133334444");
  });
  it("formata telefone brasileiro e preserva o que não reconhece", () => {
    expect(formatPhoneBr("11999998888")).toBe("(11) 99999-8888");
    expect(formatPhoneBr("551133334444")).toBe("(11) 3333-4444");
    expect(formatPhoneBr("ramal 123")).toBe("ramal 123");
    expect(formatPhoneBr(null)).toBe("");
  });
});
