import "@/core/load-modules";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Headset, User, Users } from "lucide-react";
import {
  getActiveOrg,
  getSession,
  mustChangePassword,
  withOrg,
  NoActiveOrganizationError,
  OrganizationBlockedError,
  UnauthorizedError,
} from "@/core/auth";
import { getEnabledModulesForOrg } from "@/core/module-settings";
import { filterModulesByAccess } from "@/core/module-access";
import { stopImpersonation } from "@/core/admin/actions";
import { getOpenSessionForMyOrg } from "@/core/live-support/queries";
import { LiveSupportWidget } from "@/core/live-support/components/live-support-widget";
import { NotificationBell } from "@/core/notifications/components/notification-bell";
import { listNotificationsForCurrentUser } from "@/core/notifications/queries";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { VersionBadge } from "@/components/version-badge";
import { BackupReminder } from "@/components/backup-reminder";
import { getBackupReminderSettings, isBackupReminderDue } from "@/core/backup";
import { formatDateTime } from "@/core/format";
import { OrgBrandingStyle } from "@/components/org-branding-style";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { BrandIcon } from "@/components/brand-icon";
import { BRAND } from "@/core/brand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (user && mustChangePassword(user)) {
    redirect("/trocar-senha-obrigatoria");
  }

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

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? org.organizationName;

  const { withDb } = await withOrg();
  // Menu só com o que esta pessoa pode abrir (o dono da conta escolhe em
  // /equipe). Esconder não é a proteção — cada módulo chama `requireModule`.
  const modules = filterModulesByAccess(
    await withDb((tx) => getEnabledModulesForOrg(tx, org.organizationId)),
    org.moduleAccess,
  );
  const stopImpersonationWithId = stopImpersonation.bind(null, org.organizationId);

  // Nunca durante modo suporte: quem está "usando" a organização ali é o
  // próprio admin.
  const openSession = org.impersonating ? null : await getOpenSessionForMyOrg();
  const notifications = await listNotificationsForCurrentUser();

  // Lembrete de backup: só para o responsável da conta e nunca no modo suporte
  // (quem está "usando" a organização ali é o dono da plataforma).
  const backupReminder =
    org.role === "owner" && !org.impersonating
      ? await withDb((tx) => getBackupReminderSettings(tx, org.organizationId))
      : null;

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <OrgBrandingStyle primaryColor={org.primaryColor} sidebarColor={org.sidebarColor} />
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
          <div className="border-sidebar-border flex min-h-20 items-center gap-2 border-b px-4 py-3.5">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica do Supabase Storage, fora do domínio de imagens do Next.
              <img
                src={org.logoUrl}
                alt={org.organizationName}
                className="h-16 w-auto max-w-full object-contain object-left"
              />
            ) : (
              <>
                <BrandIcon className="text-sidebar-primary h-5 w-5" />
                <span className="font-semibold">{BRAND.name}</span>
              </>
            )}
          </div>
          <SidebarNav modules={modules} isOwner={org.role === "owner"} />
          <div className="border-sidebar-border mt-auto flex flex-col gap-2 border-t px-2 py-2">
            {/* A marca do vertical (ícone + nome — mesma dupla do topo
                antes de escolher um logo próprio, e o mesmo ícone da
                tela de login) só desce pra cá quando a organização já
                tem um logo próprio ocupando o topo — sem isso, mostrar
                duas vezes. */}
            {org.logoUrl && (
              <div className="text-sidebar-foreground/60 flex items-center gap-1.5 px-1 text-xs">
                <BrandIcon className="h-3.5 w-3.5" />
                <span>{BRAND.name}</span>
              </div>
            )}
            <VersionBadge className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-4 py-3 print:hidden">
            <div className="flex items-center gap-2">
              <MobileNav modules={modules} isOwner={org.role === "owner"} />
              <span className="text-sm font-medium">{displayName}</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell organizationId={org.organizationId} initialItems={notifications} />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="sm" className="gap-2" />}
                >
                  <User className="h-4 w-4" />
                  <span className="text-muted-foreground hidden sm:inline">{org.userEmail}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem render={<Link href="/perfil" />}>
                    <User className="h-4 w-4" />
                    Perfil
                  </DropdownMenuItem>
                  {org.role === "owner" && org.multiUser && (
                    <DropdownMenuItem render={<Link href="/equipe" />}>
                      <Users className="h-4 w-4" />
                      Equipe
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <form action={logout}>
                <Button variant="ghost" size="icon" type="submit" aria-label="Sair">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 print:p-0">
            {backupReminder && (
              <BackupReminder
                due={isBackupReminderDue(backupReminder, new Date())}
                reminderHours={backupReminder.reminderHours}
                lastDownloadLabel={
                  backupReminder.lastDownloadAt
                    ? `Último backup baixado em ${formatDateTime(backupReminder.lastDownloadAt)}`
                    : null
                }
                organizationId={org.organizationId}
              />
            )}
            {children}
          </main>
        </div>
      </div>

      <UnsavedChangesGuard />
      {!org.impersonating && (
        <LiveSupportWidget
          userId={org.userId}
          initialSession={
            openSession &&
            (openSession.status === "pending" ||
              openSession.status === "active" ||
              openSession.status === "chat")
              ? {
                  id: openSession.id,
                  status: openSession.status,
                  initiatedBy: openSession.initiatedBy,
                  controlGranted: openSession.controlGranted,
                  screenRequested: openSession.screenRequested,
                  expiresAt: openSession.expiresAt?.toISOString() ?? null,
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
