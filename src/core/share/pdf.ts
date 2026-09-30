import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { SHARE_KIND_LABELS, type ShareDocument } from "./document";

const PAGE = { w: 595.28, h: 841.89, margin: 44 };

/** Helvetica (WinAnsi) cobre acentos do português; o resto vira "?" em vez de quebrar o PDF. */
function makeSafe(font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  return (text: string) =>
    [...text.replace(/\s+/g, " ")]
      .map((c) => (supported.has(c.codePointAt(0)!) ? c : "?"))
      .join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth || !line) line = test;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Renderiza o documento em PDF (A4, várias páginas se precisar). */
export async function renderSharePdf(doc: ShareDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = makeSafe(font);
  const width = PAGE.w - PAGE.margin * 2;
  const gray = rgb(0.4, 0.4, 0.4);

  let page = pdf.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - PAGE.margin;

  const ensure = (needed: number) => {
    if (y - needed < PAGE.margin) {
      page = pdf.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - PAGE.margin;
    }
  };
  const text = (
    t: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      maxWidth?: number;
    } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? bold : font;
    for (const l of wrap(safe(t), f, size, opts.maxWidth ?? width)) {
      ensure(size + 4);
      page.drawText(l, {
        x: opts.x ?? PAGE.margin,
        y: y - size,
        size,
        font: f,
        color: opts.color ?? rgb(0, 0, 0),
      });
      y -= size + 4;
    }
  };
  const rule = () => {
    ensure(10);
    page.drawLine({
      start: { x: PAGE.margin, y },
      end: { x: PAGE.w - PAGE.margin, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 10;
  };

  text(doc.issuerName, { size: 16, bold: true });
  for (const l of doc.issuerLines) text(l, { color: gray });
  y -= 8;
  rule();
  text(`${SHARE_KIND_LABELS[doc.kind]}${doc.number ? ` nº ${doc.number}` : ""}`, {
    size: 13,
    bold: true,
  });
  if (doc.title !== SHARE_KIND_LABELS[doc.kind]) text(doc.title, { color: gray });
  y -= 6;

  if (doc.customerName) {
    text("Cliente", { size: 9, color: gray });
    text(doc.customerName, { bold: true });
    for (const l of doc.customerLines) text(l, { color: gray });
    y -= 6;
  }

  for (const s of doc.sections) {
    y -= 4;
    text(s.heading, { size: 11, bold: true });
    for (const r of s.rows) {
      ensure(14);
      const labelW = 130;
      page.drawText(safe(r.label), { x: PAGE.margin, y: y - 10, size: 9, font, color: gray });
      const lines = wrap(safe(r.value), font, 10, width - labelW);
      lines.forEach((l, i) => {
        ensure(14);
        page.drawText(l, { x: PAGE.margin + labelW, y: y - 10 - i * 0, size: 10, font });
        y -= 14;
      });
      if (lines.length === 0) y -= 14;
    }
  }

  if (doc.table) {
    y -= 8;
    const cols = doc.table.columns;
    const firstW = width * 0.46;
    const restW = (width - firstW) / Math.max(cols.length - 1, 1);
    const colX = cols.map((_, i) => PAGE.margin + (i === 0 ? 0 : firstW + (i - 1) * restW));
    const colW = cols.map((_, i) => (i === 0 ? firstW : restW));
    const drawRow = (cells: string[], isHeader: boolean) => {
      const f = isHeader ? bold : font;
      const wrapped = cells.map((c, i) => wrap(safe(c ?? ""), f, 9, colW[i] - 6));
      const h = Math.max(...wrapped.map((w) => w.length), 1) * 12 + 4;
      ensure(h);
      if (isHeader)
        page.drawRectangle({
          x: PAGE.margin,
          y: y - h,
          width,
          height: h,
          color: rgb(0.94, 0.94, 0.94),
        });
      wrapped.forEach((lines, i) =>
        lines.forEach((l, li) => {
          const w = f.widthOfTextAtSize(l, 9);
          const x = cols[i].align === "right" ? colX[i] + colW[i] - 6 - w : colX[i] + 3;
          page.drawText(l, { x, y: y - 11 - li * 12, size: 9, font: f });
        }),
      );
      y -= h;
    };
    drawRow(
      cols.map((c) => c.label),
      true,
    );
    for (const r of doc.table.rows) drawRow(r, false);
    rule();
  }

  for (const t of doc.totals) {
    ensure(16);
    const size = t.strong ? 12 : 10;
    const f = t.strong ? bold : font;
    const v = safe(t.value);
    page.drawText(safe(t.label), { x: PAGE.w - PAGE.margin - 220, y: y - size, size, font: f });
    page.drawText(v, {
      x: PAGE.w - PAGE.margin - f.widthOfTextAtSize(v, size),
      y: y - size,
      size,
      font: f,
    });
    y -= size + 6;
  }

  if (doc.notes) {
    y -= 8;
    text("Observações", { size: 11, bold: true });
    text(doc.notes);
  }
  for (const l of doc.links) text(`${l.label}: ${l.url}`, { size: 8, color: gray });

  return pdf.save();
}
