"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Download, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Hint } from "@/components/hint";
import { sendShareByEmail } from "@/core/share/actions";
import type { ShareLinkResult } from "@/core/share/create";

/** wa.me exige DDI: assume Brasil (55) quando o número tem 10 ou 11 dígitos. */
function whatsappUrl(phone: string | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

/**
 * Botão "Enviar ao cliente" — igual em todos os verticais. `action` é a
 * Server Action do vertical que monta o documento e devolve o link
 * (`createSharedDocument`). O link/PDF só é gerado quando a pessoa clica.
 * Canais: compartilhar do celular (PDF anexo), WhatsApp (link), e-mail
 * (direto com PDF anexo se a empresa configurou SMTP; senão abre o app de
 * e-mail com o link), copiar link e baixar PDF.
 */
export function ShareDocumentButton({
  action,
  label = "Enviar ao cliente",
  variant = "outline",
}: {
  action: () => Promise<ShareLinkResult>;
  label?: string;
  variant?: "outline" | "default" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ShareLinkResult | null>(null);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();

  function openAndCreate() {
    setOpen(true);
    setResult(null);
    startLoading(async () => {
      const r = await action();
      if (!r.ok) {
        toast.error(r.message ?? "Não foi possível gerar o link.");
        setOpen(false);
        return;
      }
      setResult(r);
      setText(r.text ?? "");
      setEmail(r.recipient?.email ?? "");
    });
  }

  async function nativeShare() {
    if (!result?.pdfUrl) return;
    try {
      const blob = await (await fetch(result.pdfUrl)).blob();
      const file = new File([blob], "documento.pdf", { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        await navigator.share({ text });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Não foi possível compartilhar.");
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={openAndCreate} disabled={loading}>
        <Send className="mr-1.5 h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar ao cliente</DialogTitle>
            <DialogDescription>
              {loading || !result
                ? "Gerando o documento…"
                : `O cliente abre o link sem precisar de login. Válido até ${new Date(result.expiresAt!).toLocaleDateString("pt-BR")}.`}
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="share-text">Mensagem</Label>
                <Textarea
                  id="share-text"
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {canNativeShare && (
                  <Button type="button" onClick={nativeShare} className="col-span-2">
                    <Share2 className="mr-1.5 h-4 w-4" />
                    Compartilhar com PDF anexo
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  render={
                    <a
                      href={whatsappUrl(result.recipient?.phone, text)}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(result.url!);
                    toast.success("Link copiado.");
                  }}
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copiar link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  render={<a href={result.pdfUrl} target="_blank" rel="noopener noreferrer" />}
                  className="col-span-2"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Baixar PDF
                </Button>
              </div>

              <div className="flex flex-col gap-1.5 border-t pt-3">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="share-email">E-mail</Label>
                  <Hint>
                    {result.emailEnabled
                      ? "O sistema envia o e-mail com o PDF anexo."
                      : "Abre o seu aplicativo de e-mail com a mensagem e o link. Para o sistema enviar sozinho com PDF anexo, configure em Perfil › E-mail de envio."}
                  </Hint>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="share-email"
                    type="email"
                    autoComplete="email"
                    placeholder="cliente@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {result.emailEnabled ? (
                    <Button
                      type="button"
                      disabled={sending || !email}
                      onClick={() =>
                        startSending(async () => {
                          const r = await sendShareByEmail({
                            shareId: result.shareId!,
                            to: email,
                            message: text,
                          });
                          if (r.ok) toast.success("E-mail enviado.");
                          else toast.error(r.message ?? "Não foi possível enviar.");
                        })
                      }
                    >
                      <Mail className="mr-1.5 h-4 w-4" />
                      {sending ? "Enviando…" : "Enviar"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      render={
                        <a
                          href={`mailto:${email}?subject=${encodeURIComponent("Documento")}&body=${encodeURIComponent(text)}`}
                        />
                      }
                    >
                      <Mail className="mr-1.5 h-4 w-4" />
                      Abrir e-mail
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
