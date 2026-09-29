/**
 * Configuração de marca do vertical — o ÚNICO arquivo que muda entre o
 * BaseERP e cada vertical nascido dele (Prisma, e os que vierem depois)
 * nos pontos de UI compartilhados (sidebar, header, favicon, imagem de
 * compartilhamento, tela de login). Todo o resto desses arquivos é
 * idêntico entre os projetos de propósito — é o que permite sincronizar
 * `core/`/`components/`/`app/(auth)`/`app/(app)/layout.tsx` automaticamente
 * (`scripts/sync-to-children.sh` + hook `post-commit`) sem apagar a
 * identidade visual de ninguém.
 *
 * Ao nascer um vertical novo a partir deste template: o ÚNICO arquivo
 * que precisa mudar aqui é este. Nunca edite `iconPaths` copiando de
 * qualquer ícone lucide-react (`node_modules/lucide-react/dist/esm/icons/<nome>.mjs`,
 * campo `node`) — os `d` de cada `<path>`, em ordem, viewBox 24x24.
 */
export interface BrandConfig {
  name: string;
  tagline: string;
  /** Cor primária em hex — mesma cor de `--primary` em `globals.css`
   * (modo claro), mas fixa: `next/og` (favicon, imagem de
   * compartilhamento) não lê variável CSS nem sabe resolver OKLCH. */
  primaryHex: string;
  /** `d` de cada `<path>` do ícone, viewBox 24x24 (mesmo formato do
   * lucide-react) — usado tanto no ícone renderizado normalmente
   * (`components/brand-icon.tsx`) quanto nas imagens geradas
   * (`app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`),
   * que não conseguem renderizar um componente React qualquer, só um
   * subconjunto de SVG/HTML puro (ver comentário em `app/icon.tsx`).
   */
  iconPaths: string[];
  /** Link do aviso de privacidade mostrado na tela de login — só os
   * verticais com o módulo de privacidade/LGPD (`app/(auth)/privacidade`)
   * têm isso; deixe `undefined` num vertical sem essa tela (o link some
   * sozinho, ver `app/(auth)/login/page.tsx`). */
  privacyPolicyHref?: string;
}

export const BRAND: BrandConfig = {
  name: "BaseERP",
  tagline: "Base multi-tenant para ERPs modulares.",
  primaryHex: "#195cc7",
  // lucide-react "building-2" (alias de "building-complex")
  iconPaths: [
    "M10 12h4",
    "M10 8h4",
    "M14 21v-3a2 2 0 0 0-4 0v3",
    "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
    "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",
  ],
};
