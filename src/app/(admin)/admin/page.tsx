import Link from "next/link";
import { ActionLink } from "@/components/action-link";
import { RowActions } from "@/components/row-actions";
import { DatabaseBackup } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchBox } from "@/components/search-box";
import { formatDate } from "@/core/format";
import { requireAdmin } from "@/core/admin-auth";
import { listOrganizationsForAdmin } from "@/core/admin/queries";
import { listPendingUserRequestsForAdmin } from "@/core/live-support/queries";
import { NewOrganizationForm } from "@/core/admin/components/new-organization-form";
import { SupportInbox } from "@/core/admin/components/support-inbox";

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q : undefined;
  const { withDb } = await requireAdmin();
  const [organizations, pendingRequests] = await Promise.all([
    withDb((db) => listOrganizationsForAdmin(db, search)),
    listPendingUserRequestsForAdmin(),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Organizações</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/admin/backup" />}
          >
            <DatabaseBackup className="h-4 w-4" />
            Backup do sistema
          </Button>
          <NewOrganizationForm />
        </div>
      </div>

      <SupportInbox initialRequests={pendingRequests} />

      <SearchBox placeholder="Buscar organização..." />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cobrança</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <TableRow key={org.id}>
              <TableCell>
                <ActionLink href={`/admin/organizacoes/${org.id}`} className="font-medium">
                  {org.name}
                </ActionLink>
              </TableCell>
              <TableCell>
                <Badge variant={org.status === "blocked" ? "destructive" : "secondary"}>
                  {org.status === "blocked" ? "Bloqueada" : "Ativa"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={org.billingStatus === "em_dia" ? "secondary" : "destructive"}>
                  {org.billingStatus === "em_dia"
                    ? "Em dia"
                    : org.billingStatus === "atrasado"
                      ? "Atrasado"
                      : "Cancelado"}
                </Badge>
              </TableCell>
              <TableCell>{org.nextDueDate ? formatDate(org.nextDueDate) : "—"}</TableCell>
              <TableCell>{formatDate(org.createdAt)}</TableCell>
              <TableCell>
                {/* Só editar: apagar organização é definitivo e tem
                    confirmação própria (digitar o nome) na ficha — não
                    cabe na lixeira rápida da linha. */}
                <RowActions editHref={`/admin/organizacoes/${org.id}`} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {organizations.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Nenhuma organização encontrada.
        </p>
      )}
    </div>
  );
}
