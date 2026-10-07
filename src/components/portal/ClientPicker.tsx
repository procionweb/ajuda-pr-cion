import { useIsMobileOrTablet } from "@/hooks/use-mobile";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { matchClient, useClients } from "@/lib/clients-store";
import { cn } from "@/lib/utils";
import type { ClientRow } from "@/routes/clientes.index";

type Props = {
  value: ClientRow | null;
  onSelect: (client: ClientRow) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Variante compacta (altura 9, cantos md) para uso dentro de modais densos. */
  compact?: boolean;
};

/**
 * Seletor único de clientes reutilizável em toda a aplicação.
 * Consulta a fonte única (useClients) e permite buscar por sigla,
 * fantasia, razão social, CNPJ e cidade. Mostra somente clientes ativos.
 */
export function ClientPicker({
  value,
  onSelect,
  label = "Empresa",
  required,
  placeholder = "Busca rápida",
  className,
  disabled,
  compact,
}: Props) {
  const { clients, loading, error } = useClients({ onlyActive: true });
  const compactScreen = useIsMobileOrTablet();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const filtered = useMemo(() => clients.filter((c) => matchClient(c, query)), [clients, query]);

  return (
    <div ref={rootRef} className={cn("relative min-w-0 max-w-full", className)}>
      {label && (
        <Label className="mb-1.5 block text-[12px] font-medium text-foreground">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden border border-input bg-background px-3 text-left transition hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer",
          compact ? "h-9 rounded-md text-[13px]" : "h-11 rounded-xl bg-card text-sm",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        {value ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{value.acronym}</span>
            <span className="min-w-0 flex-1 truncate">{value.fantasia || value.name}</span>
            {value.cnpj && (
              <span className="hidden truncate text-xs text-muted-foreground md:inline">
                · {value.cnpj}
              </span>
            )}
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus={!compactScreen}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite para filtrar..."
                className="h-10 rounded-lg pl-9"
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {loading && clients.length === 0 && (
              <li className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando clientes...
              </li>
            )}
            {error && !loading && (
              <li className="px-3 py-4 text-center text-sm text-destructive">
                Erro ao carregar clientes: {error}
              </li>
            )}
            {!loading && !error && filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado
              </li>
            )}
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-accent cursor-pointer"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {c.acronym}
                      </span>
                      <span className="truncate font-medium">{c.fantasia || c.name}</span>
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {c.razaoSocial}
                      {c.cnpj && ` · ${c.cnpj}`}
                      {c.city && ` · ${c.city}`}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
