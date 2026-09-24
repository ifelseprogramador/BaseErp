import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Ícone de "?" com dica ao passar o mouse/tocar — usado ao lado de
 * `<Label>` em pontos que costumam gerar dúvida (formato de um campo,
 * o que uma ação vai fazer, etc.). `type="button"` é obrigatório: quase
 * todo uso fica dentro de um `<form>`, e sem isso o navegador trataria
 * como o botão de submeter.
 */
export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center"
            aria-label="Ajuda"
          />
        }
      >
        <Info className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
