import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/core/admin-auth";
import { getOrganizationForAdmin } from "@/core/admin/queries";
import {
  hardDeleteOrganization,
  updateBilling,
  updateOrganizationName,
} from "@/core/admin/actions";
import { OrganizationNameForm } from "@/core/admin/components/organization-name-form";
import { OrgStatusToggle } from "@/core/admin/components/org-status-toggle";
import { ImpersonateButton } from "@/core/admin/components/impersonate-button";
import { BillingForm } from "@/core/admin/components/billing-form";
import { ModuleToggleList } from "@/core/admin/components/module-toggle-list";
import { HardDeleteForm } from "@/core/admin/components/hard-delete-form";
import { ResetMemberPasswordButton } from "@/core/admin/components/reset-member-password-button";
import { AuditLogCard } from "@/core/admin/components/audit-log-card";
import { LiveSupportCard } from "@/core/admin/components/live-support-card";
import { getAllModules } from "@/core/registry";
import { getOpenSessionForOrgAdmin } from "@/core/live-support/queries";

export default async function AdminOrganizationDetailPage({
  params,
}: PageProps<"/admin/organizacoes/[id]">) {
  const { id } = await params;
  const { withDb } = await requireAdmin();
  const [data, openSession] = await Promise.all([
    withDb((db) => getOrganizationForAdmin(db, id)),
    getOpenSessionForOrgAdmin(id),
  ]);

  if (!data) {
    notFound();
  }

  const { organization: org, members, moduleSettings, audit } = data;
  const updateBillingWithId = updateBilling.bind(null, org.id);
  const hardDeleteWithId = hardDeleteOrganization.bind(null, org.id);
  const updateNameWithId = updateOrganizationName.bind(null, org.id);

  const overrideBySlug = new Map(moduleSettings.map((m) => [m.moduleSlug, m.enabled]));
  const modules = getAllModules().map((m) => ({
    slug: m.slug,
    label: m.label,
    enabled: overrideBySlug.get(m.slug) ?? m.enabled,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <BackButton href="/admin" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{org.name}</h1>
              <OrganizationNameForm currentName={org.name} action={updateNameWithId} />
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant={org.status === "blocked" ? "destructive" : "secondary"}>
                {org.status === "blocked" ? "Bloqueada" : "Ativa"}
              </Badge>
              {org.businessType && <Badge variant="outline">{org.businessType}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImpersonateButton organizationId={org.id} />
          <OrgStatusToggle organizationId={org.id} status={org.status} />
        </div>
      </div>

      <LiveSupportCard
        organizationId={org.id}
        initialSession={
          openSession && (openSession.status === "pending" || openSession.status === "active")
            ? {
                id: openSession.id,
                status: openSession.status,
                controlGranted: openSession.controlGranted,
              }
            : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Cobrança</CardTitle>
        </CardHeader>
        <CardContent>
          <BillingForm
            billingStatus={org.billingStatus}
            nextDueDate={org.nextDueDate}
            billingNotes={org.billingNotes}
            action={updateBillingWithId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Módulos habilitados (personalização)</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuleToggleList organizationId={org.id} modules={modules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pessoas com acesso</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum usuário vinculado.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    {/* m.name já resolve pra display_name (Perfil), senão
                        e-mail, senão o próprio UID (core/user-lookup.ts)
                        — nunca precisa repetir o e-mail aqui embaixo. */}
                    <p className="truncate">{m.name}</p>
                    <p className="text-muted-foreground truncate font-mono text-xs">{m.userId}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{m.role === "owner" ? "Dono" : "Equipe"}</Badge>
                    {!m.active && <Badge variant="destructive">Bloqueado</Badge>}
                    <ResetMemberPasswordButton
                      organizationId={org.id}
                      userId={m.userId}
                      label={m.name}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AuditLogCard organizationId={org.id} entries={audit} />

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de risco</CardTitle>
        </CardHeader>
        <CardContent>
          <HardDeleteForm organizationName={org.name} action={hardDeleteWithId} />
        </CardContent>
      </Card>
    </div>
  );
}
