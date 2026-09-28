const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Sobrescreve `--primary` (e `--color-primary`, redundante de propósito
 * — depende de como o Tailwind v4 compila `@theme inline`, e um
 * `<style>` em `:root` é a forma mais robusta de garantir a cascata,
 * sem depender de indireção de variável CSS em elemento aninhado) para
 * toda a organização logada. `<style>` funciona em qualquer ponto do
 * DOM — não precisa estar no `<head>`, `:root` sempre resolve pro
 * elemento raiz do documento.
 *
 * Revalida o formato aqui de novo (mesma regex do Zod em
 * `core/profile/actions.ts`) antes de interpolar — nunca confiar cegamente
 * num valor vindo do banco na hora de montar CSS bruto.
 */
export function OrgBrandingStyle({ primaryColor }: { primaryColor: string | null }) {
  if (!primaryColor || !HEX_COLOR.test(primaryColor)) return null;

  return <style>{`:root { --primary: ${primaryColor}; --color-primary: ${primaryColor}; }`}</style>;
}
