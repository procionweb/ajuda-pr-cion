import { useIsMobileOrTablet } from "@/hooks/use-mobile";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Search, UserRound, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  collaboratorMatches,
  departmentLabel,
  findCollaborator,
  useCollaborators,
  type Collaborator,
} from "@/lib/collaborators-store";

type BaseProps = {
  /** Inclui colaboradores inativos na lista (padrão: somente ativos). */
  includeInactive?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function OptionRow({
  collaborator,
  selected,
  onSelect,
}: {
  collaborator: Collaborator;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-foreground">
          {collaborator.name}
          {!collaborator.active && (
            <span className="ml-1.5 text-[10.5px] uppercase tracking-wide text-muted-foreground">inativo</span>
          )}
        </span>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {[collaborator.acronym, departmentLabel(collaborator.department)].filter(Boolean).join(" · ")}
        </span>
      </span>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

function useFiltered(list: Collaborator[], term: string) {
  return useMemo(() => list.filter((item) => collaboratorMatches(item, term)), [list, term]);
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const compactScreen = useIsMobileOrTablet();
  return (
    <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        autoFocus={!compactScreen}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Pesquisar por nome, sigla, departamento ou e-mail"
        className="h-6 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function StateRow({ loading, error, empty }: { loading: boolean; error: string | null; empty: boolean }) {
  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 px-2 py-4 text-[12.5px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando colaboradores...
      </p>
    );
  }
  if (error) {
    return <p className="px-2 py-4 text-center text-[12.5px] text-destructive">{error}</p>;
  }
  if (empty) {
    return <p className="px-2 py-4 text-center text-[12.5px] text-muted-foreground">Nenhum colaborador encontrado</p>;
  }
  return null;
}

/** Seleção de um único colaborador (responsável, operador, técnico, atendente). */
export function CollaboratorSelect({
  value,
  onChange,
  includeInactive,
  placeholder = "Selecione o colaborador",
  className,
  disabled,
}: BaseProps & {
  /** Sigla, e-mail, id ou nome já salvo. */
  value: string | null | undefined;
  /** Recebe a sigla do colaborador (ou o valor original quando não houver sigla). */
  onChange: (value: string, collaborator?: Collaborator) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { collaborators, allCollaborators, loading, error } = useCollaborators({
    onlyActive: !includeInactive,
  });

  const current = findCollaborator(allCollaborators, value);
  // Somente ativos são selecionáveis; o vínculo histórico já salvo continua visível.
  const options = useMemo(() => {
    const base = includeInactive ? allCollaborators : collaborators;
    if (current && !base.some((item) => item.id === current.id)) return [current, ...base];
    return base;
  }, [includeInactive, allCollaborators, collaborators, current]);
  const filtered = useFiltered(options, term);

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setTerm(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-[13px] outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
        >
          <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
            {current
              ? `${current.acronym ? `${current.acronym} · ` : ""}${current.name}`
              : value || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-[260px] p-1">
        <SearchBox value={term} onChange={setTerm} />
        <StateRow loading={loading} error={error} empty={filtered.length === 0} />
        <ul className="max-h-64 overflow-y-auto pt-1">
          {filtered.map((item) => (
            <li key={item.id}>
              <OptionRow
                collaborator={item}
                selected={current?.id === item.id}
                onSelect={() => {
                  onChange(item.acronym ?? item.name, item);
                  setOpen(false);
                  setTerm("");
                }}
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export type CollaboratorGuest = {
  id: string;
  name: string;
  email: string | null;
  acronym: string | null;
};

/** Seleção múltipla de colaboradores (convidados do agendamento). */
export function CollaboratorMultiSelect({
  value,
  onChange,
  includeInactive,
  placeholder = "Selecionar convidados",
  className,
  disabled,
}: BaseProps & {
  value: CollaboratorGuest[];
  onChange: (value: CollaboratorGuest[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { collaborators, allCollaborators, loading, error } = useCollaborators({
    onlyActive: !includeInactive,
  });

  const selectedIds = useMemo(() => new Set(value.map((item) => item.id)), [value]);
  // Somente ativos entram na lista; inativos já convidados permanecem visíveis.
  const options = useMemo(() => {
    const base = includeInactive ? allCollaborators : collaborators;
    const extras = allCollaborators.filter(
      (item) => selectedIds.has(item.id) && !base.some((row) => row.id === item.id),
    );
    return [...extras, ...base];
  }, [includeInactive, allCollaborators, collaborators, selectedIds]);
  const filtered = useFiltered(options, term);

  const toggle = (collaborator: Collaborator) => {
    if (selectedIds.has(collaborator.id)) {
      onChange(value.filter((item) => item.id !== collaborator.id));
      return;
    }
    onChange([
      ...value,
      {
        id: collaborator.id,
        name: collaborator.name,
        email: collaborator.email,
        acronym: collaborator.acronym,
      },
    ]);
  };

  return (
    <div className={cn("rounded-md border border-input bg-background px-2 py-2", className)}>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((guest) => (
            <span
              key={guest.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[12px] text-primary"
            >
              <span className="truncate">
                {guest.acronym ? `${guest.acronym} · ${guest.name}` : guest.name}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item.id !== guest.id))}
                aria-label={`Remover ${guest.name}`}
                className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setTerm(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="inline-flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-1 text-left text-[13px] text-muted-foreground outline-none hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">{placeholder}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-[280px] p-1">
          <SearchBox value={term} onChange={setTerm} />
          <StateRow loading={loading} error={error} empty={filtered.length === 0} />
          <ul className="max-h-64 overflow-y-auto pt-1">
            {filtered.map((item) => (
              <li key={item.id}>
                <OptionRow
                  collaborator={item}
                  selected={selectedIds.has(item.id)}
                  onSelect={() => toggle(item)}
                />
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
