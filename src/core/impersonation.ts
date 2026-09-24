/**
 * Modo suporte: o dono da plataforma "entra" numa organização para agir
 * em nome dela (ver `core/admin/actions.ts#startImpersonation` e
 * `core/auth.ts#getActiveOrg`). Guardado num cookie httpOnly só com o id
 * da organização — o cookie sozinho não dá acesso a nada: toda leitura
 * dele em `getActiveOrg()` reconfirma que o usuário da sessão atual É um
 * platform admin antes de honrar. Expira sozinho em 2h por segurança.
 */
export const IMPERSONATION_COOKIE = "baseerp_impersonate_org";
export const IMPERSONATION_MAX_AGE_SECONDS = 60 * 60 * 2;
