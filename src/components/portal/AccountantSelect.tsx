import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Search, UserRound, X } from "lucide-react";
import { listAccountants, type Accountant } from "@/lib/accountants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AccountantSelect({
  value,
  name,
  office,
  onChange,
}: {
  value: string;
  name: string;
  office: string;
  onChange: (accountant: Accountant | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Accountant[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    listAccountants()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const filtered = rows.filter((row) =>
    normalize([row.name, row.office, row.document, row.email].filter(Boolean).join(" ")).includes(
      normalize(search),
    ),
  );
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="flex items-center gap-3 text-base font-medium">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <UserRound className="size-5" />
        </span>
        Contabilidade
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">Selecione um contador já cadastrado.</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="mt-4 h-11 w-full cursor-pointer justify-between rounded-xl text-sm font-normal"
          >
            <span className="truncate">
              {name || "Buscar contador por nome, escritório ou documento..."}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label="Buscar contador"
              placeholder="Digite para buscar..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto">
            {loading ? (
              <p className="p-3 text-sm text-muted-foreground">Carregando contadores...</p>
            ) : failed ? (
              <div className="p-3 text-sm">
                Não foi possível carregar os contadores.
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setAttempt((previous) => previous + 1)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nenhum contador encontrado.</p>
            ) : (
              filtered.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-left hover:bg-accent focus:bg-accent"
                  onClick={() => {
                    onChange(row);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <UserRound className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[row.office, row.email].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {value === row.id && <Check className="size-4 text-primary" />}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {(name || value) && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name || "Contador selecionado"}</p>
            {office && <p className="truncate text-xs text-muted-foreground">{office}</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="mr-1 size-4" />
            Remover
          </Button>
        </div>
      )}
    </section>
  );
}
