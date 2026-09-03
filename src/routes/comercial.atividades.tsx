import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Check, Mail, MapPin, Phone, Search, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { ListPaginationFooter } from "@/components/portal/ListPaginationFooter";
import { DateRangeFilter } from "@/components/portal/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/comercial/atividades")({
  component: CommercialActivitiesPage,
});

const PAGE_SIZE = 25;
type ActivityType = "conclusao" | "ligacao" | "demonstracao" | "acompanhamento";
type CommercialActivity = {
  id: string;
  contactId: string;
  type: ActivityType;
  historyType: string;
  date: string;
  returnAt: string | null;
  company: string;
  subject: string;
  note: string;
  city: string;
  state: string;
  status: string;
  operator: string;
  priority: "alta" | "media" | "baixa";
};

function CommercialActivitiesPage() {
  const [activities, setActivities] = useState<CommercialActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [substatus, setSubstatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc(
          "commercial_activities_list" as never,
          {
            p_search: search.trim(),
            p_status: status,
            p_history_type: substatus,
            p_from: from || null,
            p_to: to || null,
            p_limit: PAGE_SIZE,
            p_offset: page * PAGE_SIZE,
          } as never,
        );
        if (error) throw error;
        if (!active) return;
        const result = (data || {}) as { rows?: Array<Record<string, unknown>>; total?: number };
        setActivities((result.rows || []).map(mapHistoryActivity));
        setTotal(Number(result.total || 0));
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
  }, [from, page, search, status, substatus, to]);

  useEffect(() => setPage(0), [from, search, status, substatus, to]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = activities;
  return (
    <AppShell fullWidth>
      <PageHeader
        title="Atividades"
        description="Histórico e acompanhamento das atividades da equipe comercial."
        breadcrumbs={[{ label: "Comercial" }, { label: "Atividades" }]}
      />

      <section className="mb-5 grid gap-3 xl:grid-cols-[minmax(190px,300px)_180px_170px_220px_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisa geral"
            className="h-9 rounded-lg pl-9 text-[13px]"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos os status</option>
          <option value="5">Em acompanhamento</option>
          <option value="30">Visita/Demonstração</option>
        </select>
        <select
          value={substatus}
          onChange={(event) => setSubstatus(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos os tipos</option>
          <option value="1">Ligação</option>
          <option value="2">E-mail</option>
          <option value="3">Visita</option>
          <option value="7">Reunião</option>
        </select>
        <DateRangeFilter
          from={from}
          to={to}
          onChange={(start, end) => {
            setFrom(start);
            setTo(end);
          }}
        />
        <Button className="h-9 rounded-lg text-[13px]" onClick={() => setPage(0)}>
          Buscar
        </Button>
      </section>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto xl:overflow-x-hidden">
          <table className="w-full min-w-[820px] table-fixed text-left text-[13px] text-foreground xl:min-w-0">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[5%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[19%]" />
              <col className="w-[32%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="border-b bg-muted/35 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-normal">P</th>
                <th className="px-3 py-3 font-normal">Tipo</th>
                <th className="px-3 py-3 font-normal">Datas</th>
                <th className="px-3 py-3 font-normal">Retorno</th>
                <th className="px-3 py-3 font-normal">Nome</th>
                <th className="px-3 py-3 font-normal">Observação</th>
                <th className="px-3 py-3 font-normal">Cidade / UF</th>
                <th className="px-3 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="h-52 text-center text-muted-foreground">
                    Carregando atividades...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-52 text-center text-muted-foreground">
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
        <ListPaginationFooter
          page={page}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          total={total}
          noun="atividades"
          onPageChange={setPage}
        />
      </div>
    </AppShell>
  );
}

function ActivityRow({ activity }: { activity: CommercialActivity }) {
  const TypeIcon =
    activity.historyType === "2"
      ? Mail
      : activity.historyType === "3"
        ? MapPin
        : activity.historyType === "7"
          ? UsersRound
          : activity.type === "conclusao"
            ? Check
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
        <span className="block truncate font-normal" title={activity.company}>
          {activity.company}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">{activity.subject}</span>
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
            statusClass(activity.status),
          )}
        >
          {statusLabel(activity.status)}
        </span>
      </td>
    </tr>
  );
}

function mapHistoryActivity(row: Record<string, unknown>): CommercialActivity {
  const rawType = String(row.history_type || "");
  return {
    id: String(row.id),
    contactId: String(row.contact_id || ""),
    type: rawType === "3" ? "demonstracao" : rawType === "1" ? "ligacao" : "acompanhamento",
    historyType: rawType,
    date: String(row.crm_created_at || ""),
    returnAt: row.return_date ? String(row.return_date) : null,
    company: String(row.company || `Contato #${row.contact_id || ""}`),
    subject: String(row.subject || typeLabel(rawType)),
    note: plainHistoryText(String(row.observation_html || "Sem observação")),
    city: String(row.city || "Não informada"),
    state: String(row.state || ""),
    status: String(row.status_code || ""),
    operator: String(row.operator_code || "Não informado"),
    priority: rawType === "3" || rawType === "7" ? "alta" : rawType === "2" ? "media" : "baixa",
  };
}

function plainHistoryText(value: string) {
  const node = typeof document !== "undefined" ? document.createElement("div") : null;
  if (!node)
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  node.innerHTML = value;
  return (node.textContent || "").replace(/\s+/g, " ").trim();
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function typeLabel(type: string) {
  return (
    ({ "1": "Ligação", "2": "E-mail", "3": "Visita", "7": "Reunião" } as Record<string, string>)[
      type
    ] || `Atividade ${type || "comercial"}`
  );
}
function statusLabel(status: string) {
  return (
    ({ "5": "Em acompanhamento", "30": "Visita/Demonstração" } as Record<string, string>)[status] ||
    `Status ${status || "não informado"}`
  );
}
function statusClass(status: string) {
  return status === "30" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
}
const selectClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring";
