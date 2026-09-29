const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Preto/branco quase puro (mesmos tokens de `--foreground` claro/escuro
 * em `globals.css`) escolhido pelo brilho percebido da cor de fundo
 * (fórmula YIQ — heurística simples e suficiente pra saber se o fundo é
 * "claro" ou "escuro", sem precisar de contraste WCAG completo).
 */
function contrastingForeground(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140 ? "oklch(0.145 0 0)" : "oklch(0.985 0 0)";
}

/**
 * Sobrescreve variáveis de tema em `:root` pra toda a organização
 * logada — um `<style>` funciona em qualquer ponto do DOM (não precisa
 * estar no `<head>`, `:root` sempre resolve pro elemento raiz do
 * documento), forma mais robusta que `style` inline num elemento
 * aninhado (depende de indireção de variável CSS incerta o bastante pra
 * não confiar sem testar contra produção — ver docs/decisoes.md).
 *
 * Dois controles independentes (não um derivado do outro — são tokens
 * de tema diferentes): `primaryColor` sobrescreve `--primary`/
 * `--color-primary` (botões/destaques, em qualquer tela); `sidebarColor`
 * sobrescreve `--sidebar`/`--sidebar-foreground` (fundo e texto do menu
 * lateral) — o texto é recalculado pelo brilho da cor escolhida, senão
 * um fundo claro escolhido pelo usuário deixaria o texto (pensado pro
 * fundo escuro padrão) ilegível.
 *
 * Revalida o formato hex de novo aqui (mesma regex do Zod em
 * `core/profile/actions.ts`) antes de interpolar — nunca confiar
 * cegamente num valor vindo do banco na hora de montar CSS bruto.
 */
export function OrgBrandingStyle({
  primaryColor,
  sidebarColor,
}: {
  primaryColor: string | null;
  sidebarColor: string | null;
}) {
  const rules: string[] = [];

  if (primaryColor && HEX_COLOR.test(primaryColor)) {
    rules.push(`--primary: ${primaryColor};`, `--color-primary: ${primaryColor};`);
  }
  if (sidebarColor && HEX_COLOR.test(sidebarColor)) {
    rules.push(
      `--sidebar: ${sidebarColor};`,
      `--sidebar-foreground: ${contrastingForeground(sidebarColor)};`,
    );
  }

  if (rules.length === 0) return null;

  return <style>{`:root { ${rules.join(" ")} }`}</style>;
}
