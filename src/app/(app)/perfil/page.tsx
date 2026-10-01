import Link from "next/link";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession, withOrg } from "@/core/auth";
import { organizations } from "@/db/schema";
import { changeOwnPassword } from "@/core/profile/actions";
import { DisplayNameForm } from "@/core/profile/components/display-name-form";
import { ChangePasswordForm } from "@/core/profile/components/change-password-form";
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

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Meu perfil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <DisplayNameForm initialDisplayName={displayName} />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Tema</span>
            <ThemeToggle />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Trocar senha</span>
            <ChangePasswordForm action={changeOwnPassword} />
          </div>
        </CardContent>
      </Card>

      {role === "owner" && org && (
        <Card>
          <CardHeader>
            <CardTitle>Dados da empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyForm
              initial={{
                accountName: org.name,
                displayName: org.displayName,
                document: org.document,
                phone: org.phone,
                address: org.address,
              }}
            />
          </CardContent>
        </Card>
      )}

      {role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle>Aparência da organização</CardTitle>
          </CardHeader>
          <CardContent>
            <BrandingForm
              primaryColor={org?.primaryColor ?? null}
              sidebarColor={org?.sidebarColor ?? null}
              logoUrl={org?.logoUrl ?? null}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>E-mail de envio (avançado)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">
            Opcional: faça o sistema enviar orçamentos e notas por e-mail, com PDF anexo.
          </span>
          <Link href="/perfil/email" className="text-primary font-medium whitespace-nowrap">
            Configurar
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
