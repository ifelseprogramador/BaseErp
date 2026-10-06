/**
 * Regras puras (testáveis sem banco) da espera por atendimento no
 * "Chamar suporte". O dono da plataforma configura quanto o usuário espera
 * (`platform_settings.support_wait_seconds`); passado esse tempo sem alguém
 * aceitar, o pedido vira `missed` e o dono é avisado pelo Telegram.
 */

export const DEFAULT_SUPPORT_WAIT_SECONDS = 30;
export const MIN_SUPPORT_WAIT_SECONDS = 5;
export const MAX_SUPPORT_WAIT_SECONDS = 300;

/** "Online" = o painel /admin bateu presença há menos que isto (a batida
 * vem a cada ~20 s; 45 s tolera uma batida perdida). */
export const ADMIN_ONLINE_WINDOW_SECONDS = 45;
export const ADMIN_HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Quanto um pedido que o ADMIN abriu (pedir acesso à tela) fica esperando a
 * pessoa responder "Permitir/Recusar" antes de ser encerrado sozinho. Sem
 * prazo, um pedido que ninguém respondeu ficava pendurado para sempre,
 * mostrando o aviso a quem entrasse (foi o caso real que originou o TTL do
 * Prisma). Vale desde o momento do PEDIDO do admin — mesmo que a sessão
 * original (um pedido perdido) seja de horas atrás.
 */
export const ADMIN_REQUEST_TTL_MINUTES = 10;

export function computeAdminRequestExpiresAt(now: Date): Date {
  return new Date(now.getTime() + ADMIN_REQUEST_TTL_MINUTES * 60_000);
}

/** Folga do relógio entre navegador e servidor ao conferir o fim da espera. */
const EXPIRY_GRACE_MS = 2_000;

export function clampWaitSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SUPPORT_WAIT_SECONDS;
  return Math.min(MAX_SUPPORT_WAIT_SECONDS, Math.max(MIN_SUPPORT_WAIT_SECONDS, Math.round(value)));
}

export function computeExpiresAt(now: Date, waitSeconds: number): Date {
  return new Date(now.getTime() + clampWaitSeconds(waitSeconds) * 1000);
}

/** O servidor só marca "perdida" depois do prazo (com pequena folga): o
 * navegador do usuário dispara a expiração, mas não é ele que decide. */
export function isRequestExpired(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return false;
  return now.getTime() + EXPIRY_GRACE_MS >= expiresAt.getTime();
}

/** Texto do aviso enviado ao dono da plataforma (Telegram). Só nome da
 * pessoa e da empresa — nenhum dado do sistema do cliente. */
export function formatSupportAlert(input: {
  userName: string;
  organizationName: string;
  adminUrl?: string;
}): string {
  const lines = [
    "🆘 Pedido de suporte sem atendimento",
    `${input.userName} da empresa ${input.organizationName} está precisando de ajuda.`,
  ];
  if (input.adminUrl) lines.push(`Abra o painel para pedir acesso à tela: ${input.adminUrl}`);
  return lines.join("\n");
}

/** Mensagem de chat aceita: texto não vazio, até 1000 caracteres. */
export const MAX_CHAT_MESSAGE_LENGTH = 1000;

export function normalizeChatMessage(raw: string): string | null {
  const body = raw.trim();
  if (!body) return null;
  return body.slice(0, MAX_CHAT_MESSAGE_LENGTH);
}
