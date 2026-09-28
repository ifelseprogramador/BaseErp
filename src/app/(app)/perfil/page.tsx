import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession, withOrg } from "@/core/auth";
import { organizations } from "@/db/schema";
import { changeOwnPassword } from "@/core/profile/actions";
import { DisplayNameForm } from "@/core/profile/components/display-name-form";
import { ChangePasswordForm } from "@/core/profile/components/change-password-form";
import { ThemeToggle } from "@/core/profile/components/theme-toggle";
import { BrandingForm } from "@/core/profile/components/branding-form";

export default async function ProfilePage() {
  const [user, { role, organizationId, withDb }] = await Promise.all([getSession(), withOrg()]);

  const [org] = await withDb((db) =>
    db
      .select({ primaryColor: organizations.primaryColor, logoUrl: organizations.logoUrl })
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

      {role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle>Aparência da organização</CardTitle>
          </CardHeader>
          <CardContent>
            <BrandingForm primaryColor={org?.primaryColor ?? null} logoUrl={org?.logoUrl ?? null} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
