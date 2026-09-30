"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { siTelegram, siWhatsapp } from "simple-icons";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Send,
  Share2,
} from "lucide-react";
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
import { SHARE_VARS, renderShareTemplate } from "@/core/share/template";

const TEMPLATE_KEY = (kind?: string) => `share-template:${kind ?? "outro"}`;

/** Modelo preferido desta pessoa neste navegador (localStorage pode estar bloqueado). */
function loadSavedTemplate(kind?: string): string | null {
  try {
    return localStorage.getItem(TEMPLATE_KEY(kind));
  } catch {
    return null;
  }
}

/** wa.me exige DDI: assume Brasil (55) quando o número tem 10 ou 11 dígitos. */
function whatsappUrl(phone: string | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

function BrandIcon({ icon }: { icon: { path: string } }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}

/** Linha de canal com a cor da marca (WhatsApp, Telegram, E-mail). */
function ChannelLink({
  href,
  color,
  textColor = "#fff",
  icon,
  title,
  subtitle,
}: {
  href: string;
  color: string;
  textColor?: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ backgroundColor: color, color: textColor }}
      className="flex w-full min-w-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left shadow-sm transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.99]"
    >
      {icon}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">{title}</span>
        {subtitle && <span className="truncate text-xs opacity-80">{subtitle}</span>}
      </span>
    </a>
  );
}

function formatPhoneLabel(phone?: string) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || undefined;
}

/**
 * Botão "Enviar ao cliente" — igual em todos os verticais. `action` é a
 * Server Action do vertical que monta o documento e devolve o link
 * (`createSharedDocument`). O link/PDF só é gerado quando a pessoa clica.
 * Canais com a cor da marca: compartilhar do celular (PDF anexo), WhatsApp,
 * Telegram e e-mail (direto com PDF anexo se a empresa configurou SMTP;
 * senão abre o app de e-mail com o link). Também copia o link e baixa o PDF.
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
  const [template, setTemplate] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();

  function openAndCreate() {
    setOpen(true);
    setResult(null);
    setCopied(false);
    startLoading(async () => {
      const r = await action();
      if (!r.ok) {
        toast.error(r.message ?? "Não foi possível gerar o link.");
        setOpen(false);
        return;
      }
      setResult(r);
      setTemplate(loadSavedTemplate(r.kind) ?? r.template ?? "");
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

  // Texto final (variáveis trocadas) usado em todos os canais.
  const text = result ? renderShareTemplate(template, result.vars ?? {}) : "";
  const textWithoutLink = result
    ? renderShareTemplate(template, { ...result.vars, link: "" }, { ensureLink: false })
    : "";

  function insertVar(key: string) {
    const el = textRef.current;
    const token = `{${key}}`;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? template.length;
    setTemplate(template.slice(0, start) + token + template.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function saveTemplate() {
    try {
      localStorage.setItem(TEMPLATE_KEY(result?.kind), template);
      toast.success("Mensagem salva como seu padrão.");
    } catch {
      toast.error("Não foi possível salvar neste navegador.");
    }
  }

  function resetTemplate() {
    try {
      localStorage.removeItem(TEMPLATE_KEY(result?.kind));
    } catch {}
    setTemplate(result?.template ?? "");
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const phoneLabel = formatPhoneLabel(result?.recipient?.phone);

  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={openAndCreate} disabled={loading}>
        <Send className="mr-1.5 h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] content-start gap-3 overflow-x-hidden overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                <Send className="h-4 w-4" />
              </span>
              Enviar ao cliente
            </DialogTitle>
            <DialogDescription>
              {result
                ? `O cliente abre o link sem precisar de login. Válido até ${new Date(result.expiresAt!).toLocaleDateString("pt-BR")}.`
                : "Gerando o documento…"}
            </DialogDescription>
          </DialogHeader>

          {!result ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando link e PDF…
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="share-text">Mensagem</Label>
                  <Hint>
                    Escreva do seu jeito. Toque nos botões para inserir dados do cliente e do
                    documento: eles são trocados pelos valores reais na hora de enviar. O link vai
                    sempre ao final se você não colocar.
                  </Hint>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SHARE_VARS.filter((v) => v.key !== "link").map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVar(v.key)}
                      className="bg-muted hover:bg-muted/70 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition"
                    >
                      <Plus className="h-3 w-3" />
                      {v.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  id="share-text"
                  ref={textRef}
                  rows={3}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                />
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="xs" onClick={saveTemplate}>
                    <Save className="mr-1 h-3.5 w-3.5" />
                    Salvar como meu padrão
                  </Button>
                  <Button type="button" variant="ghost" size="xs" onClick={resetTemplate}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Voltar ao original
                  </Button>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-xs">Como o cliente vai receber:</p>
                  <div className="max-h-24 overflow-y-auto rounded-xl rounded-tl-sm bg-[#d9fdd3] px-3 py-2 text-sm whitespace-pre-line text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
                    {text}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Enviar por
                </p>
                {canNativeShare && (
                  <button
                    type="button"
                    onClick={nativeShare}
                    className="bg-primary text-primary-foreground flex w-full min-w-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left shadow-sm transition hover:brightness-95 active:scale-[0.99]"
                  >
                    <Share2 className="h-5 w-5 shrink-0" />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-sm font-semibold">
                        Compartilhar com PDF anexo
                      </span>
                      <span className="truncate text-xs opacity-80">
                        Escolha o app no seu celular
                      </span>
                    </span>
                  </button>
                )}
                <ChannelLink
                  href={whatsappUrl(result.recipient?.phone, text)}
                  color={`#${siWhatsapp.hex}`}
                  textColor="#06290f"
                  icon={<BrandIcon icon={siWhatsapp} />}
                  title="WhatsApp"
                  subtitle={phoneLabel ? `Conversa com ${phoneLabel}` : "Escolher o contato"}
                />
                <ChannelLink
                  href={`https://t.me/share/url?url=${encodeURIComponent(result.url!)}&text=${encodeURIComponent(textWithoutLink)}`}
                  color={`#${siTelegram.hex}`}
                  icon={<BrandIcon icon={siTelegram} />}
                  title="Telegram"
                  subtitle="Escolher o contato"
                />
              </div>

              <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border p-2.5">
                <div className="flex items-center gap-1.5">
                  <Mail className="text-muted-foreground h-4 w-4" />
                  <Label htmlFor="share-email">E-mail</Label>
                  <Hint>
                    {result.emailEnabled
                      ? "O sistema envia o e-mail com o PDF anexo."
                      : "Abre o seu aplicativo de e-mail com a mensagem e o link. Para o sistema enviar sozinho com PDF anexo, configure em Perfil › E-mail de envio."}
                  </Hint>
                </div>
                <div className="flex min-w-0 gap-2">
                  <Input
                    id="share-email"
                    className="min-w-0 flex-1"
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
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      nativeButton={false}
                      render={
                        <a
                          href={`mailto:${email}?subject=${encodeURIComponent("Documento")}&body=${encodeURIComponent(text)}`}
                        />
                      }
                    >
                      Abrir e-mail
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(result.url!);
                    setCopied(true);
                    toast.success("Link copiado.");
                  }}
                >
                  {copied ? (
                    <Check className="mr-1.5 h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="mr-1.5 h-4 w-4" />
                  )}
                  <span className="truncate">Copiar link</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  nativeButton={false}
                  render={<a href={result.pdfUrl} target="_blank" rel="noopener noreferrer" />}
                >
                  <Download className="mr-1.5 h-4 w-4 shrink-0" />
                  <span className="truncate">Baixar PDF</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
