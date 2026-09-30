import { eq } from "drizzle-orm";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withOrg } from "@/core/auth";
import { organizationEmailSettings } from "@/db/schema";
import { EmailSettingsForm } from "@/core/share/components/email-settings-form";

export default async function EmailSettingsPage() {
  const { organizationId, role, withDb } = await withOrg();

  const [cfg] = await withDb((db) =>
    db
      .select({
        host: organizationEmailSettings.host,
        port: organizationEmailSettings.port,
        secure: organizationEmailSettings.secure,
        username: organizationEmailSettings.username,
        fromName: organizationEmailSettings.fromName,
        fromEmail: organizationEmailSettings.fromEmail,
      })
      .from(organizationEmailSettings)
      .where(eq(organizationEmailSettings.organizationId, organizationId))
      .limit(1),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-2">
        <BackButton href="/perfil" />
        <h1 className="text-2xl font-semibold tracking-tight">E-mail de envio</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Opcional. Sem isto, o botão &quot;Enviar ao cliente&quot; continua funcionando por WhatsApp,
        link e pelo seu aplicativo de e-mail. Configurando, o sistema envia o e-mail sozinho, com o
        PDF anexo, em nome da sua empresa.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Servidor de e-mail (SMTP)</CardTitle>
        </CardHeader>
        <CardContent>
          {role === "owner" ? (
            <EmailSettingsForm summary={cfg ?? null} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Só o responsável pela conta pode alterar esta configuração.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
