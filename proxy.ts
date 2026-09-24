import type { NextRequest } from "next/server";
import { updateSession } from "@/core/supabase/middleware";

/**
 * `proxy.ts` é o antigo `middleware.ts` (renomeado no Next 16, mesma
 * semântica). Duas responsabilidades:
 *   1. Gerar um `x-request-id` por request e propagá-lo nos headers, para
 *      que todo log da request (Server Components/Actions) carregue o
 *      mesmo id.
 *   2. Delegar para `updateSession`, que renova a sessão do Supabase e
 *      redireciona para /login quando necessário.
 */
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const requestId = crypto.randomUUID();
  requestHeaders.set("x-request-id", requestId);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    // Roda em tudo, exceto assets estáticos e otimização de imagem.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
