import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MapPinned,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  companyLeadsApi,
  type CompanyLead,
  type CompanyLeadDetails,
  type CompanyLeadStage,
} from "@/lib/company-leads-api";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/comercial/contatos")({ component: CommercialContactsRoute });

const PAGE_SIZE = 25;
const leadColumns =
  "id,cnpj,legal_name,trade_name,opened_at,registration_status,cnae_code,cnae_description,company_size,legal_nature,city,state,address,neighborhood,postal_code,relevance_score,stage,source,source_url,discovered_at,raw_payload";
const stages: Array<{ value: CompanyLeadStage; label: string }> = [
  { value: "prospeccao", label: "Prospecção" },
  { value: "relacionamento", label: "Relacionamento" },
  { value: "proposta", label: "Proposta" },
  { value: "negociacao", label: "Negociação" },
  { value: "demonstracao", label: "Demonstração" },
  { value: "negocio_fechado", label: "Negócio fechado" },
  { value: "sem_interesse", label: "Sem interesse" },
];
const visibleStages = stages.filter((item) => item.value !== "sem_interesse");

const googleMapsAddressUrl = (lead: CompanyLead) => {
  const address = [lead.address, lead.neighborhood, lead.city, lead.state, lead.postal_code]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

function CommercialContactsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/comercial/contatos" && pathname.startsWith("/comercial/contatos/")) {
    return <Outlet />;
  }

  return <CommercialContactsPage />;
}

