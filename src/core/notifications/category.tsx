import { AlertTriangle, Lightbulb, Sparkles, type LucideIcon } from "lucide-react";
import type { NotificationCategory } from "./validation";

/**
 * Metadados visuais de cada categoria — um lugar só, usado pelo form do
 * admin (`components/notification-form.tsx`), pela listagem do admin
 * (`(admin)/admin/notificacoes/page.tsx`) e pelo sino do usuário
 * (`components/notification-bell.tsx`), pra nunca desalinhar cor/ícone
 * entre os três lugares.
 */
export const NOTIFICATION_CATEGORY_META: Record<
  NotificationCategory,
  { label: string; icon: LucideIcon; className: string }
> = {
  aviso: {
    label: "Aviso",
    icon: AlertTriangle,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
  novidade: {
    label: "Novidade",
    icon: Sparkles,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  },
  dica: {
    label: "Dica",
    icon: Lightbulb,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
};
