import { ImageResponse } from "next/og";
import { BRAND } from "@/core/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícone pra "Adicionar à tela de início" no iOS — mesma marca de
 * `icon.tsx`, só maior (ver comentário lá pro porquê do SVG na mão). */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BRAND.primaryHex,
        borderRadius: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="110"
        height="110"
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
    </div>,
    { ...size },
  );
}
