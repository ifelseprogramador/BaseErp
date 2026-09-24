import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/core/admin-auth";
import { getOrganizationForAdmin } from "@/core/admin/queries";
import { hardDeleteOrganization, updateBilling } from "@/core/admin/actions";
import { OrgStatusToggle } from "@/core/admin/components/org-status-toggle";
import { ImpersonateButton } from "@/core/admin/components/impersonate-button";
import { BillingForm } from "@/core/admin/components/billing-form";
import { ModuleToggleList } from "@/core/admin/components/module-toggle-list";
import { HardDeleteForm } from "@/core/admin/components/hard-delete-form";
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

  const overrideBySlug = new Map(moduleSettings.map((m) => [m.moduleSlug, m.enabled]));
  const modules = getAllModules().map((m) => ({
    slug: m.slug,
    label: m.label,
    enabled: overrideBySlug.get(m.slug) ?? m.enabled,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2">
          <BackButton href="/admin" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
            <div className="mt-1 flex gap-2">
              <Badge variant={org.status === "blocked" ? "destructive" : "secondary"}>
                {org.status === "blocked" ? "Bloqueada" : "Ativa"}
              </Badge>
              {org.businessType && <Badge variant="outline">{org.businessType}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
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
            <ul className="flex flex-col gap-2 text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between">
                  <span>{m.email ?? m.userId}</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">{m.role === "owner" ? "Dono" : "Equipe"}</Badge>
                    {!m.active && <Badge variant="destructive">Bloqueado</Badge>}
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
