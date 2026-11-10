import Link from "next/link";
import { eq } from "drizzle-orm";
import { Building2, Mail, Palette, UserRound } from "lucide-react";
import { ModePage, ModeSection } from "@/components/facil/mode-layout";
import { getSession, withOrg } from "@/core/auth";
import { organizations } from "@/db/schema";
import { getCurrentUiMode } from "@/core/profile/current-ui-mode";
import { changeOwnPassword } from "@/core/profile/actions";
import { DisplayNameForm } from "@/core/profile/components/display-name-form";
import { ChangePasswordForm } from "@/core/profile/components/change-password-form";
import { UiModeToggle } from "@/core/profile/components/ui-mode-toggle";
import { ThemeToggle } from "@/core/profile/components/theme-toggle";
import { BrandingForm } from "@/core/profile/components/branding-form";
import { CompanyForm } from "@/core/profile/components/company-form";

export default async function ProfilePage() {
  const [user, { role, organizationId, withDb }] = await Promise.all([getSession(), withOrg()]);

  const [org] = await withDb((db) =>
    db
      .select({
        primaryColor: organizations.primaryColor,
        sidebarColor: organizations.sidebarColor,
        logoUrl: organizations.logoUrl,
        name: organizations.name,
        displayName: organizations.displayName,
        document: organizations.document,
        phone: organizations.phone,
        address: organizations.address,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1),
  );

  const uiMode = await getCurrentUiMode();

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "";

  return (
    <ModePage mode={uiMode} title="Perfil" icon={UserRound}>
      <ModeSection mode={uiMode} title="Meu perfil" icon={UserRound}>
        <div className="flex flex-col gap-6">
          <DisplayNameForm initialDisplayName={displayName} />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Modo de tela</span>
            <UiModeToggle initialMode={uiMode} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Tema</span>
            <ThemeToggle />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Trocar senha</span>
            <ChangePasswordForm action={changeOwnPassword} />
          </div>
        </div>
      </ModeSection>

      {role === "owner" && org && (
        <ModeSection mode={uiMode} title="Dados da empresa" icon={Building2}>
          <CompanyForm
            initial={{
              accountName: org.name,
              displayName: org.displayName,
              document: org.document,
              phone: org.phone,
              address: org.address,
            }}
          />
        </ModeSection>
      )}

      {role === "owner" && (
        <ModeSection mode={uiMode} title="Aparência da organização" icon={Palette}>
          <BrandingForm
            primaryColor={org?.primaryColor ?? null}
            sidebarColor={org?.sidebarColor ?? null}
            logoUrl={org?.logoUrl ?? null}
          />
        </ModeSection>
      )}

      <ModeSection mode={uiMode} title="E-mail de envio (avançado)" icon={Mail}>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">
            Opcional: faça o sistema enviar orçamentos e notas por e-mail, com PDF anexo.
          </span>
          <Link href="/perfil/email" className="text-primary font-medium whitespace-nowrap">
            Configurar
          </Link>
        </div>
      </ModeSection>
    </ModePage>
  );
}
