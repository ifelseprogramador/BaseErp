import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia autenticada (AES-256-GCM) para segredos guardados por
 * organização (ex.: senha SMTP). A chave vem de `SETTINGS_ENCRYPTION_KEY`
 * (32 bytes em base64 ou 64 caracteres hex) — NUNCA fica no banco, então um
 * dump do Postgres sozinho não expõe os segredos. Formato gravado:
 * `v1:<iv b64>:<tag b64>:<dados b64>`.
 */
function loadKey(raw = process.env.SETTINGS_ENCRYPTION_KEY): Buffer {
  if (!raw) {
    throw new Error("SETTINGS_ENCRYPTION_KEY não configurada (gere com: openssl rand -base64 32).");
  }
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SETTINGS_ENCRYPTION_KEY deve ter 32 bytes (base64 ou 64 caracteres hex).");
  }
  return key;
}

export function encryptSecret(plain: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", loadKey(rawKey), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string, rawKey?: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Segredo em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", loadKey(rawKey), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString(
    "utf8",
  );
}
