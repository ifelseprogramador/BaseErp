/**
 * Logger estruturado central da aplicação.
 *
 * Por quê: quando algo quebra em produção, o objetivo é achar em minutos
 * *qual usuário, em qual organização, em qual ação, com quais dados*.
 * Por isso:
 *   - Nunca use `console.*` diretamente (o ESLint bloqueia fora deste
 *     arquivo e dos arquivos de config) — sempre passe por este logger.
 *   - Todo log carrega contexto (requestId, userId, organizationId,
 *     módulo, ação) via `logger.withContext(...)`, nunca só a mensagem.
 *   - Segredos e dados pessoais nunca vão para o log — `redact()` cobre
 *     as chaves sensíveis conhecidas.
 *
 * Uso típico dentro de uma Server Action (ver `core/auth.ts#withOrg`):
 *
 *   const { log } = await withOrg();
 *   log.info("modulo.acao", { id });
 *   try {
 *     ...
 *   } catch (err) {
 *     log.error("modulo.acao.falhou", { err });
 *     throw err;
 *   }
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Em dev, tudo (debug pra cima) é útil. Em produção, poupamos volume/custo
// dos logs e só guardamos o que importa para investigar incidentes.
const MIN_LEVEL: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug";

const isProduction = process.env.NODE_ENV === "production";

/** Chaves que nunca devem aparecer em um log, em nenhuma profundidade. */
const SENSITIVE_KEY_PATTERN =
  /(password|senha|token|secret|api[-_]?key|authorization|cookie|cpf|cnpj|documento)/i;

const REDACTED = "[redacted]";

/**
 * Remove recursivamente valores de chaves sensíveis de um objeto de
 * contexto, sem lançar em ciclos ou tipos inesperados. Nunca mude isto sem
 * revisar a lista de chaves acima.
 */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value as object)) {
    return "[circular]";
  }
  seen.add(value as object);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: isProduction ? undefined : value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(val, seen);
  }
  return result;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  time: string;
  context?: LogContext;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function write(entry: LogEntry) {
  if (isProduction) {
    // Uma linha JSON por evento — é o formato que a Vercel indexa e permite
    // buscar por requestId/organizationId nos Vercel Logs.
    const line = JSON.stringify(entry);
    if (entry.level === "error" || entry.level === "warn") {
      console.error(line);
    } else {
      console.log(line);
    }
    return;
  }

  // Em dev, formato legível no terminal.
  const prefix = `[${entry.time}] ${entry.level.toUpperCase().padEnd(5)} ${entry.message}`;
  const args = entry.context ? [prefix, entry.context] : [prefix];
  if (entry.level === "error") {
    console.error(...args);
  } else if (entry.level === "warn") {
    console.warn(...args);
  } else {
    console.log(...args);
  }
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Retorna um novo logger que sempre inclui `context` nos logs seguintes. */
  withContext(context: LogContext): Logger;
}

function createLogger(baseContext: LogContext = {}): Logger {
  function log(level: LogLevel, message: string, context?: LogContext) {
    if (!shouldLog(level)) return;
    const merged = { ...baseContext, ...context };
    write({
      level,
      message,
      time: new Date().toISOString(),
      context: Object.keys(merged).length > 0 ? (redact(merged) as LogContext) : undefined,
    });
  }

  return {
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
    withContext: (context) => createLogger({ ...baseContext, ...context }),
  };
}

/** Logger raiz, sem contexto. Prefira `logger.withContext(...)` em código de request. */
export const logger = createLogger();
