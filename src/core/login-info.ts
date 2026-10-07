/**
 * Lê, dos cabeçalhos da requisição, o IP e a localização aproximada de quem
 * está entrando. A hospedagem é quem sabe a localização: a Vercel manda
 * `x-vercel-ip-city/-country-region/-country` e a Cloudflare `cf-ipcountry`.
 * Sem esses cabeçalhos (ex.: rodando na máquina local) cidade/região/país ficam
 * vazios. Puro (sem `server-only`) para ser testado.
 */
export interface ClientInfo {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  userAgent: string | null;
}

type HeaderReader = { get(name: string): string | null };

function decode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return value.trim() || null;
  }
}

export function extractClientInfo(h: HeaderReader): ClientInfo {
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("cf-connecting-ip")?.trim() ||
    null;
  const country = decode(h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"));
  return {
    ip,
    city: decode(h.get("x-vercel-ip-city")),
    region: decode(h.get("x-vercel-ip-country-region")),
    country: country && country !== "XX" ? country : null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/** IP de rede local/loopback (não há localização a mostrar). */
export function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  return (
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

/** "Cidade, UF, BR" com o que existir; `null` se nada for conhecido. */
export function formatLocation(info: Pick<ClientInfo, "city" | "region" | "country">) {
  const parts = [info.city, info.region, info.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** "Chrome · Android" a partir do User-Agent (aproximado, só para leitura rápida). */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "—";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Navegador";
  const os = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  return os ? `${browser} · ${os}` : browser;
}
