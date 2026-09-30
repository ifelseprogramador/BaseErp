import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/core/db";
import { shareDocumentSchema, type ShareDocument } from "./document";
import { hashShareToken } from "./create";

/** Leitura pública (sem sessão) via função SECURITY DEFINER; `null` se inválido/expirado/revogado. */
export async function getPublicSharedDocument(
  token: string,
): Promise<{ doc: ShareDocument; expiresAt: string } | null> {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  const rows = await db.execute(
    sql`select public.get_shared_document(${hashShareToken(token)}) as result`,
  );
  const result = (
    rows as unknown as { result: { payload: unknown; expiresAt: string } | null }[]
  )[0]?.result;
  if (!result) return null;
  const parsed = shareDocumentSchema.safeParse(result.payload);
  return parsed.success ? { doc: parsed.data, expiresAt: result.expiresAt } : null;
}
