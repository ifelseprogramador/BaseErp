import { ChangePasswordForm } from "@/core/profile/components/change-password-form";
import { changeMandatoryPassword } from "@/core/profile/actions";

/**
 * Gate obrigatório — só chega aqui quem tem `must_change_password` em
 * `app_metadata` (ver redirect em `app/(app)/layout.tsx` e
 * `app/(admin)/admin/layout.tsx`). Sem sidebar/header, sem link de
 * "voltar": a pessoa só sai daqui trocando a senha.
 */
export default function MandatoryPasswordChangePage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-lg font-semibold">Defina uma nova senha</h1>
        <p className="text-muted-foreground text-sm">
          Por segurança, você precisa trocar a senha provisória antes de continuar.
        </p>
      </div>
      <ChangePasswordForm
        action={changeMandatoryPassword}
        submitLabel="Definir senha e continuar"
        showSuccessToast={false}
      />
    </div>
  );
}
