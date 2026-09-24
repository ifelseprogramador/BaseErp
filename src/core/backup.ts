import "server-only";
import { and, desc, eq, getTableColumns, inArray, type Table } from "drizzle-orm";
import type { Database } from "@/core/db";
import { organizations } from "@/db/schema/tenancy";
import { organizationBackupSettings, organizationBackups } from "@/db/schema/backup";

/** Quantos backups automáticos guardar por organização — o cron
 * (`api/cron/backup/route.ts`) apaga os mais antigos além disso a cada
 * rodada. */
export const AUTO_BACKUP_RETENTION = 7;

export const BACKUP_VERSION = 1;

export interface ColumnDescriptor {
  name: string;
  /** Tipo lido direto da definição Drizzle/Postgres real — serve de
   * referência pra recriar a estrutura numa ferramenta/banco diferente.
   * Enum vem como `enum(valor1|valor2|...)`. */
  sqlType: string;
  notNull: boolean;
}

export interface TableBackup {
  columns: ColumnDescriptor[];
  rows: Record<string, unknown>[];
}

export interface BackupFile {
  version: number;
  exportedAt: string;
  scope: "organization";
  organizationId: string;
  organizationName: string;
  tables: Record<string, TableBackup>;
}

export interface RestoreSummary {
  table: string;
  inserted: number;
  skipped: number;
}

export function describeColumns(table: Table): ColumnDescriptor[] {
  const columns = getTableColumns(table);
  return Object.values(columns).map((col) => ({
    name: col.name,
    sqlType: col.enumValues?.length
      ? `enum(${col.enumValues.join("|")})`
      : col.columnType.replace(/^Pg/, "").toLowerCase(),
    notNull: col.notNull,
  }));
}

/**
 * Colunas de data por tabela de módulo de negócio — precisam virar `Date`
 * de novo ao restaurar (o JSON só guarda a versão ISO string). Um
 * vertical que criar módulos com backup próprio deve registrar as
 * colunas de data deles em `registerBackupTable` (abaixo), não editar
 * este arquivo.
 */
const DATE_COLUMNS: Record<string, string[]> = {};

function reviveDates(row: Record<string, unknown>, table: string): Record<string, unknown> {
  const dateColumns = DATE_COLUMNS[table];
  if (!dateColumns) return row;
  const revived = { ...row };
  for (const col of dateColumns) {
    if (typeof revived[col] === "string") revived[col] = new Date(revived[col] as string);
  }
  return revived;
}

interface BackupTableDefinition {
  key: string;
  table: Table;
  dateColumns?: string[];
}

/**
 * Registro de tabelas de MÓDULO de negócio que entram no backup/restore
 * de uma organização. BaseERP não tem nenhum módulo ainda (ver
 * src/modules/README.md) — este projeto só define o backup de fundação
 * (nenhuma tabela de negócio). Um vertical que crie `modules/<modulo>/`
 * chama `registerBackupTable(...)` a partir do próprio `module.ts` para
 * entrar automaticamente no backup/restore por organização.
 */
const BACKUP_TABLES: BackupTableDefinition[] = [];

export function registerBackupTable(def: BackupTableDefinition) {
  BACKUP_TABLES.push(def);
  if (def.dateColumns) {
    DATE_COLUMNS[def.key] = def.dateColumns;
  }
}

/**
 * Backup completo dos dados de NEGÓCIO de uma organização (tabelas
 * registradas via `registerBackupTable`). Não inclui tabelas de
 * plataforma (`organizations`, `memberships`) — o backup de uma
 * organização é só o que É DELA, não a conta em si.
 */
export async function buildOrgBackup(
  db: Database,
  organizationId: string,
  organizationName: string,
): Promise<BackupFile> {
  const tables: Record<string, TableBackup> = {};

  for (const def of BACKUP_TABLES) {
    const orgIdColumn = (def.table as unknown as Record<string, { name: string }>).organizationId;
    const rows = await db
      .select()
      .from(def.table)
      .where(eq(orgIdColumn as never, organizationId));
    tables[def.key] = { columns: describeColumns(def.table), rows };
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    scope: "organization",
    organizationId,
    organizationName,
    tables,
  };
}

/**
 * Restaura um backup DENTRO da organização de quem está chamando —
 * `organizationId` nunca vem do arquivo (poderia ter sido gerado por
 * outra organização, ou editado à mão): todo campo `organizationId` de
 * cada linha é sobrescrito com o da sessão atual antes de inserir.
 *
 * Idempotente por design (`onConflictDoNothing`, chaveado pelo `id` já
 * presente nas linhas): rodar a restauração duas vezes nunca duplica nem
 * quebra — só preenche o que ainda não existe.
 */
