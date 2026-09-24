import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { BackButton } from "@/components/back-button";
import { formatDate } from "@/core/format";
import { NotificationForm } from "@/core/notifications/components/notification-form";
import { getNotificationForAdmin } from "@/core/notifications/queries";
import { deleteNotification, updateNotification } from "@/core/notifications/admin-actions";
import { requireAdmin } from "@/core/admin-auth";
import { listOrganizationsForAdmin } from "@/core/admin/queries";

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { withDb } = await requireAdmin();
  const [notification, organizations] = await Promise.all([
    getNotificationForAdmin(id),
    withDb((db) => listOrganizationsForAdmin(db)),
  ]);

  if (!notification) {
    notFound();
  }

  const updateWithId = updateNotification.bind(null, notification.id);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-2xl font-semibold tracking-tight">{notification.title}</h1>
        </div>
        <ConfirmDeleteButton
          title="Apagar notificação"
          description="Essa ação não pode ser desfeita."
          onConfirm={deleteNotification.bind(null, notification.id)}
          redirectTo="/admin/notificacoes"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationForm
            notification={{
              title: notification.title,
              body: notification.body,
              category: notification.category,
              organizationId: notification.organizationId,
            }}
            organizations={organizations}
            action={updateWithId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Quem leu {notification.readers.length > 0 && `(${notification.readers.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notification.readers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ninguém leu ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {notification.readers.map((reader) => (
                <li key={reader.userId} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p>{reader.email ?? reader.userId}</p>
                    <p className="text-muted-foreground text-xs">{reader.organizationName}</p>
                  </div>
                  <span className="text-muted-foreground text-xs">{formatDate(reader.readAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
