import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { ModePage, ModeSection } from "@/components/facil/mode-layout";
import { getCurrentUiMode } from "@/core/profile/current-ui-mode";
import { withOrg } from "@/core/auth";
import { getEnabledModulesForOrg } from "@/core/module-settings";
import { getTeamOverview } from "@/core/team/queries";
import { InviteMemberDialog } from "@/core/team/components/invite-member-dialog";
import { MemberAccessDialog } from "@/core/team/components/member-access-dialog";
import {
  MemberActiveButton,
  ResetStaffPasswordButton,
} from "@/core/team/components/member-status-actions";

/**
 * Equipe da empresa — só o dono da conta, e só quando o dono da plataforma
 * liberou o modo multiusuário (`organizations.multiUser`). Quem não pode
 * ver isto recebe 404, como se a tela não existisse.
 */
export default async function TeamPage() {
  const { role, multiUser, organizationId, userId, withDb } = await withOrg();
  if (role !== "owner" || !multiUser) notFound();

  const [team, enabledModules] = await Promise.all([
    withDb((db) => getTeamOverview(db, organizationId)),
    withDb((db) => getEnabledModulesForOrg(db, organizationId)),
  ]);
  const modules = enabledModules.map((m) => ({
    slug: m.slug,
    label: m.label,
    dependsOn: (m.dependsOn ?? []).filter((d) => enabledModules.some((e) => e.slug === d)),
  }));
  const labelBySlug = new Map(modules.map((m) => [m.slug, m.label]));
  const seatsFull = team.activeCount >= team.seatLimit;
  const uiMode = await getCurrentUiMode();

  return (
    <ModePage
      mode={uiMode}
      title="Equipe"
      subtitle={`${team.activeCount} de ${team.seatLimit} usuários ativos${seatsFull ? " — limite atingido" : ""}`}
      icon={Users}
      maxWidth="max-w-3xl"
    >
      <div className="flex justify-end">
        <InviteMemberDialog modules={modules} disabled={seatsFull} />
      </div>

      <ModeSection mode={uiMode} title="Pessoas" icon={Users}>
        <ul className="flex flex-col gap-4 text-sm">
          {team.members.map((m) => {
            const isMe = m.userId === userId;
            const granted = m.moduleSlugs
              .map((slug) => labelBySlug.get(slug))
              .filter((l): l is string => Boolean(l));
            return (
              <li
                key={m.id}
                className={
                  uiMode === "facil"
                    ? "bg-muted/40 flex flex-wrap items-start justify-between gap-3 rounded-xl p-3"
                    : "flex flex-wrap items-start justify-between gap-3"
                }
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.name}
                    {isMe && <span className="text-muted-foreground font-normal"> (você)</span>}
                  </p>
                  {m.email && m.email !== m.name && (
                    <p className="text-muted-foreground truncate text-xs">{m.email}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{m.role === "owner" ? "Responsável" : "Equipe"}</Badge>
                    {m.department && <Badge variant="secondary">{m.department}</Badge>}
                    {!m.active && <Badge variant="destructive">Desativado</Badge>}
                  </div>
                  {m.role === "staff" && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {granted.length > 0 ? granted.join(", ") : "Nenhum módulo liberado"}
                    </p>
                  )}
                </div>
                {m.role === "staff" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <MemberAccessDialog
                      membershipId={m.id}
                      label={m.name}
                      department={m.department}
                      selectedSlugs={m.moduleSlugs}
                      modules={modules}
                    />
                    <ResetStaffPasswordButton membershipId={m.id} label={m.name} />
                    <MemberActiveButton membershipId={m.id} active={m.active} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </ModeSection>
    </ModePage>
  );
}
