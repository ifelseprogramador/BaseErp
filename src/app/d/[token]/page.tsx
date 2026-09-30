import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSharedDocument } from "@/core/share/public";
import { SHARE_KIND_LABELS } from "@/core/share/document";

// Página pública (sem login): nunca indexar nem guardar em cache.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedDocumentPage({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;
  const found = await getPublicSharedDocument(token);
  if (!found) notFound();
  const { doc, expiresAt } = found;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{doc.issuerName}</h1>
        {doc.issuerLines.map((l) => (
          <p key={l} className="text-muted-foreground text-sm">
            {l}
          </p>
        ))}
      </header>

      <section className="flex flex-col gap-1 border-y py-4">
        <p className="text-lg font-semibold">
          {SHARE_KIND_LABELS[doc.kind]}
          {doc.number ? ` nº ${doc.number}` : ""}
        </p>
        {doc.title !== SHARE_KIND_LABELS[doc.kind] && (
          <p className="text-muted-foreground text-sm">{doc.title}</p>
        )}
        {doc.customerName && (
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Cliente: </span>
            {doc.customerName}
          </p>
        )}
        {doc.customerLines.map((l) => (
          <p key={l} className="text-muted-foreground text-sm">
            {l}
          </p>
        ))}
      </section>

      {doc.sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-1.5">
          <h2 className="font-semibold">{s.heading}</h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
            {s.rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {doc.table && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                {doc.table.columns.map((c) => (
                  <th
                    key={c.label}
                    className={`px-2 py-1.5 font-medium ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.table.rows.map((row, i) => (
                <tr key={i} className="border-b">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-2 py-1.5 ${doc.table!.columns[j]?.align === "right" ? "text-right" : ""}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {doc.totals.length > 0 && (
        <div className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
          {doc.totals.map((t) => (
            <div
              key={t.label}
              className={`flex justify-between ${t.strong ? "text-base font-semibold" : ""}`}
            >
              <span>{t.label}</span>
              <span>{t.value}</span>
            </div>
          ))}
        </div>
      )}

      {doc.notes && (
        <section>
          <h2 className="font-semibold">Observações</h2>
          <p className="text-sm whitespace-pre-line">{doc.notes}</p>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <a
          href={`/d/${token}/pdf`}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          Baixar PDF
        </a>
        {doc.links.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            {l.label}
          </a>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Link válido até {new Date(expiresAt).toLocaleDateString("pt-BR")}.
      </p>
    </main>
  );
}
