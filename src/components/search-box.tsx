"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de busca genérico que escreve o termo na URL (`?q=`) e deixa a
 * página (Server Component) reler `searchParams` e refazer a query. Usado
 * por qualquer módulo com listagem pesquisável — não duplique esta lógica
 * em `modules/<modulo>/components/`.
 */
export function SearchBox({
  placeholder,
  large = false,
}: {
  placeholder: string;
  large?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function handleChange(next: string) {
    setValue(next);
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className={cn("relative w-full", large ? "max-w-xl" : "max-w-sm")}>
      <Search
        className={cn(
          "text-muted-foreground absolute top-1/2 -translate-y-1/2",
          large ? "left-4 h-6 w-6" : "left-2.5 h-4 w-4",
        )}
      />
      <Input
        placeholder={placeholder}
        className={large ? "h-14 rounded-full pl-12 text-lg md:text-lg" : "pl-8"}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}
