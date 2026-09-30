import { getPublicSharedDocument } from "@/core/share/public";
import { renderSharePdf } from "@/core/share/pdf";
import { SHARE_KIND_LABELS } from "@/core/share/document";

export const dynamic = "force-dynamic";

/** PDF público do documento compartilhado (mesmo token da página). */
export async function GET(_req: Request, ctx: RouteContext<"/d/[token]/pdf">) {
  const { token } = await ctx.params;
  const found = await getPublicSharedDocument(token);
  if (!found) return new Response("Documento não encontrado ou expirado.", { status: 404 });

  const bytes = await renderSharePdf(found.doc);
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
