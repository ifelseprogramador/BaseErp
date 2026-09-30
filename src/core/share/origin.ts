/** Origem do link público. `configured` (NEXT_PUBLIC_SITE_URL) vence, mas vazio/espaços = não configurado. */
export function resolveOrigin(
  configured: string | undefined,
  host: string | null,
  forwardedProto: string | null,
): string {
  const site = configured?.trim().replace(/\/$/, "");
  if (site) return site;
  const proto = forwardedProto ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
