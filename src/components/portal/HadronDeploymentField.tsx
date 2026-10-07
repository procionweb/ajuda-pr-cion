import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CollaboratorSelect } from "@/components/portal/CollaboratorPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import banksCatalog from "@/data/banks.json";
import { moduleOptions } from "@/lib/modules-map";

export const deploymentSelectKeys = new Set([
  "hadron_responsible_1",
  "hadron_responsible_2",
  "modules",
  "banks",
  "nfe_validation",
  "data_import",
  "bank_slip",
]);

export function HadronDeploymentField({
  field,
  value,
  onChange,
}: {
  field: string;
  value: string;
  onChange: (value: string, collaboratorId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  if (field.startsWith("hadron_responsible_"))
    return (
      <CollaboratorSelect
        value={value}
        onChange={(next, collaborator) => onChange(next, collaborator?.id || "")}
        placeholder="Buscar responsável PRC"
        className="mt-1 h-11 rounded-xl"
      />
    );
  if (field !== "modules" && field !== "banks")
    return (
      <select
        id={`deal-${field}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full cursor-pointer rounded-xl border bg-background px-3 text-sm"
      >
        <option value="">Selecione</option>
        {value && !["Sim", "Não"].includes(value) && <option value={value}>{value}</option>}
        <option value="Sim">Sim</option>
        <option value="Não">Não</option>
      </select>
    );
  const options =
    field === "banks"
      ? banksCatalog.banks.map((bank) => `${bank.code} · ${bank.name}`)
      : moduleOptions;
  const label = field === "banks" ? "banco(s)" : "módulo(s)";
  const selected = value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return (
    <div className="mt-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label={field === "banks" ? "Bancos para cobrança" : "Módulos contratados"}
            aria-expanded={open}
            className="h-11 w-full cursor-pointer justify-between rounded-xl text-sm font-normal"
          >
            <span className="truncate">
              {selected.length
                ? `${selected.length} ${label} selecionado(s)`
                : field === "banks"
                  ? "Buscar bancos..."
                  : "Buscar módulos..."}
            </span>
            <ChevronDown className="size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
          <Input
            aria-label={field === "banks" ? "Buscar bancos" : "Buscar módulos"}
            placeholder="Digite para buscar..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="mt-2 max-h-64 overflow-y-auto">
            {options
              .filter((option) => normalize(option).includes(normalize(search)))
              .map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected.includes(option)}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg p-2 text-left text-sm hover:bg-accent"
                  onClick={() =>
                    onChange(
                      (selected.includes(option)
                        ? selected.filter((item) => item !== option)
                        : [...selected, option]
                      ).join("; "),
                    )
                  }
                >
                  {option}
                  {selected.includes(option) && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              ))}
            {!options.some((option) => normalize(option).includes(normalize(search))) && (
              <p className="p-2 text-xs text-muted-foreground">Nenhuma opção encontrada.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
