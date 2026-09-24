/**
 * Dinheiro é sempre representado como centavos (inteiro), do banco à
 * lógica de negócio. Só a borda de exibição converte para reais
 * formatados. Nunca usar `number` fracionário (float) para valores
 * monetários — ver "Convenções" em docs/arquitetura.md.
 */

export type Cents = number;

/** Converte reais (ex.: form do usuário, "150,90") para centavos inteiros. */
export function toCents(reais: number): Cents {
  return Math.round(reais * 100);
}

/**
 * Converte o texto digitado num campo de valor (ex.: "150,90", "150.90",
 * "1.234,56") para centavos inteiros — `null` se não for um número
 * válido. Aceita vírgula ou ponto como separador decimal (`type="text"`,
 * não `type="number"`, evita o spinner nativo e o parsing estranho de
 * decimal em navegadores com locale diferente).
 */
export function parseReaisInput(input: string): Cents | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Remove separador de milhar (ponto quando há vírgula decimal depois),
  // depois troca a vírgula decimal por ponto.
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return toCents(value);
}

/** Formata centavos como moeda brasileira, ex.: 15090 -> "R$ 150,90". */
export function formatCents(cents: Cents): string {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
  // O ICU do Node insere um espaço não separável (U+00A0) entre "R$" e o
  // valor; normalizamos para espaço comum (U+0020) para não surpreender
  // quem lê a string (testes, logs, cópia de texto na UI).
  return formatted.replace(/ /g, " ");
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

export function multiplyCents(unitCents: Cents, quantity: number): Cents {
  return Math.round(unitCents * quantity);
}

/**
 * Aplica um desconto em centavos sobre um subtotal em centavos, sem nunca
 * deixar o resultado negativo (desconto maior que o subtotal vira zero).
 */
export function applyDiscount(subtotalCents: Cents, discountCents: Cents): Cents {
  return Math.max(0, subtotalCents - discountCents);
}
