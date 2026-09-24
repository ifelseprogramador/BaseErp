import { describe, expect, it } from "vitest";
import { ALL_ORGANIZATIONS, notificationSchema } from "@/core/notifications/validation";

describe("notificationSchema", () => {
  it("aceita título e mensagem sem destinatário (pra todas as organizações)", () => {
    const result = notificationSchema.safeParse({
      title: "Manutenção programada",
      body: "O sistema ficará indisponível das 2h às 3h.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.organizationId).toBeUndefined();
    }
  });

  it("trata o sentinel ALL_ORGANIZATIONS como 'pra todas' (organizationId undefined)", () => {
    const result = notificationSchema.safeParse({
      title: "Aviso geral",
      body: "Mensagem.",
      organizationId: ALL_ORGANIZATIONS,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.organizationId).toBeUndefined();
    }
  });

  it("mantém organizationId de verdade quando uma organização específica é escolhida", () => {
    const result = notificationSchema.safeParse({
      title: "Aviso individual",
      body: "Mensagem.",
      organizationId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.organizationId).toBe("11111111-1111-1111-1111-111111111111");
    }
  });

  it("usa 'aviso' como categoria padrão e rejeita categoria desconhecida", () => {
    const semCategoria = notificationSchema.safeParse({ title: "x", body: "y" });
    expect(semCategoria.success && semCategoria.data.category).toBe("aviso");
    const dica = notificationSchema.safeParse({ title: "x", body: "y", category: "dica" });
    expect(dica.success && dica.data.category).toBe("dica");
    expect(
      notificationSchema.safeParse({ title: "x", body: "y", category: "promocao" }).success,
    ).toBe(false);
  });

  it("rejeita título ou mensagem vazios", () => {
    expect(notificationSchema.safeParse({ title: "", body: "x" }).success).toBe(false);
    expect(notificationSchema.safeParse({ title: "x", body: "" }).success).toBe(false);
  });
});
