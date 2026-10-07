import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Evita que o Next suba a árvore de diretórios até /home/eduardo/code
  // (que pode ter outro package-lock.json de outro projeto) ao resolver
  // a raiz do workspace.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Só em DESENVOLVIMENTO: o Next bloqueia por padrão requisições aos recursos
  // internos do dev server (HMR, overlay) vindas de qualquer endereço que não
  // seja localhost — com o app aberto por um túnel (ngrok, Cloudflare), a
  // página carrega mas o JavaScript não assume e os botões não respondem.
  // Estes são os endereços de túnel mais comuns; não tem efeito em produção.
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.dev",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
