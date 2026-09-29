import { ImageResponse } from "next/og";
import { BRAND } from "@/core/brand";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Ícone da aba do navegador — a marca do vertical (`core/brand.ts`),
 * mesmo ícone da tela de login. Gerado em build/runtime (`next/og`),
 * não um arquivo estático: um `<svg>` só aceita os elementos que o
 * `satori` entende, por isso o ícone é montado com `<path>` cru
 * (`BRAND.iconPaths`) em vez de importar um componente lucide-react.
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BRAND.primaryHex,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
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