function CommercialContactsPage() {
  const [rows, setRows] = useState<CompanyLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selected, setSelected] = useState<CompanyLeadDetails | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      let query = supabase
        .from("company_leads")
        .select(leadColumns)
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
      query = stage
        ? query.eq("stage", stage)
        : query.in(
            "stage",
            visibleStages.map((item) => item.value),
          );
      if (city) query = query.eq("city", city);
      const term = search.trim().replace(/[,%()]/g, " ");
      if (term)
        query = query.or(
          `legal_name.ilike.%${term}%,trade_name.ilike.%${term}%,cnpj.ilike.%${term}%,city.ilike.%${term}%`,
        );
      const { data, error } = await query;
      if (!active) return;
      if (error) {
        toast.error("Não foi possível carregar os contatos comerciais.");
        setRows([]);
        setHasNextPage(false);
      } else {
        const mapped = (data || []).map((row) => mapLeadRow(row));
        setHasNextPage(mapped.length > PAGE_SIZE);
        setRows(mapped.slice(0, PAGE_SIZE));
      }
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [city, page, search, stage]);

  useEffect(() => setPage(0), [city, search, stage]);

  useEffect(() => {
    void supabase
      .rpc("company_lead_cities" as never)
      .then(({ data }) => setCities(Array.isArray(data) ? data.map(String) : []));
  }, []);

  async function changeStage(lead: CompanyLead, next: CompanyLeadStage) {
    try {
      await companyLeadsApi.updateStage(lead.id, next);
      setRows((current) => {
        if (next === "sem_interesse") return current.filter((row) => row.id !== lead.id);
        return current.map((row) => (row.id === lead.id ? { ...row, stage: next } : row));
      });
      toast.success("Etapa comercial atualizada.");
    } catch {
      toast.error("Não foi possível atualizar a etapa.");
    }
  }

  const clearFilters = () => {
    setSearch("");
    setCity("");
    setStage("");
    setPage(0);
  };

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Contatos comerciais"
        description="Prospecção, relacionamento e acompanhamento das oportunidades comerciais."
        breadcrumbs={[{ label: "Comercial" }, { label: "Contatos" }]}
      />

      <section className="mb-5 grid gap-3 md:grid-cols-[minmax(240px,360px)_220px_220px_auto]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Empresa, CNPJ, telefone ou e-mail"
            className="h-11 pl-10"
          />
        </label>
        <select
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as cidades</option>
          {cities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as etapas</option>
          {visibleStages.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <Button variant="outline" className="h-11 gap-2" onClick={clearFilters}>
          <RotateCcw className="h-4 w-4" />
          Limpar filtros
        </Button>
      </section>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] table-fixed text-left text-xs xl:min-w-0">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[13%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead className="border-b bg-muted/35 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Contato</th>
                <th className="px-5 py-3 font-medium">Cidade / UF</th>
                <th className="px-5 py-3 font-medium">Atividade</th>
                <th className="px-5 py-3 font-medium">Etapa</th>
                <th className="w-16 px-5 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="h-52 text-center text-muted-foreground">
                    Carregando contatos...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-52 text-center text-muted-foreground">
                    Nenhum contato comercial encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((lead) => (
                  <tr key={lead.id} className="transition-colors hover:bg-muted/25">
                    <td className="min-w-0 px-4 py-3">
                      <Link
                        to="/comercial/contatos/$leadId"
                        params={{ leadId: lead.id }}
                        className="block w-full min-w-0 text-left hover:text-primary group"
                      >
                        <span
                          className="block truncate text-[13px] font-medium group-hover:underline"
                          title={lead.trade_name || lead.legal_name}
                        >
                          {lead.trade_name || lead.legal_name}
                        </span>
                        <span
                          className="mt-0.5 block truncate text-[11px] text-muted-foreground"
                          title={`${lead.legal_name} · ${lead.cnpj}`}
                        >
                          {lead.legal_name} · {lead.cnpj}
                        </span>
                      </Link>
                    </td>
                    <td className="min-w-0 px-4 py-3 text-[12px] text-muted-foreground">
                      {lead.phone && (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate" title={lead.phone}>
                            {lead.phone}
                          </span>
                        </span>
                      )}
                      {lead.email && (
                        <span className="mt-1 flex min-w-0 items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate" title={lead.email}>
                            {lead.email}
                          </span>
                        </span>
                      )}
                      {!lead.phone && !lead.email && "Não informado"}
                    </td>
                    <td className="min-w-0 px-4 py-3">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate" title={`${lead.city} - ${lead.state}`}>
                          {lead.city} - {lead.state}
                        </span>
                      </span>
                    </td>
                    <td className="min-w-0 px-4 py-3">
                      <span
                        className="block truncate text-[12px]"
                        title={lead.cnae_description || "Não informada"}
                      >
                        {lead.cnae_description || "Não informada"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{lead.cnae_code}</span>
                    </td>
                    <td className="px-5 py-3 text-[12px]">
                      {stages.find((item) => item.value === lead.stage)?.label || lead.stage}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          to="/comercial/contatos/$leadId"
                          params={{ leadId: lead.id }}
                          title="Ver detalhes"
                          aria-label={`Ver detalhes de ${lead.trade_name || lead.legal_name}`}
                          className="grid h-9 w-9 cursor-pointer place-items-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <a
                          href={googleMapsAddressUrl(lead)}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir endereço no Google Maps"
                          aria-label={`Abrir endereço de ${lead.trade_name || lead.legal_name} no Google Maps`}
                          className="grid h-9 w-9 cursor-pointer place-items-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <MapPinned className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground">
          <span>
            {rows.length
              ? `Mostrando ${page * PAGE_SIZE + 1} a ${page * PAGE_SIZE + rows.length}`
              : "Nenhum contato"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {page + 1}</span>
            <Button
              variant="outline"
              size="icon"
              disabled={!hasNextPage}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function mapLeadRow(row: Record<string, unknown>): CompanyLead {
  const payload = (row.raw_payload || {}) as Record<string, unknown>;
  return {
    ...(row as unknown as CompanyLead),
    phone: typeof payload.phone === "string" ? payload.phone : null,
    email: typeof payload.email === "string" ? payload.email : null,
    mei: payload.mei === true,
    simples: payload.simple === true,
    tax_regime: typeof payload.tax_regime === "string" ? payload.tax_regime : null,
  };
}
