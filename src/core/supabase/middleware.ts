import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/core/env";

const PUBLIC_PATHS = ["/login"];

/**
 * Renova a sessão do Supabase a cada request e redireciona para /login
 * quando não há usuário autenticado. Chamado a partir de `proxy.ts` (o
 * antigo `middleware.ts`, renomeado no Next 16).
 *
 * `requestHeaders`, quando informado, substitui os headers originais da
 * request nas respostas geradas aqui — é como `proxy.ts` propaga o
 * `x-request-id` para o restante do pipeline (Server Components/Actions).
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers = request.headers,
) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANTE: não remover este `getUser()`. É ele quem de fato valida o
  // token junto ao Supabase Auth e dispara o refresh do cookie de sessão.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
