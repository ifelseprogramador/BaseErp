/**
 * Carrega `.env.local` para scripts de CLI (migrate, seed, drizzle-kit)
 * que rodam fora do Next.js — `dotenv/config` sozinho só lê `.env`, não
 * `.env.local` (essa convenção é do Next, não do pacote `dotenv`). Cai
 * para `.env` se `.env.local` não existir.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

const root = path.resolve(__dirname, "../..");
const envLocalPath = path.join(root, ".env.local");

config({ path: existsSync(envLocalPath) ? envLocalPath : path.join(root, ".env") });
