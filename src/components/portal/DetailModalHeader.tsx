import type { ReactNode } from "react";
import { type LucideIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho padronizado para modais de detalhe e telas afins.
 *
 * Estrutura: faixa colorida à esquerda, ícone circular sólido, título,
 * metadados/protocolo, chips e botão X. O mesmo ícone é reutilizado como
 * marca d'água decorativa à direita (apenas em telas médias+).
 */
export function DetailModalHeader({
  icon: Icon,
  title,
  protocol,
  meta,
  chips,
  trailing,
  onClose,
  dense = false,
  accentClassName = "bg-primary",
  iconWrapClassName = "bg-primary text-primary-foreground",
  decorativeIconClassName = "text-primary/10",
}: {
  icon: LucideIcon;
  title: ReactNode;
  protocol?: string;
  meta?: ReactNode;
  chips?: ReactNode;
  /** Conteúdo alinhado à direita no desktop e quebrado para linha abaixo em telas menores. */
  trailing?: ReactNode;
  onClose?: () => void;
  /** Versão ainda mais compacta (menos padding vertical). */
  dense?: boolean;
  /** Classe da faixa vertical à esquerda. */
  accentClassName?: string;
  /** Classe do círculo sólido do ícone (fundo + cor). */
  iconWrapClassName?: string;
  /** Classe da marca d'água (ícone grande decorativo). */
  decorativeIconClassName?: string;
}) {
  return (
    <header
      className={cn(
        "relative shrink-0 border-b border-border bg-card px-3 pb-2 pt-2 md:px-5 md:pb-3 md:pt-3",
        dense && "pb-1.5 pt-1.5 md:pb-2 md:pt-2",
      )}
    >
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.05)]">
        <span aria-hidden className={cn("absolute left-0 top-0 h-full w-1", accentClassName)} />

        <div
          className={cn(
            "flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-2.5 md:gap-3 md:py-3",
            dense && "py-1.5 md:py-2",
          )}
        >
          {/* decorativeIconClassName intentionally unused */}
          <span aria-hidden className={cn("hidden", decorativeIconClassName)} />
          <span
            aria-hidden
            className={cn(
              "detail-modal-icon grid h-8 w-8 shrink-0 place-items-center rounded-full shadow-sm ring-1 ring-inset ring-white/10",
              iconWrapClassName,
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.5} />
          </span>

          <div className="min-w-0 flex-[1_1_100%] sm:flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {protocol && (
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  {protocol}
                </span>
              )}
              {chips}
            </div>

            <h2 className="mt-0.5 text-[14px] font-medium leading-snug text-foreground">{title}</h2>

            {meta && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                {meta}
              </div>
            )}
          </div>

          {trailing && (
            <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:flex-initial sm:justify-end">
              {trailing}
            </div>
          )}
          {onClose && (
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="ml-auto grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
