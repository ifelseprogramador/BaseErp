/**
 * Código SQLSTATE do Postgres de um erro de banco. O Drizzle embrulha o erro
 * do driver (`DrizzleQueryError`, mensagem "Failed query: …") e deixa o
 * original em `cause`; checar só `err.code` NÃO funciona e faz toda violação
 * de regra do banco cair no erro genérico. Aqui se anda pela cadeia de `cause`.
 */
export function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** 23505: já existe um registro com esse valor único (ex.: placa por oficina). */
export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23505";
}

/** 23503: o registro está ligado a outros (FK) e não pode ser removido/criado assim. */
export function isForeignKeyViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23503";
}
