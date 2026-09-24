"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/core/supabase/server";
import { logger } from "@/core/logger";
import { IMPERSONATION_COOKIE } from "@/core/impersonation";
import { isPlatformAdmin } from "@/core/platform-admin";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export interface LoginState {
  error?: string;
}

async function getRequestId(): Promise<string | undefined> {
  const headerList = await headers();
  return headerList.get("x-request-id") ?? undefined;
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const requestId = await getRequestId();
  const log = logger.withContext({ requestId, module: "auth", action: "login" });

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    log.warn("auth.login.validacao_falhou", {
      fields: Object.keys(parsed.error.flatten().fieldErrors),
    });
    return { error: "Preencha e-mail e senha corretamente." };
  }

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    log.warn("auth.login.negado", { reason: error.message });
    return { error: "E-mail ou senha inválidos." };
  }

  log.info("auth.login.sucesso", { userId: data.user?.id });

  // Dono da plataforma cai direto no painel administrativo, não no app
  // da organização — ele pode não ter (ou não usar) nenhuma organização.
  if (data.user && (await isPlatformAdmin(data.user.id))) {
    redirect("/admin");
  }

  redirect("/");
}

export async function logout() {
  const requestId = await getRequestId();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();
  (await cookies()).delete(IMPERSONATION_COOKIE);

  logger.withContext({ requestId, module: "auth", action: "logout" }).info("auth.logout", {
    userId: user?.id,
  });

  redirect("/login");
}
