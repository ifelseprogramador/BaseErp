import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/core/env";

// "/d/" = link público de documento compartilhado com o cliente (core/share).
// "/api/cron/" = rotas do Vercel Cron (sem sessão de usuário; cada uma exige
// `Authorization: Bearer <CRON_SECRET>` por conta própria — sem estar aqui, o
// cron receberia um redirecionamento para /login em vez de rodar).
// "/api/telegram/webhook" = respostas do dono pelo Telegram (a rota valida o
// segredo do cabeçalho e o chat do dono por conta própria).
const PUBLIC_PATHS = ["/login", "/d/", "/api/cron/", "/api/telegram/webhook"];

/** O caminho dispensa sessão de usuário? (Puro, para teste.) */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

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

  const publicPath = isPublicPath(request.nextUrl.pathname);

  if (!user && !publicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
