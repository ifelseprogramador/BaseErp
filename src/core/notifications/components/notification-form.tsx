"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/core/action-result";
import { NOTIFICATION_CATEGORY_META } from "../category";
import {
  ALL_ORGANIZATIONS,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "../validation";

const initialState: ActionResult = { ok: false };

export function NotificationForm({
  notification,
  organizations,
  action,
}: {
  notification?: {
    title: string;
    body: string;
    category: NotificationCategory;
    organizationId: string | null;
  };
  organizations: { id: string; name: string }[];
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const errors = state.errors ?? {};

  // Criar redireciona no servidor; isto só dispara editando.
  useEffect(() => {
    if (state.ok) toast.success("Notificação salva.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" defaultValue={notification?.title} required />
        {errors.title?.map((error) => (
          <p key={error} className="text-destructive text-sm">
            {error}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">Mensagem</Label>
        <Textarea id="body" name="body" defaultValue={notification?.body} rows={4} required />
        {errors.body?.map((error) => (
          <p key={error} className="text-destructive text-sm">
            {error}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Categoria</Label>
        <Select
          name="category"
          items={Object.fromEntries(
            NOTIFICATION_CATEGORIES.map((c) => [c, NOTIFICATION_CATEGORY_META[c].label]),
          )}
          defaultValue={notification?.category ?? "aviso"}
        >
          <SelectTrigger id="category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTIFICATION_CATEGORIES.map((category) => {
              const meta = NOTIFICATION_CATEGORY_META[category];
              const Icon = meta.icon;
              return (
                <SelectItem key={category} value={category}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="organizationId">Destinatário</Label>
        <Select
          name="organizationId"
          items={{
            [ALL_ORGANIZATIONS]: "Todas as organizações",
            ...Object.fromEntries(organizations.map((o) => [o.id, o.name])),
          }}
          defaultValue={notification?.organizationId ?? ALL_ORGANIZATIONS}
        >
          <SelectTrigger id="organizationId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ORGANIZATIONS}>Todas as organizações</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.message && <p className="text-destructive text-sm">{state.message}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
