import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Pencil,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import {
  type Collaborator,
  collaboratorMatches,
  departmentLabel,
  useCollaborators,
} from "@/lib/collaborators-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes/colaboradores")({
  head: () => ({ meta: [{ title: "Colaboradores - Configurações - Portal Prócion" }] }),
  component: CollaboratorsSettingsPage,
});

const PAGE_SIZE = 25;

type CollaboratorDetail = {
  id: string;
  legacy_id: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  operator_acronym: string | null;
  operator_code: string | null;
  active: boolean;
  phone: string | null;
  personal_mobile: string | null;
  business_mobile: string | null;
  birth_date: string | null;
  cpf: string | null;
  pis: string | null;
  work_card: string | null;
  admitted_at: string | null;
  terminated_at: string | null;
  driver_license_type: string | null;
  driver_license_expires_at: string | null;
  company_legacy_id: string | null;
  company_name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function CollaboratorsSettingsPage() {
  const { allCollaborators, loading, error, reload } = useCollaborators({ onlyActive: false });
  const [acronym, setAcronym] = useState("");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("");
  const [dateStart, setDateStart] = useState<Date | undefined>();
  const [dateEnd, setDateEnd] = useState<Date | undefined>();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Collaborator | null>(null);
  const [editorMode, setEditorMode] = useState<"view" | "edit">("view");
  const [deactivating, setDeactivating] = useState<Collaborator | null>(null);

  const departments = useMemo(
    () =>
      [...new Set(allCollaborators.map((item) => item.department).filter(Boolean))]
        .map((value) => String(value))
        .sort((a, b) => departmentLabel(a).localeCompare(departmentLabel(b), "pt-BR")),
    [allCollaborators],
  );

  const acronyms = useMemo(
    () =>
      [...new Set(allCollaborators.map((item) => item.acronym).filter(Boolean))]
        .map(String)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [allCollaborators],
  );

  const filtered = useMemo(
    () =>
      allCollaborators.filter((item) => {
        if (acronym && item.acronym !== acronym) {
          return false;
        }
        if (status === "active" && !item.active) return false;
        if (status === "inactive" && item.active) return false;
        if (department && item.department !== department) return false;
        if (dateStart || dateEnd) {
          if (!item.createdAt) return false;
          const createdAt = new Date(item.createdAt);
          if (Number.isNaN(createdAt.getTime())) return false;
          if (dateStart && createdAt < startOfDay(dateStart)) return false;
          if (dateEnd && createdAt > endOfDay(dateEnd)) return false;
        }
        return collaboratorMatches(item, query);
      }),
    [acronym, allCollaborators, dateEnd, dateStart, department, query, status],
  );

  useEffect(() => setPage(0), [acronym, dateEnd, dateStart, department, query, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Colaboradores"
        description="Cadastros e acessos da equipe Prócion."
        breadcrumbs={[{ label: "Configurações" }, { label: "Colaboradores" }]}
      />

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_190px_240px_230px_minmax(260px,1fr)_auto]">
        <select
          value={acronym}
          onChange={(event) => setAcronym(event.target.value)}
          className={selectClass}
          aria-label="Filtrar por sigla"
        >
          <option value="">Todas as siglas</option>
          {acronyms.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={selectClass}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <DateRangeFilter
          start={dateStart}
          end={dateEnd}
          onChange={({ start, end }) => {
            setDateStart(start);
            setDateEnd(end);
          }}
        />
        <select
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos os departamentos</option>
          {departments.map((item) => (
            <option key={item} value={item}>
              {departmentLabel(item)}
            </option>
          ))}
        </select>
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar por nome, e-mail, função ou código"
            className="h-10 pl-9"
          />
        </label>
        <Button variant="outline" className="h-10 gap-2" onClick={reload} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </section>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="border-b bg-muted/35 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-normal">Sigla / Cód.</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Departamento</th>
                <th className="px-4 py-3 font-normal">Nome</th>
                <th className="px-4 py-3 font-normal">E-mail</th>
                <th className="px-4 py-3 font-normal">Datas</th>
                <th className="px-4 py-3 text-center font-normal">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="h-52 text-center text-muted-foreground">
                    Carregando colaboradores...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="h-52 px-6 text-center text-destructive">
                    Não foi possível carregar os colaboradores: {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-52 text-center text-muted-foreground">
                    Nenhum colaborador encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/25">
                    <td className="px-4 py-3">
                      <p className="font-normal text-foreground">
                        {item.acronym || "Não informado"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Cód. Hádron: {item.operatorCode || "Não informado"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          item.active ? "text-foreground" : "text-destructive",
                        )}
                      >
                        {item.active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        {item.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {departmentLabel(item.department) || "Não informado"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.email || "Não informado"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <p>{formatDateTime(item.createdAt)}</p>
                      <p className="mt-1">{formatDateTime(item.updatedAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Visualizar colaborador"
                          onClick={() => {
                            setEditorMode("view");
                            setSelected(item);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar colaborador"
                          onClick={() => {
                            setEditorMode("edit");
                            setSelected(item);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          title="Desativar colaborador"
                          disabled={!item.active}
                          onClick={() => setDeactivating(item)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm text-muted-foreground">
          <span>
            Mostrando {filtered.length ? safePage * PAGE_SIZE + 1 : 0} a{" "}
            {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}{" "}
            colaboradores
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Página {safePage + 1} de {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={safePage + 1 >= pageCount}
              onClick={() => setPage(safePage + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </div>

      <CollaboratorDetails
        collaborator={selected}
        mode={editorMode}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null);
          reload();
        }}
      />

      <DeactivateCollaboratorDialog
        collaborator={deactivating}
        onClose={() => setDeactivating(null)}
        onDone={() => {
          setDeactivating(null);
          reload();
        }}
      />
    </AppShell>
  );
}

function DateRangeFilter({
  start,
  end,
  onChange,
}: {
  start?: Date;
  end?: Date;
  onChange: (range: { start?: Date; end?: Date }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    start || end ? { from: start, to: end } : undefined,
  );

  useEffect(() => {
    setDraft(start || end ? { from: start, to: end } : undefined);
  }, [start, end]);

  const label = start && end
    ? `${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}`
    : start
      ? `A partir de ${format(start, "dd/MM/yyyy")}`
      : end
        ? `Até ${format(end, "dd/MM/yyyy")}`
        : "Período de cadastro";

  function apply() {
    let from = draft?.from;
    let to = draft?.to;
    if (from && to && from > to) [from, to] = [to, from];
    onChange({ start: from, end: to });
    setOpen(false);
  }

  function clear() {
    setDraft(undefined);
    onChange({ start: undefined, end: undefined });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 w-full items-center gap-2 truncate rounded-md border border-input bg-background px-3 text-left text-sm text-foreground shadow-sm outline-none focus:ring-2 focus:ring-ring/20",
            !start && !end && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={draft}
          onSelect={setDraft}
          locale={ptBR}
          initialFocus
          className="pointer-events-auto p-3"
        />
        <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={clear}>Limpar</Button>
          <Button type="button" size="sm" onClick={apply}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
}

function CollaboratorDetails({
  collaborator,
  mode,
  onClose,
  onSaved,
}: {
  collaborator: Collaborator | null;
  mode: "view" | "edit";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<CollaboratorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!collaborator) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (supabase as any)
      .rpc("configuration_collaborator_get", { collaborator_id: collaborator.id })
      .then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
          setDetail(null);
        } else {
          setDetail(data as CollaboratorDetail);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [collaborator]);

  async function save() {
    if (!detail) return;
    if (!detail.first_name?.trim()) {
      toast.error("Informe o nome do colaborador.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("configuration_collaborator_save", {
      collaborator_id: detail.id,
      collaborator_payload: {
        first_name: detail.first_name,
        last_name: detail.last_name,
        operator_acronym: detail.operator_acronym,
        operator_code: detail.operator_code,
        active: detail.active,
        department: detail.department,
        job_title: detail.job_title,
        email: detail.email,
        phone: detail.phone,
        personal_mobile: detail.personal_mobile,
        business_mobile: detail.business_mobile,
        birth_date: detail.birth_date,
        cpf: detail.cpf,
        pis: detail.pis,
        work_card: detail.work_card,
        admitted_at: detail.admitted_at,
        terminated_at: detail.terminated_at,
        driver_license_type: detail.driver_license_type,
        driver_license_expires_at: detail.driver_license_expires_at,
      },
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Colaborador atualizado.");
    onSaved();
  }

  const update = (field: keyof CollaboratorDetail, value: string | boolean) =>
    setDetail((current) => (current ? { ...current, [field]: value || null } : current));

  return (
    <Dialog open={Boolean(collaborator)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-[640px]">
        <DialogHeader>
          <div className="border-b px-6 py-5 pr-12">
            <DialogTitle className="text-lg font-normal text-foreground">
              {detail?.operator_acronym || collaborator?.acronym || collaborator?.name || "Colaborador"}
            </DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "edit" ? "Editar cadastro" : "Visualizar cadastro"}
            </p>
          </div>
        </DialogHeader>
        <div className="px-6 py-5">
        {loading ? (
          <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
            Carregando cadastro...
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <DetailSection title="Geral">
              <DetailField label="Nome" field="first_name" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Sobrenome" field="last_name" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Sigla" field="operator_acronym" detail={detail} editing={mode === "edit"} update={update} />
              <SelectField
                label="Status"
                value={detail.active ? "active" : "inactive"}
                editing={mode === "edit"}
                options={[{ value: "active", label: "Ativo" }, { value: "inactive", label: "Inativo" }]}
                onChange={(value) => update("active", value === "active")}
              />
              <SelectField
                label="Departamento"
                value={detail.department ?? ""}
                editing={mode === "edit"}
                options={Object.entries({ admin: "Administrativo", support: "Suporte", development: "Desenvolvimento", commercial: "Comercial", cob: "Cobrança", tester: "Testes" }).map(([value, label]) => ({ value, label }))}
                onChange={(value) => update("department", value)}
              />
              <DetailField label="Função" field="job_title" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="CPF" field="cpf" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Nascimento" field="birth_date" type="date" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Admissão" field="admitted_at" type="date" detail={detail} editing={mode === "edit"} update={update} />
            </DetailSection>

            <DetailSection title="Usuário Web">
              <DetailField label="Sigla" field="operator_acronym" detail={detail} editing={mode === "edit"} update={update} />
              <Detail label="Senha" value="Protegida e não exibida" />
              <DetailField label="Código Hádron" field="operator_code" detail={detail} editing={mode === "edit"} update={update} />
              <Detail label="Nome completo" value={detail.full_name || [detail.first_name, detail.last_name].filter(Boolean).join(" ") || "Não informado"} />
              <DetailField label="E-mail" field="email" type="email" detail={detail} editing={mode === "edit"} update={update} />
              <Detail label="Perfil" value="PRC" />
            </DetailSection>

            <DetailSection title="Contato">
              <DetailField label="E-mail" field="email" type="email" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Telefone" field="phone" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Celular pessoal" field="personal_mobile" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Celular comercial" field="business_mobile" detail={detail} editing={mode === "edit"} update={update} />
            </DetailSection>

            <DetailSection title="Operacional">
              <Detail label="Empresa" value={detail.company_name || "Não informado"} />
              <DetailField label="PIS" field="pis" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Carteira de trabalho" field="work_card" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Tipo de CNH" field="driver_license_type" detail={detail} editing={mode === "edit"} update={update} />
              <DetailField label="Vencimento CNH" field="driver_license_expires_at" type="date" detail={detail} editing={mode === "edit"} update={update} />
              <Detail label="Cód. operador" value={detail.operator_code || "Não informado"} />
            </DetailSection>

            <div className="grid gap-x-5 gap-y-4 border-t pt-4 sm:grid-cols-2">
              <Detail label="Criado" value={formatDateTime(detail.created_at)} />
              <Detail label="Modificado" value={formatDateTime(detail.updated_at)} />
            </div>
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center text-sm text-destructive">
            Não foi possível carregar o cadastro.
          </div>
        )}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>Fechar</Button>
          {mode === "edit" && (
            <Button onClick={() => void save()} disabled={saving || loading || !detail}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between bg-muted px-4 py-2.5 text-sm text-foreground">
        <h3 className="font-normal">{title}</h3>
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="grid gap-x-7 gap-y-1 px-4 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function DetailField({
  label,
  field,
  detail,
  editing,
  update,
  type = "text",
}: {
  label: string;
  field: keyof CollaboratorDetail;
  detail: CollaboratorDetail;
  editing: boolean;
  update: (field: keyof CollaboratorDetail, value: string) => void;
  type?: string;
}) {
  const value = String(detail[field] ?? "");
  if (!editing) return <Detail label={label} value={type === "date" ? formatDate(value) : value || "Não informado"} />;
  return (
    <div className="grid min-w-0 gap-0.5 border-b border-border pb-1">
      <Label htmlFor={`collaborator-${String(field)}`} className="text-xs text-muted-foreground">{label}</Label>
      <Input
        id={`collaborator-${String(field)}`}
        type={type}
        value={value}
        onChange={(event) => update(field, event.target.value)}
        className="h-8 rounded-none border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  editing,
  options,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const labelValue = options.find((option) => option.value === value)?.label || value || "Não informado";
  if (!editing) return <Detail label={label} value={labelValue} />;
  return (
    <div className="grid min-w-0 gap-0.5 border-b border-border pb-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select className="h-8 w-full border-0 bg-transparent px-1 text-sm text-foreground outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Não informado</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function DeactivateCollaboratorDialog({
  collaborator,
  onClose,
  onDone,
}: {
  collaborator: Collaborator | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function deactivate() {
    if (!collaborator) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc("configuration_collaborator_deactivate", {
      collaborator_id: collaborator.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Colaborador desativado.");
    onDone();
  }
  return (
    <AlertDialog open={Boolean(collaborator)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar colaborador?</AlertDialogTitle>
          <AlertDialogDescription>
            {collaborator?.name} ficará inativo, mas seu histórico será preservado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={saving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              void deactivate();
            }}
          >
            {saving ? "Desativando..." : "Desativar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-border pb-2 pt-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 break-words text-sm font-normal text-foreground">{value}</p>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20";
