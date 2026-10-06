/** Letras/dígitos sem caracteres ambíguos (0/O, 1/l/I) — pensado pra ser
 * digitado/ditado por telefone quando a senha provisória é repassada
 * (pelo dono da plataforma em `core/admin/`, ou pelo dono da conta em
 * `core/team/`). */
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length]).join(
    "",
  );
}
