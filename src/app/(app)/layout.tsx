import "@/core/load-modules";
import { LogOut, Building2, Headset } from "lucide-react";
import {
  getActiveOrg,
  withOrg,
  NoActiveOrganizationError,
  OrganizationBlockedError,
  UnauthorizedError,
} from "@/core/auth";
import { getEnabledModulesForOrg } from "@/core/module-settings";
import { stopImpersonation } from "@/core/admin/actions";
import { getOpenSessionForMyOrg } from "@/core/live-support/queries";
import { LiveSupportWidget } from "@/core/live-support/components/live-support-widget";
import { NotificationBell } from "@/core/notifications/components/notification-bell";
import { listNotificationsForCurrentUser } from "@/core/notifications/queries";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { VersionBadge } from "@/components/version-badge";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let org;
  try {
    org = await getActiveOrg();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      // O proxy já deveria ter redirecionado para /login antes disso.
      return <NoOrgFallback message="Sua sessão expirou." />;
    }
    if (err instanceof NoActiveOrganizationError) {
      return (
        <NoOrgFallback message="Sua conta ainda não está vinculada a nenhuma organização. Fale com quem administra o sistema." />
      );
    }
    if (err instanceof OrganizationBlockedError) {
      return (
        <NoOrgFallback message="O acesso desta conta está bloqueado. Entre em contato com o suporte para regularizar." />
      );
    }
    throw err;
  }

  const { withDb } = await withOrg();
  const modules = await withDb((tx) => getEnabledModulesForOrg(tx, org.organizationId));
  const stopImpersonationWithId = stopImpersonation.bind(null, org.organizationId);

  // Nunca durante modo suporte: quem está "usando" a organização ali é o
  // próprio admin.
  const openSession = org.impersonating ? null : await getOpenSessionForMyOrg();
  const notifications = await listNotificationsForCurrentUser();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {org.impersonating && (
        <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 print:hidden">
          <span className="flex items-center gap-2">
            <Headset className="h-4 w-4" />
            Modo suporte: agindo como <strong>{org.organizationName}</strong>
            {org.organizationStatus === "blocked" && " (organização bloqueada)"}
          </span>
          <form action={stopImpersonationWithId}>
            <Button variant="outline" size="sm" type="submit" className="bg-amber-50">
              Sair do modo suporte
            </Button>
          </form>
        </div>
      )}

      <div className="flex flex-1">
        <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 shrink-0 flex-col border-r md:flex print:hidden">
          <div className="border-sidebar-border flex items-center gap-2 border-b px-4 py-3.5">
            <Building2 className="text-sidebar-primary h-5 w-5" />
            <span className="font-semibold">BaseERP</span>
          </div>
          <SidebarNav modules={modules} />
          <div className="border-sidebar-border mt-auto border-t px-2 py-2">
            <VersionBadge className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-4 py-3 print:hidden">
            <div className="flex items-center gap-2">
              <MobileNav modules={modules} />
              <span className="text-sm font-medium">{org.organizationName}</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell organizationId={org.organizationId} initialItems={notifications} />
              <span className="text-muted-foreground hidden text-sm sm:inline">
                {org.userEmail}
              </span>
              <form action={logout}>
                <Button variant="ghost" size="icon" type="submit" aria-label="Sair">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 print:p-0">{children}</main>
        </div>
      </div>

      {!org.impersonating && (
        <LiveSupportWidget
          organizationId={org.organizationId}
          initialSession={
            openSession && (openSession.status === "pending" || openSession.status === "active")
              ? {
                  id: openSession.id,
                  status: openSession.status,
                  initiatedBy: openSession.initiatedBy,
                  controlGranted: openSession.controlGranted,
                }
              : null
          }
        />
      )}
    </div>
  );
}

function NoOrgFallback({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold">Acesso indisponível</h1>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
      <form action={logout}>
        <Button variant="outline" type="submit">
          Sair
        </Button>
      </form>
    </div>
  );
}
