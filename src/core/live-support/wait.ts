/**
 * Regras puras (testáveis sem banco) da espera por atendimento no
 * "Chamar suporte". O dono da plataforma configura quanto o usuário espera
 * (`platform_settings.support_wait_seconds`); passado esse tempo sem alguém
 * aceitar, o pedido vira `missed` e o dono é avisado pelo Telegram.
 */

export const DEFAULT_SUPPORT_WAIT_SECONDS = 30;
export const MIN_SUPPORT_WAIT_SECONDS = 5;
export const MAX_SUPPORT_WAIT_SECONDS = 300;

/** "Online" = o painel /admin bateu presença há menos que isto. A batida vem a
 * cada ~60 s; 150 s (2,5 batidas) tolera uma batida perdida. Se o dono fecha o
 * painel, o sistema ainda o considera online por até esse tempo: o cliente espera
 * `support_wait_seconds` e, sem atendimento, o pedido vira "perdido" e o Telegram
 * avisa, como sempre. É o preço de poupar chamadas à Vercel e ao Supabase. */
export const ADMIN_ONLINE_WINDOW_SECONDS = 150;
export const ADMIN_HEARTBEAT_INTERVAL_MS = 60_000;
/** O servidor ignora uma batida que chega menos de N s depois da anterior (várias
 * abas/aparelhos do mesmo dono): o UPDATE nem acontece. */
export const ADMIN_HEARTBEAT_MIN_GAP_SECONDS = 10;
/** Sem mexer na tela (mouse, teclado, toque, rolagem) por tanto tempo, o painel
 * para de bater: aba esquecida aberta não deve manter "online" nem gastar chamadas. */
export const ADMIN_IDLE_PAUSE_MS = 20 * 60_000;

/**
 * Decide, no navegador e SEM rede, se esta aba deve bater presença agora. Só bate
 * quando: a aba está visível; a pessoa mexeu na tela há menos de
 * `ADMIN_IDLE_PAUSE_MS`; e ninguém (nem outra aba aberta do mesmo navegador)
 * bateu há menos de 80% do intervalo. `lastBeatAt` é compartilhado entre abas.
 */
export function shouldSendAdminHeartbeat(input: {
  now: number;
  lastBeatAt: number | null;
  lastActivityAt: number;
  visible: boolean;
}): boolean {
  if (!input.visible) return false;
  if (input.now - input.lastActivityAt > ADMIN_IDLE_PAUSE_MS) return false;
  if (
    input.lastBeatAt !== null &&
    input.now - input.lastBeatAt < ADMIN_HEARTBEAT_INTERVAL_MS * 0.8
  ) {
    return false;
  }
  return true;
}

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
