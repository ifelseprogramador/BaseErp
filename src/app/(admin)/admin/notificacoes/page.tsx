import Link from "next/link";
import { ActionLink } from "@/components/action-link";
import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { RowActions } from "@/components/row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/core/format";
import { listNotificationsForAdmin } from "@/core/notifications/queries";
import { deleteAllNotifications, deleteNotification } from "@/core/notifications/admin-actions";
import { NOTIFICATION_CATEGORY_META } from "@/core/notifications/category";

export default async function AdminNotificationsPage() {
  const notifications = await listNotificationsForAdmin();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton href="/admin" />
          <div className="bg-accent text-accent-foreground rounded-lg p-2">
            <Bell className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Notificações</h1>
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <ConfirmDeleteButton
              title="Apagar todas as notificações"
              description="Essa ação não pode ser desfeita. Todas as notificações (e quem leu cada uma) serão removidas permanentemente."
              onConfirm={deleteAllNotifications}
              redirectTo="/admin/notificacoes"
            />
          )}
          <Button nativeButton={false} render={<Link href="/admin/notificacoes/novo" />}>
            <Plus className="h-4 w-4" />
            Nova notificação
          </Button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Nenhuma notificação enviada ainda.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Enviada em</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((notification) => {
              const meta = NOTIFICATION_CATEGORY_META[notification.category];
              const Icon = meta.icon;
              return (
                <TableRow key={notification.id}>
                  <TableCell>
                    <ActionLink
                      href={`/admin/notificacoes/${notification.id}`}
                      className="font-medium"
                    >
                      {notification.title}
                    </ActionLink>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{notification.organizationName ?? "Todas as organizações"}</TableCell>
                  <TableCell>{formatDate(notification.createdAt)}</TableCell>
                  <TableCell>
                    <RowActions
                      editHref={`/admin/notificacoes/${notification.id}`}
                      deleteTitle="Apagar notificação"
                      deleteDescription="Essa ação não pode ser desfeita."
                      onDelete={deleteNotification.bind(null, notification.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
