/**
 * Rotas PÚBLICAS (sem sessão de usuário) específicas de um vertical, além das do
 * template (`core/supabase/middleware.ts#PUBLIC_PATHS`). No BaseERP a lista é
 * vazia; cada vertical que precise (ex.: retorno de um provedor externo) edita o
 * SEU arquivo e o coloca em `VERTICAL_PATH_EXCLUDES` (scripts/foundation-paths.sh)
 * para a sincronização não o sobrescrever. Só constantes, sem imports: o
 * `proxy.ts` o carrega a cada request (não dá para usar o registro de módulos,
 * que só é preenchido quando o código dos módulos é importado).
 *
 * Cada rota listada precisa se autenticar por conta própria (token, segredo etc.).
 */
export const EXTRA_PUBLIC_PATHS: readonly string[] = [];
