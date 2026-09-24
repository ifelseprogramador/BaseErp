import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/back-button";
import { NotificationForm } from "@/core/notifications/components/notification-form";
import { createNotification } from "@/core/notifications/admin-actions";
import { requireAdmin } from "@/core/admin-auth";
import { listOrganizationsForAdmin } from "@/core/admin/queries";

export default async function NewNotificationPage() {
  const { withDb } = await requireAdmin();
  const organizations = await withDb((db) => listOrganizationsForAdmin(db));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="text-2xl font-semibold tracking-tight">Nova notificação</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationForm organizations={organizations} action={createNotification} />
        </CardContent>
      </Card>
    </div>
  );
}
