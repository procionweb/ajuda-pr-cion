import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Laptop,
  Phone,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { ListPaginationFooter } from "@/components/portal/ListPaginationFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { companyLeadsApi, type CompanyLead, type CompanyLeadStage } from "@/lib/company-leads-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comercial/atividades")({
  component: CommercialActivitiesPage,
});

const PAGE_SIZE = 25;
const stageLabels: Record<CompanyLeadStage, string> = {
  novo: "Novo",
  prospeccao: "Prospecção",
  relacionamento: "Relacionamento",
  proposta: "Proposta",
  negociacao: "Negociação",
  demonstracao: "Demonstração",
  negocio_fechado: "Negócio fechado",
  sem_interesse: "Sem interesse",
};

type ActivityType = "conclusao" | "ligacao" | "demonstracao" | "acompanhamento";
type CommercialActivity = {
  id: string;
  leadId: string;
  type: ActivityType;
  date: string;
  returnAt: string | null;
  company: string;
  profile: string;
  note: string;
  city: string;
  state: string;
  stage: CompanyLeadStage;
  operator: string;
  priority: "alta" | "media" | "baixa";
};

function CommercialActivitiesPage() {
  const [activities, setActivities] = useState<CommercialActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchField, setSearchField] = useState("todos");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [substatus, setSubstatus] = useState("");
  const [dateType, setDateType] = useState("atividade");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const result = await companyLeadsApi.list({
          filters: emptyLeadFilters,
          sort: "opened_at",
          direction: "desc",
          limit: 1000,
          offset: 0,
        });
        if (!active) return;
        setActivities(result.leads.filter((lead) => lead.stage !== "novo").map(mapActivity));
      } catch {
        if (!active) return;
        toast.error("Não foi possível carregar as atividades comerciais.");
        setActivities([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = normalize(search);
    return activities.filter((activity) => {
      const searchable: Record<string, string> = {
        todos: `${activity.company} ${activity.note} ${activity.city} ${activity.operator}`,
        nome: activity.company,
        observacao: activity.note,
        cidade: `${activity.city} ${activity.state}`,
        operador: activity.operator,
      };
      if (term && !normalize(searchable[searchField] || searchable.todos).includes(term))
        return false;
      if (status && activity.stage !== status) return false;
      if (substatus && activity.type !== substatus) return false;
      const date = (dateType === "retorno" ? activity.returnAt : activity.date)?.slice(0, 10);
      if ((from || to) && !date) return false;
      if (from && date! < from) return false;
      if (to && date! > to) return false;
      return true;
    });
  }, [activities, dateType, from, search, searchField, status, substatus, to]);

  useEffect(() => setPage(0), [dateType, from, search, searchField, status, substatus, to]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Atividades"
        description="Histórico e acompanhamento das atividades da equipe comercial."
        breadcrumbs={[{ label: "Comercial" }, { label: "Atividades" }]}
      />

      <section className="mb-5 grid gap-3 lg:grid-cols-[190px_minmax(220px,1fr)_180px_180px_170px_150px_150px_auto]">
        <select
          value={searchField}
          onChange={(event) => setSearchField(event.target.value)}
          className={selectClass}
        >
          <option value="todos">Filtro</option>
          <option value="nome">Nome</option>
          <option value="observacao">Observação</option>
          <option value="cidade">Cidade / UF</option>
          <option value="operador">Operador</option>
        </select>
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisa geral"
            className="h-10 pl-9"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos os status</option>
          {Object.entries(stageLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={substatus}
          onChange={(event) => setSubstatus(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos os tipos</option>
          <option value="ligacao">Ligação</option>
          <option value="demonstracao">Demonstração</option>
          <option value="acompanhamento">Acompanhamento</option>
          <option value="conclusao">Conclusão</option>
        </select>
        <select
          value={dateType}
          onChange={(event) => setDateType(event.target.value)}
          className={selectClass}
        >
          <option value="atividade">Data da atividade</option>
          <option value="retorno">Data de retorno</option>
        </select>
        <Input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="h-10"
          aria-label="Data inicial"
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="h-10"
          aria-label="Data final"
        />
        <Button className="h-10" onClick={() => setPage(0)}>
          Buscar
        </Button>
      </section>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] table-fixed text-left text-xs">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[5%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[25%]" />
              <col className="w-[20%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[3%]" />
            </colgroup>
            <thead className="border-b bg-muted/35 uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">P</th>
                <th className="px-3 py-3 font-medium">Tipo</th>
                <th className="px-3 py-3 font-medium">Datas</th>
                <th className="px-3 py-3 font-medium">Retorno</th>
                <th className="px-3 py-3 font-medium">Nome</th>
                <th className="px-3 py-3 font-medium">Observação</th>
                <th className="px-3 py-3 font-medium">Cidade / UF</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="h-52 text-center text-muted-foreground">
                    Carregando atividades...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="h-52 text-center text-muted-foreground">
                    Nenhuma atividade encontrada.
                  </td>
                </tr>
              ) : (
                rows.map((activity) => <ActivityRow key={activity.id} activity={activity} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-3">
        <ListPaginationFooter page={page} pageCount={pageCount} pageSize={PAGE_SIZE} total={filtered.length} noun="atividades" onPageChange={setPage} />
      </div>
    </AppShell>
  );
}

function ActivityRow({ activity }: { activity: CommercialActivity }) {
  const TypeIcon =
    activity.type === "conclusao"
      ? Check
      : activity.type === "demonstracao"
        ? Laptop
        : activity.type === "ligacao"
          ? Phone
          : CalendarDays;
  return (
    <tr className="transition-colors hover:bg-muted/25">
      <td className="px-3 py-3">
        <span
          className={cn(
            "block h-3 w-3 rounded-full",
            activity.priority === "alta"
              ? "bg-destructive"
              : activity.priority === "media"
                ? "bg-amber-500"
                : "bg-emerald-500",
          )}
        />
      </td>
      <td className="px-3 py-3">
        <TypeIcon className="h-4 w-4 text-primary" />
      </td>
      <td className="px-3 py-3">
        <span className="block">{formatDate(activity.date)}</span>
        <span className="text-[10px] text-muted-foreground">{activity.operator}</span>
      </td>
      <td className="px-3 py-3">{activity.returnAt ? formatDate(activity.returnAt) : "—"}</td>
      <td className="min-w-0 px-3 py-3">
        <Link
          to="/comercial/contatos/$leadId"
          params={{ leadId: activity.leadId }}
          className="block truncate font-medium hover:text-primary"
          title={activity.company}
        >
          {activity.company}
        </Link>
        <span className="block truncate text-[10px] text-muted-foreground">{activity.profile}</span>
      </td>
      <td className="px-3 py-3">
        <span className="block truncate" title={activity.note}>
          {activity.note}
        </span>
      </td>
      <td className="px-3 py-3">
        {activity.city} - {activity.state}
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "inline-flex rounded px-2 py-1 text-[10px] font-medium",
            stageClass(activity.stage),
          )}
        >
          {stageLabels[activity.stage]}
        </span>
      </td>
      <td className="px-3 py-3">
        <Link
          to="/comercial/contatos/$leadId"
          params={{ leadId: activity.leadId }}
          aria-label={`Ver ${activity.company}`}
          title="Ver detalhes"
          className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent"
        >
          <Eye className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function mapActivity(row: CompanyLead): CommercialActivity {
  const stage = row.stage;
  const score = Number(row.relevance_score || 0);
  return {
    id: String(row.id),
    leadId: String(row.id),
    type:
      stage === "negocio_fechado"
        ? "conclusao"
        : stage === "demonstracao"
          ? "demonstracao"
          : stage === "prospeccao"
            ? "ligacao"
            : "acompanhamento",
    date: row.discovered_at || new Date().toISOString(),
    returnAt: null,
    company: String(row.trade_name || row.legal_name || "Empresa não informada"),
    profile: [row.cnae_description, row.company_size ? `Porte: ${row.company_size}` : ""]
      .filter(Boolean)
      .join(" · "),
    note: row.notes || `Etapa comercial: ${stageLabels[stage]}.`,
    city: String(row.city || "Não informada"),
    state: String(row.state || ""),
    stage,
    operator: row.assigned_to || "Não informado",
    priority: score >= 8 ? "alta" : score >= 5 ? "media" : "baixa",
  };
}

const emptyLeadFilters = {
  city: "",
  state: "",
  openedWithinDays: 0,
  cnae: "",
  companySize: "",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function stageClass(stage: CompanyLeadStage) {
  if (stage === "negocio_fechado")
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (stage === "sem_interesse") return "bg-destructive/10 text-destructive";
  if (stage === "demonstracao" || stage === "proposta") return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}
const selectClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