export async function restoreOrgBackup(
  db: Database,
  organizationId: string,
  backup: BackupFile,
): Promise<RestoreSummary[]> {
  const summary: RestoreSummary[] = [];

  for (const def of BACKUP_TABLES) {
    const tableBackup = backup.tables[def.key];
    const rows = tableBackup?.rows ?? [];
    if (rows.length === 0) {
      summary.push({ table: def.key, inserted: 0, skipped: 0 });
      continue;
    }
    const stamped = rows.map((row) => ({
      ...reviveDates(row, def.key),
      organizationId,
    }));
    const inserted = await db.insert(def.table).values(stamped).onConflictDoNothing().returning();
    summary.push({
      table: def.key,
      inserted: inserted.length,
      skipped: rows.length - inserted.length,
    });
  }

  return summary;
}

export interface SystemBackupFile {
  version: number;
  exportedAt: string;
  scope: "system";
  organizations: BackupFile[];
}

/**
 * Backup de TODAS as organizações da plataforma, pro dono — só exporta
 * (sem restauração de sistema inteiro, o mesmo risco documentado no
 * mecano-erp: restaurar tudo de volta cruzaria `memberships.userId` com
 * contas do Supabase Auth que podem não existir mais). Cada organização
 * dentro do arquivo, isoladamente, PODE ser restaurada com
 * `restoreOrgBackup`.
 */
export async function buildSystemBackup(db: Database): Promise<SystemBackupFile> {
  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations);
  const perOrg = await Promise.all(orgs.map((org) => buildOrgBackup(db, org.id, org.name)));

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    scope: "system",
    organizations: perOrg,
  };
}

/** "Sem linha" = ligado — o padrão é fazer backup automático, não
 * precisa a pessoa opt-in (ela pode DESLIGAR, gravando `false`). */
export async function getAutoBackupEnabled(db: Database, organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ autoBackupEnabled: organizationBackupSettings.autoBackupEnabled })
    .from(organizationBackupSettings)
    .where(eq(organizationBackupSettings.organizationId, organizationId))
    .limit(1);

  return row?.autoBackupEnabled ?? true;
}

export async function setAutoBackupEnabled(db: Database, organizationId: string, enabled: boolean) {
  await db
    .insert(organizationBackupSettings)
    .values({ organizationId, autoBackupEnabled: enabled })
    .onConflictDoUpdate({
      target: organizationBackupSettings.organizationId,
      set: { autoBackupEnabled: enabled, updatedAt: new Date() },
    });
}

/** Todas as organizações com backup automático ligado — usado pelo cron
 * diário, que roda com o papel privilegiado de admin (ver
 * api/cron/backup/route.ts). */
export async function listOrgsWithAutoBackupEnabled(
  db: Database,
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      autoBackupEnabled: organizationBackupSettings.autoBackupEnabled,
    })
    .from(organizations)
    .leftJoin(
      organizationBackupSettings,
      eq(organizationBackupSettings.organizationId, organizations.id),
    );

  return rows.filter((r) => r.autoBackupEnabled ?? true).map((r) => ({ id: r.id, name: r.name }));
}

/** Grava um snapshot automático e apaga os mais antigos além de
 * `AUTO_BACKUP_RETENTION`. */
export async function saveAutomaticBackup(
  db: Database,
  organizationId: string,
  backup: BackupFile,
) {
  await db.insert(organizationBackups).values({ organizationId, data: backup });

  const keep = await db
    .select({ id: organizationBackups.id })
    .from(organizationBackups)
    .where(eq(organizationBackups.organizationId, organizationId))
    .orderBy(desc(organizationBackups.createdAt))
    .limit(AUTO_BACKUP_RETENTION);

  const keepIds = keep.map((r) => r.id);
  const old = await db
    .select({ id: organizationBackups.id })
    .from(organizationBackups)
    .where(eq(organizationBackups.organizationId, organizationId));

  const toDelete = old.map((r) => r.id).filter((id) => !keepIds.includes(id));
  if (toDelete.length > 0) {
    await db.delete(organizationBackups).where(inArray(organizationBackups.id, toDelete));
  }
}

export interface OrgBackupSummary {
  id: string;
  createdAt: Date;
}

export async function listAutomaticBackups(
  db: Database,
  organizationId: string,
): Promise<OrgBackupSummary[]> {
  return db
    .select({ id: organizationBackups.id, createdAt: organizationBackups.createdAt })
    .from(organizationBackups)
    .where(eq(organizationBackups.organizationId, organizationId))
    .orderBy(desc(organizationBackups.createdAt));
}

export async function getAutomaticBackup(
  db: Database,
  organizationId: string,
  backupId: string,
): Promise<BackupFile | null> {
  const [row] = await db
    .select({ data: organizationBackups.data })
    .from(organizationBackups)
    .where(
      and(
        eq(organizationBackups.id, backupId),
        eq(organizationBackups.organizationId, organizationId),
      ),
    )
    .limit(1);

  return (row?.data as BackupFile) ?? null;
}
