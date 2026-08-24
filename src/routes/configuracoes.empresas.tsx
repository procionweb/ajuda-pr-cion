import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, ChevronLeft, ChevronRight, Eye, RefreshCw, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes/empresas")({
  head: () => ({ meta: [{ title: "Empresas - Configurações - Portal Prócion" }] }),
  component: CompaniesSettingsPage,
});

type CompanyRow = {
  id: string;
  legacy_key: string;
  client_id: string;
  client_acronym: string | null;
  company_number: number | null;
  legal_name: string | null;
  trade_name: string | null;
  document: string | null;
  state_registration: string | null;
  municipal_registration: string | null;
  cnae: string | null;
  industry: string | null;
  size: string | null;
  tax_regime: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  responsible_name: string | null;
  accountant_name: string | null;
  accountant_phone: string | null;
  accountant_email: string | null;
  active: boolean;
  updated_at: string | null;
};

const PAGE_SIZE = 25;

function digits(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function formatCnpj(value: string | null) {
  const raw = digits(value);
  if (raw.length !== 14) return value || "Não informado";
  return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCep(value: string | null) {
  const raw = digits(value);
  if (raw.length !== 8) return value || "";
  return raw.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function display(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "Não informado" : String(value);
}

function CompaniesSettingsPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CompanyRow | null>(null);

  async function loadCompanies() {
    setLoading(true);
    setError(null);
    // Imported CRM tables are not represented in the generated Supabase types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: requestError } = await (supabase as any).rpc(
      "configuration_companies_list",
    );
    if (requestError) {
      setError(requestError.message);
      setCompanies([]);
    } else {
      setCompanies((Array.isArray(data) ? data : []) as CompanyRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadCompanies();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const numericTerm = digits(query);
    if (!term) return companies;
    return companies.filter((company) => {
      const textMatch = [
        company.client_acronym,
        company.legal_name,
        company.trade_name,
        company.responsible_name,
        company.city,
        company.state,
        company.address,
      ].some((value) => (value ?? "").toLocaleLowerCase("pt-BR").includes(term));
      return textMatch || Boolean(numericTerm && digits(company.document).includes(numericTerm));
    });
  }, [companies, query]);

  useEffect(() => setPage(0), [query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Empresas"
        description="Empresas e filiais importadas do cadastro de clientes."
        breadcrumbs={[{ label: "Configurações" }, { label: "Empresas" }]}
      />

      <section className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar por CNPJ, razão social, responsável, cidade ou sigla"
            className="h-10 pl-9"
          />
        </label>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => void loadCompanies()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </section>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[23%]" />
              <col className="w-[17%]" />
              <col className="w-[14%]" />
              <col className="w-[26%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead className="border-b bg-muted/35 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">CNPJ</th>
                <th className="px-4 py-3 font-medium">Razão social</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Cidade/UF</th>
                <th className="px-4 py-3 font-medium">Endereço</th>
                <th className="px-4 py-3 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="h-56 text-center text-muted-foreground">
                    Carregando empresas...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="h-56 px-6 text-center text-destructive">
                    Não foi possível carregar as empresas: {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-56 text-center text-muted-foreground">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              ) : (
                rows.map((company) => (
                  <tr key={company.id} className="transition-colors hover:bg-muted/25">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {formatCnpj(company.document)}
                    </td>
                    <td className="px-4 py-3">
                      <p
                        className="truncate font-medium text-foreground"
                        title={company.legal_name ?? undefined}
                      >
                        {display(company.legal_name)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {company.client_acronym || "Sem sigla"}
                        {company.company_number
                          ? ` · Empresa ${String(company.company_number).padStart(3, "0")}`
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate" title={company.responsible_name ?? undefined}>
                        {display(company.responsible_name)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {company.city || "Não informada"}
                      {company.state ? `/${company.state}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate" title={company.address ?? undefined}>
                        {display(company.address)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Visualizar ${company.legal_name || "empresa"}`}
                        onClick={() => setSelected(company)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Página {safePage + 1} de {pageCount}, mostrando {rows.length} de {filtered.length}{" "}
            {filtered.length === 1 ? "empresa" : "empresas"}.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima página"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <CompanyDetailsDialog
        company={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </AppShell>
  );
}

function CompanyDetailsDialog({
  company,
  onOpenChange,
}: {
  company: CompanyRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const fields = company
    ? [
        ["CNPJ", formatCnpj(company.document)],
        ["Razão social", display(company.legal_name)],
        ["Nome fantasia", display(company.trade_name)],
        ["Cliente / sigla", display(company.client_acronym)],
        ["Número da empresa", display(company.company_number)],
        ["Responsável", display(company.responsible_name)],
        ["Cidade / UF", `${display(company.city)}${company.state ? `/${company.state}` : ""}`],
        ["Endereço", display(company.address)],
        ["CEP", formatCep(company.postal_code) || "Não informado"],
        ["Inscrição estadual", display(company.state_registration)],
        ["Inscrição municipal", display(company.municipal_registration)],
        ["CNAE", display(company.cnae)],
        ["Setor", display(company.industry)],
        ["Porte", display(company.size)],
        ["Regime tributário", display(company.tax_regime)],
        ["Contador", display(company.accountant_name)],
        ["Telefone do contador", display(company.accountant_phone)],
        ["E-mail do contador", display(company.accountant_email)],
      ]
    : [];

  return (
    <Dialog open={Boolean(company)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">
                {company?.legal_name || "Detalhes da empresa"}
              </DialogTitle>
              <DialogDescription>
                Dados importados do cadastro de empresas do CRM.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <dl className="mt-2 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div
              key={label}
              className={cn("min-w-0 border-b pb-3", label === "Endereço" && "sm:col-span-2")}
            >
              <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
