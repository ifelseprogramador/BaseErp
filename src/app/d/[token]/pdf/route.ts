import { getPublicSharedDocument } from "@/core/share/public";
import { renderSharePdf } from "@/core/share/pdf";
import { SHARE_KIND_LABELS } from "@/core/share/document";

export const dynamic = "force-dynamic";

/** PDF público do documento compartilhado (mesmo token da página). */
export async function GET(_req: Request, ctx: RouteContext<"/d/[token]/pdf">) {
  const { token } = await ctx.params;
  const found = await getPublicSharedDocument(token);
  if (!found) return new Response("Documento não encontrado ou expirado.", { status: 404 });

  // PDF oficial anexado (DANFE da nota) tem prioridade sobre o resumo gerado pelo sistema.
  const oficial = found.doc.officialPdfBase64
    ? new Uint8Array(Buffer.from(found.doc.officialPdfBase64, "base64"))
    : null;
  const bytes =
    oficial && oficial[0] === 0x25 && oficial[1] === 0x50
      ? oficial
      : await renderSharePdf(found.doc);
  const name =
    `${SHARE_KIND_LABELS[found.doc.kind]}${found.doc.number ? `-${found.doc.number}` : ""}`
      .normalize("NFD")
      .replace(/[^\w.-]+/g, "_");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
