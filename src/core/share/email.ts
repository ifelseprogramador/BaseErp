import "server-only";
import nodemailer from "nodemailer";
import { decryptSecret } from "@/core/crypto";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  passwordEncrypted: string;
  fromName: string | null;
  fromEmail: string;
}

/**
 * Bloqueia hosts que apontam para a rede interna (defesa básica contra SSRF:
 * quem configura o SMTP não pode fazer o servidor sondar localhost/rede
 * privada). Não cobre DNS rebinding — ver docs/decisoes.md.
 */
export function isAllowedSmtpHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  if (h.includes(":")) return false; // IPv6 literal
  return true;
}

function transporter(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.username, pass: decryptSecret(cfg.passwordEncrypted) },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function verifySmtp(cfg: SmtpConfig): Promise<void> {
  await transporter(cfg).verify();
}

export async function sendSmtpMail(
  cfg: SmtpConfig,
  mail: {
    to: string;
    replyTo?: string;
    subject: string;
    text: string;
    attachment?: { filename: string; content: Uint8Array };
  },
): Promise<void> {
  await transporter(cfg).sendMail({
    from: cfg.fromName ? { name: cfg.fromName, address: cfg.fromEmail } : cfg.fromEmail,
    to: mail.to,
    replyTo: mail.replyTo,
    subject: mail.subject,
    text: mail.text,
    attachments: mail.attachment
      ? [
          {
            filename: mail.attachment.filename,
            content: Buffer.from(mail.attachment.content),
            contentType: "application/pdf",
          },
        ]
      : [],
  });
}
