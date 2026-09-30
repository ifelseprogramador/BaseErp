import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { withOrg } from "@/core/auth";
import { eq } from "drizzle-orm";
import { organizationEmailSettings, sharedDocuments } from "@/db/schema";
import { resolveOrigin } from "./origin";
import { shareDocumentSchema, SHARE_KIND_LABELS, type ShareDocumentInput } from "./document";
import { DEFAULT_SHARE_TEMPLATE, type ShareVars } from "./template";

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
  /** Tipo do documento (chave para guardar o modelo de mensagem preferido). */
  kind?: string;
  /** Modelo padrão da mensagem e valores das variáveis (editáveis no botão). */
  template?: string;
  vars?: ShareVars;
  recipient?: { phone?: string; email?: string };
  emailEnabled?: boolean;
  expiresAt?: string;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  return resolveOrigin(
    process.env.NEXT_PUBLIC_SITE_URL,
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto"),
  );
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
    kind: doc.kind,
    template: DEFAULT_SHARE_TEMPLATE,
    vars: {
      nome: doc.customerName,
      primeiro_nome: doc.customerName?.split(" ")[0] || "tudo bem",
      documento: SHARE_KIND_LABELS[doc.kind].toLowerCase(),
      numero: doc.number,
      total: doc.totals.find((t) => t.strong)?.value ?? doc.totals.at(-1)?.value,
      empresa: doc.issuerName,
      link: url,
    },
    recipient: {
      phone: r.phone ? r.phone.replace(/\D/g, "") : undefined,
      email: r.email ?? undefined,
    },
    emailEnabled,
    expiresAt: expiresAt.toISOString(),
  };
}
