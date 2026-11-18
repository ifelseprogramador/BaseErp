import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/** "AAAA-MM-DD" (data sem hora) vale o dia local: `new Date("2026-11-30")` é meia-noite UTC e mostraria 29/11 no Brasil. */
function parseDate(date: Date | string): Date {
  if (typeof date !== "string") return date;
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return dia ? new Date(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3])) : new Date(date);
}

export function formatDate(date: Date | string): string {
  const d = parseDate(date);
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
}
