/**
 * Formato de retorno padrão de toda Server Action de módulo (create/update/
 * delete): nunca um `throw` engolido pelo form, sempre um resultado
 * tipado que o componente sabe exibir. Ver "Convenções" em
 * docs/arquitetura.md.
 */
export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string[]>;
  message?: string;
}
