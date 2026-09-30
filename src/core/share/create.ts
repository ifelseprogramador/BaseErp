import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { withOrg } from "@/core/auth";
import { eq } from "drizzle-orm";
import { organizationEmailSettings, sharedDocuments } from "@/db/schema";
import { shareDocumentSchema, buildShareMessage, type ShareDocumentInput } from "./document";

export const SHARE_DEFAULT_TTL_DAYS = 30;

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ShareRecipient {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ShareLinkResult {
  ok: boolean;
  message?: string;
  shareId?: string;
  url?: string;
  pdfUrl?: string;
  /** Mensagem pronta para WhatsApp/e-mail (editável no botão). */
  text?: string;
  recipient?: { phone?: string; email?: string };
  emailEnabled?: boolean;
  expiresAt?: string;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
}

/**
 * Cria o snapshot + link público de um documento. Chamado pela Server Action
 * de cada vertical (que monta o `ShareDocumentInput` do próprio domínio).
 * Exige sessão/organização (`withOrg`). O token (256 bits) só existe aqui e
 * na URL devolvida; no banco fica apenas o hash.
 */
export async function createSharedDocument(
  input: ShareDocumentInput,
  options: {
    recipient?: ShareRecipient;
    source?: { type: string; id: string };
    ttlDays?: number;
  } = {},
): Promise<ShareLinkResult> {
  const parsed = shareDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Não foi possível montar o documento para envio." };
  }
  const doc = parsed.data;
  const { organizationId, userId, log, withDb } = await withOrg();

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + (options.ttlDays ?? SHARE_DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000,
  );
  const r = options.recipient ?? {};

  const emailEnabled = await withDb(async (tx) => {
    const [cfg] = await tx
      .select({ enabled: organizationEmailSettings.enabled })
      .from(organizationEmailSettings)
      .where(eq(organizationEmailSettings.organizationId, organizationId))
      .limit(1);
    return Boolean(cfg?.enabled);
  });

  const [row] = await withDb((tx) =>
    tx
      .insert(sharedDocuments)
      .values({
        organizationId,
        tokenHash: hashShareToken(token),
        kind: doc.kind,
        title: doc.title,
        payload: doc,
        recipientName: r.name ?? null,
        recipientPhone: r.phone ?? null,
        recipientEmail: r.email ?? null,
        sourceType: options.source?.type ?? null,
        sourceId: options.source?.id ?? null,
        createdBy: userId,
        expiresAt,
      })
      .returning({ id: sharedDocuments.id }),
  );

  const origin = await siteOrigin();
  const url = `${origin}/d/${token}`;
  log.info("share.criar", { shareId: row.id, kind: doc.kind });

  return {
    ok: true,
    shareId: row.id,
    url,
    pdfUrl: `${url}/pdf`,
    text: buildShareMessage(doc, url),
    recipient: {
      phone: r.phone ? r.phone.replace(/\D/g, "") : undefined,
      email: r.email ?? undefined,
    },
    emailEnabled,
    expiresAt: expiresAt.toISOString(),
  };
}
