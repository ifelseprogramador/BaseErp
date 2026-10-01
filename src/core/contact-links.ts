/** Links de contato (WhatsApp, telefone, e-mail) — puro, usado por selos e pelo botão de enviar. */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** Número com DDI: assume Brasil (55) quando vier só DDD + número (10 ou 11 dígitos). */
export function withCountryCode(phone: string | null | undefined): string {
  const d = phoneDigits(phone);
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

/** Celular brasileiro (11 dígitos, 9 depois do DDD) provavelmente tem WhatsApp; fixo, não. */
export function isLikelyMobile(phone: string | null | undefined): boolean {
  const d = phoneDigits(phone).replace(/^55(?=\d{10,11}$)/, "");
  return d.length === 11 && d[2] === "9";
}

export function whatsappLink(phone: string | null | undefined, text?: string): string {
  const base = `https://wa.me/${withCountryCode(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telLink(phone: string | null | undefined): string {
  return `tel:+${withCountryCode(phone)}`;
}

/** "(11) 99999-8888" / "(11) 3333-4444"; outros formatos voltam como digitados. */
export function formatPhoneBr(phone: string | null | undefined): string {
  const raw = (phone ?? "").trim();
  const d = phoneDigits(raw).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}
