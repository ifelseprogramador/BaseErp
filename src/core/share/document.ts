import { z } from "zod";

/**
 * Modelo NEUTRO de um documento compartilhável (orçamento, pedido, ordem de
 * serviço, nota fiscal, cobrança…). Cada vertical monta este objeto a partir
 * do próprio domínio; a fundação só sabe renderizá-lo (página pública + PDF).
 * É um SNAPSHOT: o que o cliente vê é o que foi enviado, mesmo que o pedido
 * mude depois.
 */
const line = z.string().max(300);

export const shareDocumentSchema = z.object({
  kind: z.enum(["orcamento", "pedido", "ordem_servico", "nota_fiscal", "cobranca", "outro"]),
  title: z.string().min(1).max(120),
  number: z.string().max(40).optional(),
  issuerName: z.string().min(1).max(160),
  issuerLines: z.array(line).max(6).default([]),
  customerName: z.string().max(160).optional(),
  customerLines: z.array(line).max(6).default([]),
  sections: z
    .array(
      z.object({
        heading: z.string().max(80),
        rows: z.array(z.object({ label: z.string().max(80), value: line })).max(30),
      }),
    )
    .max(8)
    .default([]),
  table: z
    .object({
      columns: z
        .array(
          z.object({ label: z.string().max(40), align: z.enum(["left", "right"]).default("left") }),
        )
        .min(1)
        .max(6),
      rows: z.array(z.array(z.string().max(200))).max(200),
    })
    .optional(),
  totals: z
    .array(
      z.object({
        label: z.string().max(60),
        value: z.string().max(40),
        strong: z.boolean().optional(),
      }),
    )
    .max(8)
    .default([]),
  notes: z.string().max(2000).optional(),
  /** Links externos úteis (ex.: XML/DANFE de uma nota). Só http(s). */
  links: z
    .array(
      z.object({ label: z.string().max(60), url: z.url().refine((u) => /^https?:\/\//.test(u)) }),
    )
    .max(4)
    .default([]),
});

export type ShareDocument = z.infer<typeof shareDocumentSchema>;
export type ShareDocumentInput = z.input<typeof shareDocumentSchema>;

export const SHARE_KIND_LABELS: Record<ShareDocument["kind"], string> = {
  orcamento: "Orçamento",
  pedido: "Pedido",
  ordem_servico: "Ordem de serviço",
  nota_fiscal: "Nota fiscal",
  cobranca: "Cobrança",
  outro: "Documento",
};

/** Texto padrão da mensagem (WhatsApp/e-mail) — o usuário pode editar antes de enviar. */
export function buildShareMessage(
  doc: Pick<ShareDocument, "kind" | "title" | "number" | "issuerName" | "customerName">,
  url: string,
) {
  const greeting = doc.customerName ? `Olá, ${doc.customerName.split(" ")[0]}!` : "Olá!";
  const what = `${SHARE_KIND_LABELS[doc.kind].toLowerCase()}${doc.number ? ` nº ${doc.number}` : ""}`;
  return `${greeting} Segue o ${what} de ${doc.issuerName}:\n${url}`;
}
