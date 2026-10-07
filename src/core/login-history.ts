import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { runWithUserContext } from "@/core/db";
import { logger } from "@/core/logger";
import { loginEvents, memberships, organizations } from "@/db/schema";
import { extractClientInfo } from "@/core/login-info";

/**
 * Registra um login bem-sucedido (quem, quando, IP e localização). Nunca lança:
 * falhar ao gravar o histórico não pode impedir ninguém de entrar.
 */
export async function recordLogin(user: { id: string; email?: string | null }) {
  try {
    const info = extractClientInfo(await headers());
    await runWithUserContext(user.id, async (db) => {
      const orgs = await db
        .select({ name: organizations.name })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
        .where(eq(memberships.userId, user.id));
      await db.insert(loginEvents).values({
        userId: user.id,
        email: user.email ?? null,
        organizationName: orgs.map((o) => o.name).join(", ") || null,
        ...info,
      });
    });
  } catch (err) {
    logger.error("auth.login.historico_falhou", { err, userId: user.id });
  }
}
