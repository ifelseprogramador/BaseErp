import Link from "next/link";
import { ArrowLeftRight, LogOut, Megaphone, ShieldAlert } from "lucide-react";
import { requireAdmin, NotPlatformAdminError } from "@/core/admin-auth";
import { Button } from "@/components/ui/button";
import { VersionBadge } from "@/components/version-badge";
import { logout } from "@/app/(auth)/actions";
import { listPendingUserRequestsForAdmin } from "@/core/live-support/queries";
import { SupportNotificationBell } from "@/core/admin/components/support-notification-bell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotPlatformAdminError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-lg font-semibold">Área restrita</h1>
          <p className="text-muted-foreground max-w-sm text-sm">{err.message}</p>
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
              Voltar ao painel
            </Button>
            <form action={logout}>
              <Button variant="ghost" type="submit">
                Sair
              </Button>
            </form>
          </div>
        </div>
      );
    }
    throw err;
  }

  const pendingRequests = await listPendingUserRequestsForAdmin();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex items-center justify-between border-b bg-zinc-950 px-4 py-3 text-zinc-50">
        <Link href="/admin" className="flex items-center gap-2 hover:text-zinc-300">
          <ShieldAlert className="h-5 w-5" />
          <span className="font-semibold">BaseERP — Administração da plataforma</span>
        </Link>
        <div className="flex items-center gap-3">
          <VersionBadge className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50" />
          {/* Botões (não links soltos de texto) pra ficar claro que são
              ações/destinos — "Notificações" com borda por ser a área do
              dono; "Voltar ao app" mais discreto, só no hover. Megafone e
              não sino: o sino ao lado já é o de pedidos de suporte. */}
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/admin/notificacoes" />}
            className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-50"
          >
            <Megaphone className="h-4 w-4" />
            Notificações
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/" />}
            className="text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Voltar ao app
          </Button>
          <SupportNotificationBell initialRequests={pendingRequests} />
          <form action={logout}>
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              aria-label="Sair"
              className="text-zinc-50"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 bg-zinc-50 p-4 md:p-6 dark:bg-zinc-900">{children}</main>
    </div>
  );
}
