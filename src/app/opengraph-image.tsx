import { ImageResponse } from "next/og";
import { BRAND } from "@/core/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Imagem mostrada ao compartilhar um link do sistema (WhatsApp,
 * Slack, Twitter/X, etc. — todos leem a meta tag `og:image`, que o
 * Next.js gera sozinho a partir deste arquivo). Mesma marca da tela de
 * login: ícone + nome + slogan (`core/brand.ts`), sobre o fundo escuro
 * do tema.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        background: "#0a0a0f",
      }}
    >
      <div
        style={{
          width: 160,
          height: 160,
          background: BRAND.primaryHex,
          borderRadius: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="96"
          height="96"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {BRAND.iconPaths.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 72, fontWeight: 700, color: "white" }}>{BRAND.name}</div>
        <div style={{ fontSize: 30, color: "#9ca3af" }}>{BRAND.tagline}</div>
      </div>
    </div>,
    { ...size },
  );
}
