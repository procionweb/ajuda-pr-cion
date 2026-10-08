import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, Mail, MapPin, Phone, FileText } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { RegistrationSummary } from "@/components/portal/RegistrationSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePortalAuth } from "@/lib/portal-auth";
import { companyLeadsApi, type CompanyLeadDetails } from "@/lib/company-leads-api";

export const Route = createFileRoute("/comercial/editar-contato/$leadId")({
  component: EditCommercialContact,
});
const stages = [
  { value: "novo", label: "Novo" },
  { value: "prospeccao", label: "Prospecção" },
  { value: "relacionamento", label: "Relacionamento" },
  { value: "proposta", label: "Proposta" },
  { value: "negociacao", label: "Negociação" },
  { value: "demonstracao", label: "Demonstração" },
  { value: "negocio_fechado", label: "Negócio fechado" },
  { value: "sem_interesse", label: "Sem interesse" },
];
const branches = [
  "Sem Identificação",
  "Comércio",
  "Cooperativa",
  "Transportadora",
  "Indústria",
  "Serviços",
  "Escritórios",
  "Engenharias",
  "Agropecuárias",
  "Produtor Rural",
  "Distribuidora",
  "Outros",
];
function EditCommercialContact() {
  const { leadId } = Route.useParams();
  const { operator } = usePortalAuth();
  const navigate = useNavigate();
  const [lead, setLead] = useState<CompanyLeadDetails | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    companyLeadsApi
      .details(leadId)
      .then((data) => {
        if (!active) return;
        const c = data.commercial_data || {};
        setLead(data);
        const priority = String(c.priority || "media")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        setForm({
          name: String(c.name ?? data.trade_name ?? data.legal_name),
          acronym: String(c.acronym ?? ""),
          trade_name: String(c.trade_name ?? data.trade_name ?? ""),
          stage: data.stage,
          priority: ["baixa", "media", "alta"].includes(priority) ? priority : "media",
          phone: String(c.phone ?? data.phone ?? ""),
          email: String(c.email ?? data.email ?? ""),
          website: String(c.website ?? data.website ?? ""),
          branch: String(c.branch ?? c.sector ?? ""),
          company_size: String(c.company_size ?? data.company_size ?? ""),
          terminals: String(c.terminals ?? ""),
          postal_code: String(c.postal_code ?? data.postal_code ?? ""),
          address: String(c.address ?? data.address ?? ""),
          address_number: String(c.address_number ?? c.number ?? ""),
          address_complement: String(c.address_complement ?? c.complement ?? ""),
          neighborhood: String(c.neighborhood ?? data.neighborhood ?? ""),
          city: String(c.city ?? data.city ?? ""),
          state: String(c.state ?? data.state ?? ""),
          activities: String(c.activities ?? data.notes ?? ""),
          notes: String(c.notes ?? ""),
          first_contact_at: String(c.first_contact_at ?? ""),
          calls_count: String(c.calls_count ?? 0),
          emails_count: String(c.emails_count ?? 0),
          requests_count: String(c.requests_count ?? 0),
        });
      })
      .catch(() => {
        if (active) toast.error("Não foi possível carregar o contato.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [leadId]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (
      ["calls_count", "emails_count", "requests_count"].some(
        (key) => !/^\d+$/.test(form[key] || ""),
      )
    ) {
      toast.error("Informe quantidades inteiras iguais ou maiores que zero.");
      return;
    }
    if (form.phone && ![10, 11].includes(form.phone.replace(/\D/g, "").length)) {
      toast.error("Informe o telefone completo, com DDD.");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSaving(true);
    try {
      await companyLeadsApi.saveAction(
        leadId,
        "edit",
        {
          ...form,
          sector: form.branch,
          number: form.address_number,
          complement: form.address_complement,
          website: form.website.trim()
            ? /^https?:\/\//i.test(form.website.trim())
              ? form.website.trim()
              : `https://${form.website.trim()}`
            : "",
        },
        false,
        operator || "PRCREN",
      );
      toast.success("Dados comerciais atualizados.");
      await navigate({ to: "/comercial/contatos/$leadId", params: { leadId } });
    } catch {
      toast.error("Não foi possível salvar. Os dados preenchidos foram mantidos.");
    } finally {
      setSaving(false);
    }
  }
  const field = (key: string, label: string) => (
    <div key={key}>
      <Label htmlFor={`edit-${key}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`edit-${key}`}
        className="mt-1 h-11 rounded-xl text-sm"
        type={
          key === "email"
            ? "email"
            : key === "first_contact_at"
              ? "datetime-local"
              : key.endsWith("_count")
                ? "number"
                : "text"
        }
        min={key.endsWith("_count") ? 0 : undefined}
        step={key.endsWith("_count") ? 1 : undefined}
        value={form[key] || ""}
        onChange={(e) =>
          setForm((previous) => ({
            ...previous,
            [key]:
              key === "acronym" || key === "state" ? e.target.value.toUpperCase() : e.target.value,
          }))
        }
      />
    </div>
  );
  const select = (key: string, label: string, options: Array<{ value: string; label: string }>) => (
    <div>
      <Label htmlFor={`edit-${key}`} className="text-xs">
        {label} {key !== "branch" && <span className="text-destructive">*</span>}
      </Label>
      <select
        required={key !== "branch"}
        id={`edit-${key}`}
        className="mt-1 h-11 w-full cursor-pointer rounded-xl border bg-background px-3 text-sm"
        value={form[key] || ""}
        onChange={(e) => setForm((previous) => ({ ...previous, [key]: e.target.value }))}
      >
        {!options.some((o) => o.value === form[key]) && (
          <option value={form[key] || ""}>{form[key] || "Selecione"}</option>
        )}
        {options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <AppShell fullWidth>
      <PageHeader
        title="Editar contato comercial"
        description="Confira os dados preenchidos e atualize as informações comerciais."
        breadcrumbs={[{ label: "Comercial" }, { label: "Contatos" }, { label: "Editar" }]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/comercial/contatos/$leadId" params={{ leadId }}>
              Voltar para o contato
            </Link>
          </Button>
        }
      />
      {loading ? (
        <p className="p-8 text-sm text-muted-foreground">Carregando dados do contato...</p>
      ) : !lead ? (
        <p className="p-8 text-sm">Não foi possível carregar o contato. Volte e tente novamente.</p>
      ) : (
        <form
          onSubmit={save}
          className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
        >
          <div className="min-w-0 space-y-5">
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 flex items-center gap-3 text-base font-medium">
                <Building2 className="size-5 text-primary" />
                Empresa e acompanhamento
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {field("name", "Nome")}
                {field("trade_name", "Nome fantasia")}
                {field("acronym", "Sigla")}
                {select("stage", "Etapa", stages)}
                {select("priority", "Prioridade", [
                  { value: "baixa", label: "Baixa" },
                  { value: "media", label: "Média" },
                  { value: "alta", label: "Alta" },
                ])}
                {select(
                  "branch",
                  "Ramo",
                  branches.map((value) => ({ value, label: value })),
                )}
                {field("company_size", "Porte")}
                {field("terminals", "Terminais")}
                {field("website", "Site")}
              </div>
              <div className="mt-4 grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ</p>
                  <p className="mt-1 text-sm">{lead.cnpj || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Razão social</p>
                  <p className="mt-1 text-sm">{lead.legal_name}</p>
                </div>
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 flex items-center gap-3 text-base font-medium">
                <MapPin className="size-5 text-primary" />
                Endereço e contatos
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  ["postal_code", "CEP"],
                  ["address", "Endereço"],
                  ["address_number", "Número"],
                  ["address_complement", "Complemento"],
                  ["neighborhood", "Bairro"],
                  ["city", "Cidade"],
                  ["state", "UF"],
                  ["phone", "Telefone"],
                  ["email", "E-mail"],
                ].map(([key, label]) => field(key, label))}
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 flex items-center gap-3 text-base font-medium">
                <Phone className="size-5 text-primary" />
                Acompanhamento do contato
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {field("first_contact_at", "Primeiro contato")}
                {field("calls_count", "Quantidade de ligações")}
                {field("emails_count", "Quantidade de e-mails")}
                {field("requests_count", "Quantidade de solicitações")}
              </div>
            </section>
            <section className="space-y-4 rounded-2xl border bg-card p-5">
              {[
                ["activities", "Atividades"],
                ["notes", "Observações"],
              ].map(([key, label]) => (
                <div key={key}>
                  <Label htmlFor={`edit-${key}`} className="text-xs">
                    {label}
                  </Label>
                  <Textarea
                    id={`edit-${key}`}
                    className="mt-1 rounded-xl text-sm"
                    value={form[key] || ""}
                    onChange={(e) =>
                      setForm((previous) => ({ ...previous, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </section>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/comercial/contatos/$leadId" params={{ leadId }}>
                  Cancelar
                </Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
          <div className="hidden xl:block">
          <RegistrationSummary
            title={form.name || form.trade_name || lead.legal_name}
            subtitle={lead.legal_name}
            items={[
              { label: "Sigla", value: form.acronym, icon: Building2 },
              {
                label: "Etapa",
                value: stages.find((s) => s.value === form.stage)?.label || "",
                icon: FileText,
              },
              { label: "Telefone", value: form.phone, icon: Phone },
              { label: "E-mail", value: form.email, icon: Mail },
              {
                label: "Cidade / UF",
                value: [form.city, form.state].filter(Boolean).join(" / "),
                icon: MapPin,
              },
              { label: "Ramo", value: form.branch, icon: Building2 },
            ]}
            note="As alterações comerciais serão aplicadas após salvar."
          />
          </div>
        </form>
      )}
    </AppShell>
  );
}
