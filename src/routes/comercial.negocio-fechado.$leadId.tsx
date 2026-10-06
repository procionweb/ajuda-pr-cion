import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, CheckCircle, FileText, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { RegistrationSummary } from "@/components/portal/RegistrationSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePortalAuth } from "@/lib/portal-auth";
import { companyLeadsApi } from "@/lib/company-leads-api";
import {
  buildCloseDealForm,
  formatFiscalField,
  taxRegimeOptions,
  closeDealCompanyFields,
  closeDealContactFields,
  closeDealResponsibleFields,
  closeDealHadronFields,
} from "@/lib/close-deal-form";

export const Route = createFileRoute("/comercial/negocio-fechado/$leadId")({
  component: CloseDealPage,
});
const requiredFields = new Set(["nickname", "cnpj", "legal_name", "city", "state"]);
function CloseDealPage() {
  const { leadId } = Route.useParams();
  const navigate = useNavigate();
  const { operator } = usePortalAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [fiscalReference, setFiscalReference] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    companyLeadsApi
      .details(leadId)
      .then((lead) => {
        if (active) {
          setForm(
            Object.fromEntries(
              Object.entries(buildCloseDealForm(lead)).map(([key, value]) => [
                key,
                formatFiscalField(key, value),
              ]),
            ),
          );
          setFiscalReference(
            lead.tax_regime_year
              ? `Referência do regime: ${lead.tax_regime_year}. Confirme o regime atual.`
              : "",
          );
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          toast.error("Não foi possível carregar os dados do contato.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [leadId]);
  async function lookupFiscalData() {
    const cnpj = (form.cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14) {
      toast.error("Informe o CNPJ completo para consultar.");
      return;
    }
    setLookingUp(true);
    try {
      const response = await fetch(`https://minhareceita.org/${cnpj}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Consulta indisponível");
      const data = await response.json();
      const regime =
        data.opcao_pelo_mei === true
          ? "MEI"
          : data.opcao_pelo_simples === true
            ? "Simples Nacional"
            : "";
      setForm((previous) => {
        if ((previous.cnpj || "").replace(/\D/g, "") !== cnpj) return previous;
        return {
          ...previous,
          cnae: previous.cnae || formatFiscalField("cnae", String(data.cnae_fiscal || "")),
          tax_regime: previous.tax_regime || regime,
        };
      });
      toast.success("Consulta concluída. Os campos preenchidos foram preservados.");
      if (!regime)
        setFiscalReference("A API não confirmou o regime atual. Confira e selecione manualmente.");
    } catch {
      toast.error("Não foi possível consultar o CNPJ. Tente novamente ou preencha manualmente.");
    } finally {
      setLookingUp(false);
    }
  }
  async function save(finalize: boolean) {
    if (saving) return;
    if (finalize && [...requiredFields].some((key) => !form[key]?.trim())) {
      toast.error("Preencha nome, CNPJ, razão social, cidade e UF para finalizar.");
      return;
    }
    if (form.cnpj && form.cnpj.replace(/\D/g, "").length !== 14) {
      toast.error("Preencha o CNPJ completo, com 14 dígitos.");
      return;
    }
    for (const key of ["email", "admin_email", "accountant_email"])
      if (form[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form[key])) {
        toast.error("Confira os e-mails informados.");
        return;
      }
    for (const key of ["phone", "accountant_phone"])
      if (form[key] && ![10, 11].includes(form[key].replace(/\D/g, "").length)) {
        toast.error("Informe telefones completos, com DDD.");
        return;
      }
    if (form.cnae && form.cnae.replace(/\D/g, "").length !== 7) {
      toast.error("Informe o CNAE completo, com 7 dígitos (ex.: 4751-2/01).");
      return;
    }
    setSaving(true);
    try {
      await companyLeadsApi.saveAction(leadId, "close_deal", form, finalize, operator || "PRCREN");
      toast.success(finalize ? "Negócio fechado com sucesso." : "Rascunho do negócio salvo.");
      if (finalize) await navigate({ to: "/comercial/contatos/$leadId", params: { leadId } });
    } catch {
      toast.error("Não foi possível salvar o negócio. Os dados preenchidos foram mantidos.");
    } finally {
      setSaving(false);
    }
  }
  const sections = [
    { title: "Cliente e empresa", icon: Building2, fields: closeDealCompanyFields },
    { title: "Endereço e contatos", icon: MapPin, fields: closeDealContactFields },
    { title: "Responsável e contabilidade", icon: UserRound, fields: closeDealResponsibleFields },
    { title: "Implantação do Hádron", icon: FileText, fields: closeDealHadronFields },
  ];
  return (
    <AppShell fullWidth>
      <PageHeader
        title="Negócio fechado"
        description="Confira os dados do contato e complete as informações para finalizar o negócio."
        breadcrumbs={[{ label: "Comercial" }, { label: "Contatos" }, { label: "Negócio fechado" }]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/comercial/contatos/$leadId" params={{ leadId }}>
              Voltar para o contato
            </Link>
          </Button>
        }
      />
      {loading ? (
        <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
          Carregando dados do contato...
        </div>
      ) : failed ? (
        <div className="rounded-2xl border bg-card p-8 text-sm">
          Não foi possível carregar o contato. Volte ao contato e tente novamente.
        </div>
      ) : (
        <form
          className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
          onSubmit={(event) => {
            event.preventDefault();
            void save(true);
          }}
          style={{ overflowAnchor: "none" }}
        >
          <div className="min-w-0 space-y-5">
            {sections.map(({ title, icon: Icon, fields }) => (
              <section key={title} className="rounded-2xl border bg-card p-5">
                <h2 className="flex items-center gap-3 text-base font-medium">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  {title}
                </h2>
                {title === "Cliente e empresa" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    disabled={lookingUp}
                    onClick={() => void lookupFiscalData()}
                  >
                    {lookingUp ? "Consultando..." : "Consultar CNAE e Simples pelo CNPJ"}
                  </Button>
                )}
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {fields.map(([label, key]) => (
                    <div key={key}>
                      <Label htmlFor={`deal-${key}`} className="text-xs font-medium">
                        {label}
                        {requiredFields.has(key) && <span className="text-destructive"> *</span>}
                      </Label>
                      {key === "tax_regime" ? (
                        <select
                          id={`deal-${key}`}
                          className="mt-1 h-11 w-full cursor-pointer rounded-xl border bg-background px-3 text-sm"
                          value={form[key] || ""}
                          onChange={(event) =>
                            setForm((previous) => ({ ...previous, [key]: event.target.value }))
                          }
                        >
                          <option value="">Selecione o regime</option>
                          {form[key] && !taxRegimeOptions.includes(form[key]) && (
                            <option value={form[key]}>{form[key]}</option>
                          )}
                          {taxRegimeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          id={`deal-${key}`}
                          className="mt-1 h-11 rounded-xl text-sm"
                          value={form[key] || ""}
                          placeholder={
                            key === "cnae"
                              ? "4751-2/01"
                              : key === "antt"
                                ? "Número do RNTRC"
                                : undefined
                          }
                          inputMode={key === "cnae" || key === "antt" ? "numeric" : undefined}
                          type={key.includes("email") ? "email" : "text"}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              [key]:
                                key === "acronym" ||
                                key === "group_acronym" ||
                                key === "state" ||
                                key === "responsible_state"
                                  ? event.target.value.toUpperCase()
                                  : formatFiscalField(key, event.target.value),
                            }))
                          }
                        />
                      )}
                      {key === "state_registration" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Formato conforme a UF; aceita ISENTO.
                        </p>
                      )}
                      {key === "city_registration" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Número conforme o cadastro municipal.
                        </p>
                      )}
                      {key === "tax_regime" && fiscalReference && (
                        <p className="mt-1 text-xs text-muted-foreground">{fiscalReference}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <section className="rounded-2xl border bg-card p-5">
              <Label htmlFor="deal-notes" className="text-xs">
                Observação
              </Label>
              <Textarea
                id="deal-notes"
                className="mt-2 rounded-xl text-sm"
                value={form.notes || ""}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, notes: event.target.value }))
                }
              />
            </section>
            <p className="text-xs text-muted-foreground">
              Os campos com * são necessários para finalizar. Você pode salvar um rascunho para
              completar depois.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/comercial/contatos/$leadId" params={{ leadId }}>
                  Voltar
                </Link>
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void save(false)}
              >
                Salvar rascunho
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle className="mr-2 size-4" />
                {saving ? "Salvando..." : "Salvar e finalizar"}
              </Button>
            </div>
          </div>
          <RegistrationSummary
            title={form.nickname || form.trade_name || "Nome do cliente"}
            subtitle={[form.acronym, form.legal_name].filter(Boolean).join(" · ")}
            items={[
              { label: "CNPJ", value: form.cnpj, icon: Building2 },
              {
                label: "Cidade / UF",
                value: [form.city, form.state].filter(Boolean).join(" / "),
                icon: MapPin,
              },
              {
                label: "Responsável",
                value: form.responsible_name || form.admin_name,
                icon: UserRound,
              },
              { label: "E-mail", value: form.admin_email || form.email, icon: Mail },
              { label: "Telefone", value: form.phone, icon: Phone },
              { label: "Contador", value: form.accountant_name, icon: UserRound },
              { label: "Terminais", value: form.terminals, icon: Building2 },
              { label: "Módulos", value: form.modules, icon: FileText },
            ]}
            note="Salvar rascunho mantém a etapa atual. Salvar e finalizar registra o negócio como fechado."
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600">
              <CheckCircle className="size-3.5" />
              Negócio fechado
            </span>
          </RegistrationSummary>
        </form>
      )}
    </AppShell>
  );
}
