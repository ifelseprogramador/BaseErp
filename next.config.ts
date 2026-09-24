import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Evita que o Next suba a árvore de diretórios até /home/eduardo/code
  // (que pode ter outro package-lock.json de outro projeto) ao resolver
  // a raiz do workspace.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
