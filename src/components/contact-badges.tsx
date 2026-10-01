import { Mail, Phone } from "lucide-react";
import { siWhatsapp } from "simple-icons";
import { Badge } from "@/components/ui/badge";
import { formatPhoneBr, isLikelyMobile, telLink, whatsappLink } from "@/core/contact-links";

/**
 * Selo de telefone: celular abre o WhatsApp (nova aba), fixo abre a
 * discagem (`tel:`). Para usar dentro de `EntityHeader#badges`.
 */
export function PhoneBadge({ phone }: { phone: string }) {
  const whats = isLikelyMobile(phone);
  return (
    <Badge
      variant="outline"
      className="h-6 gap-1.5 px-2.5 text-xs"
      render={
        <a
          href={whats ? whatsappLink(phone) : telLink(phone)}
          {...(whats ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          title={whats ? "Abrir conversa no WhatsApp" : "Ligar"}
        />
      }
    >
      {whats ? (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-3.5 shrink-0"
          style={{ fill: `#${siWhatsapp.hex}` }}
        >
          <path d={siWhatsapp.path} />
        </svg>
      ) : (
        <Phone data-icon="inline-start" />
      )}
      {formatPhoneBr(phone)}
    </Badge>
  );
}

/** Selo de e-mail: abre o aplicativo de e-mail (`mailto:`). */
export function EmailBadge({ email }: { email: string }) {
  return (
    <Badge
      variant="outline"
      className="h-6 max-w-full gap-1.5 px-2.5 text-xs"
      render={<a href={`mailto:${email}`} title="Enviar e-mail" />}
    >
      <Mail data-icon="inline-start" />
      <span className="truncate">{email}</span>
    </Badge>
  );
}
