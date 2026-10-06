import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUp,
  Building2,
  ChevronDown,
  Globe,
  Mail,
  MapPin,
  Minus,
  Phone,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { RegistrationSummary } from "@/components/portal/RegistrationSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comercial/contatos/novo")({
  component: CreateCommercialCompany,
});
const initialForm = {
  cnpj: "",
  name: "",
  size: "",
  acronym: "",
  legal_name: "",
  trade_name: "",
  sector: "",
  postal_code: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
  number: "",
  complement: "",
  terminals: "",
  companies: "",
  website: "",
  priority: "Média",
  activities: "",
};
type Contact = { value: string; contact: string };
const mask = (value: string, pattern: string) => {
  const digits = value.replace(/\D/g, "");
  let index = 0;
  let output = "";
  for (const character of pattern) {
    if (index >= digits.length) break;
    output += character === "#" ? digits[index++] : character;
  }
  return output;
};
function CreateCommercialCompany() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [phones, setPhones] = useState<Contact[]>([{ value: "", contact: "" }]);
  const [emails, setEmails] = useState<Contact[]>([{ value: "", contact: "" }]);
  const [saving, setSaving] = useState(false);
  const [cepStatus, setCepStatus] = useState("");
  const [cnpjStatus, setCnpjStatus] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const companyCep = useRef("");
  useEffect(() => {
    const cnpj = form.cnpj.replace(/\D/g, "");
    setCnpjStatus("");
    setCnpjLoading(false);
    if (cnpj.length !== 14) return;
    const controller = new AbortController();
    let active = true;
    setCnpjLoading(true);
    setCnpjStatus("Buscando dados da empresa...");
    const timer = window.setTimeout(async () => {
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`https://minhareceita.org/${cnpj}`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "CNPJ não encontrado. Preencha os dados manualmente."
              : "Não foi possível consultar o CNPJ. Preencha os dados manualmente.",
          );
        const data = await response.json();
        if (controller.signal.aborted) return;
        companyCep.current = String(data.cep || "").replace(/\D/g, "");
        setForm((previous) => ({
          ...previous,
          name: data.nome_fantasia || data.razao_social || previous.name,
          legal_name: data.razao_social || previous.legal_name,
          trade_name: data.nome_fantasia || previous.trade_name,
          size: data.opcao_pelo_mei
            ? "MEI"
            : data.codigo_porte === 1
              ? "Microempresa"
              : data.codigo_porte === 3
                ? "Pequeno"
                : previous.size,
          postal_code: data.cep ? mask(String(data.cep), "#####-###") : previous.postal_code,
          address:
            [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ") ||
            previous.address,
          number: data.numero || previous.number,
          complement: data.complemento || previous.complement,
          neighborhood: data.bairro || previous.neighborhood,
          city: data.municipio || previous.city,
          state: data.uf || previous.state,
          activities: data.cnae_fiscal_descricao || previous.activities,
        }));
        const phone = String(data.ddd_telefone_1 || "").replace(/\D/g, "");
        if ([10, 11].includes(phone.length))
          setPhones((previous) =>
            previous.some((item) => item.value)
              ? previous
              : [
                  {
                    value: mask(phone, phone.length === 11 ? "(##) #####-####" : "(##) ####-####"),
                    contact: "",
                  },
                ],
          );
        if (data.email)
          setEmails((previous) =>
            previous.some((item) => item.value) ? previous : [{ value: data.email, contact: "" }],
          );
        setCnpjStatus("Dados preenchidos pelo CNPJ. Confira antes de salvar.");
      } catch (error) {
        if (!active) return;
        if (!controller.signal.aborted)
          setCnpjStatus(
            error instanceof Error ? error.message : "Não foi possível consultar o CNPJ.",
          );
        else
          setCnpjStatus("A consulta demorou mais que o esperado. Preencha os dados manualmente.");
      } finally {
        window.clearTimeout(timeout);
        if (active) setCnpjLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.cnpj]);
  useEffect(() => {
    const cep = form.postal_code.replace(/\D/g, "");
    if (cep.length !== 8) {
      setCepStatus("");
      return;
    }
    if (cep === companyCep.current) {
      setCepStatus("Endereço preenchido pelo CNPJ.");
      return;
    }
    const controller = new AbortController();
    setCepStatus("Buscando endereço...");
    fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.erro) {
          setCepStatus("CEP não encontrado. Preencha o endereço manualmente.");
          return;
        }
        setForm((previous) => ({
          ...previous,
          address: data.logradouro || previous.address,
          neighborhood: data.bairro || previous.neighborhood,
          city: data.localidade || previous.city,
          state: data.uf || previous.state,
        }));
        setCepStatus("Endereço preenchido pelo CEP.");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCepStatus("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
      });
    return () => controller.abort();
  }, [form.postal_code]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || cnpjLoading) return;
    const digits = form.cnpj.replace(/\D/g, "");
    if (digits && digits.length !== 14) {
      toast.error("Preencha o CNPJ completo, com 14 dígitos.");
      return;
    }
    if (!form.name.trim() || !form.city.trim() || !/^[A-Z]{2}$/.test(form.state)) {
      toast.error("Preencha nome, cidade e UF.");
      return;
    }
    if (form.postal_code && form.postal_code.replace(/\D/g, "").length !== 8) {
      toast.error("Preencha o CEP completo.");
      return;
    }
    if (
      phones.some((item) => item.value && ![10, 11].includes(item.value.replace(/\D/g, "").length))
    ) {
      toast.error("Preencha os telefones completos, incluindo o DDD.");
      return;
    }
    if (emails.some((item) => item.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.value))) {
      toast.error("Informe e-mails válidos.");
      return;
    }
    if (form.website && !/^https?:\/\//i.test(form.website)) {
      toast.error("Informe o site começando com https:// ou http://.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc(
        "company_leads_create" as never,
        {
          p_payload: {
            ...form,
            phones: phones.filter((item) => item.value),
            emails: emails.filter((item) => item.value),
          },
        } as never,
      );
      if (error) throw error;
      toast.success("Empresa cadastrada nos contatos comerciais.");
      await navigate({ to: "/comercial/contatos" });
    } catch (error: any) {
      toast.error(
        error.code === "23505"
          ? "Já existe uma empresa com este CNPJ."
          : error.message || "Não foi possível cadastrar a empresa.",
      );
    } finally {
      setSaving(false);
    }
  }
  const field = (key: keyof typeof form, label: string, required = false) => (
    <div key={key}>
      <Label htmlFor={`company-${key}`}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={`company-${key}`}
        className="mt-1"
        value={form[key]}
        required={required}
        maxLength={key === "state" ? 2 : undefined}
        inputMode={key === "cnpj" || key === "postal_code" ? "numeric" : undefined}
        type={key === "terminals" || key === "companies" ? "number" : "text"}
        min={0}
        step={1}
        onChange={(event) =>
          setForm((previous) => ({
            ...previous,
            [key]:
              key === "cnpj"
                ? mask(event.target.value, "##.###.###/####-##")
                : key === "postal_code"
                  ? mask(event.target.value, "#####-###")
                  : key === "state"
                    ? event.target.value.replace(/[^a-z]/gi, "").toUpperCase()
                    : event.target.value,
          }))
        }
      />
      {key === "cnpj" && (
        <p className="mt-1 min-h-8 text-xs text-muted-foreground" role="status">
          {cnpjStatus || "Digite o CNPJ completo para preencher os dados automaticamente."}
        </p>
      )}
    </div>
  );
  const selectClass =
    "mt-1 h-11 w-full cursor-pointer rounded-xl border border-input bg-background px-3 text-sm";
  return (
    <AppShell fullWidth>
      <PageHeader
        title="Cadastrar empresa"
        description="Adicione uma empresa aos contatos comerciais."
        breadcrumbs={[
          { label: "Comercial" },
          { label: "Contatos" },
          { label: "Cadastrar empresa" },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/comercial/contatos">Voltar para contatos</Link>
          </Button>
        }
      />
      <form
        onSubmit={save}
        className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
        style={{ overflowAnchor: "none" }}
      >
        <div className="min-w-0 space-y-5 text-sm [&_input]:h-11 [&_input]:rounded-xl [&_input]:text-sm [&_label]:text-xs [&_label]:font-medium">
          <section className="rounded-2xl border bg-card p-5">
            <Heading icon={Building2} title="Dados da empresa" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {field("cnpj", "CNPJ")}
              {field("name", "Nome", true)}
              {field("legal_name", "Razão social")}
              {field("trade_name", "Nome fantasia")}
              <div>
                <Label htmlFor="company-size">Porte</Label>
                <select
                  id="company-size"
                  className={selectClass}
                  value={form.size}
                  onChange={(event) => setForm({ ...form, size: event.target.value })}
                >
                  <option value="">Selecione</option>
                  {["MEI", "Microempresa", "Pequeno", "Médio", "Grande"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div className="w-full max-w-36">{field("acronym", "Sigla")}</div>
              <div>
                <Label htmlFor="company-sector">Ramo</Label>
                <select
                  id="company-sector"
                  className={selectClass}
                  value={form.sector}
                  onChange={(event) => setForm({ ...form, sector: event.target.value })}
                >
                  <option value="">Selecione</option>
                  {[
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
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              {field("website", "Site")}
              {field("terminals", "Terminais")}
              {field("companies", "Empresas")}
            </div>
            <fieldset className="mt-4">
              <legend className="text-xs font-medium">Prioridade</legend>
              <div
                role="radiogroup"
                aria-label="Prioridade"
                className="mt-2 grid grid-cols-3 gap-2"
              >
                {[
                  {
                    value: "Baixa",
                    icon: ChevronDown,
                    base: "border-success/25 bg-success/10 dark:bg-success/15",
                    active:
                      "border-success/70 ring-2 ring-success/40 shadow-sm bg-success/15 dark:bg-success/20",
                    wrap: "bg-success text-success-foreground",
                    text: "text-success",
                  },
                  {
                    value: "Média",
                    icon: Minus,
                    base: "border-warning/30 bg-warning/12 dark:bg-warning/15",
                    active:
                      "border-warning/70 ring-2 ring-warning/40 shadow-sm bg-warning/20 dark:bg-warning/25",
                    wrap: "bg-warning text-warning-foreground",
                    text: "text-warning-foreground",
                  },
                  {
                    value: "Alta",
                    icon: ArrowUp,
                    base: "border-destructive/25 bg-destructive/10 dark:bg-destructive/15",
                    active:
                      "border-destructive/70 ring-2 ring-destructive/40 shadow-sm bg-destructive/15 dark:bg-destructive/20",
                    wrap: "bg-destructive text-destructive-foreground",
                    text: "text-destructive",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={form.priority === option.value}
                    onClick={() => setForm({ ...form, priority: option.value })}
                    className={cn(
                      "relative flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                      option.base,
                      form.priority === option.value && option.active,
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full",
                        option.wrap,
                      )}
                    >
                      <option.icon className="size-3" strokeWidth={3} />
                    </span>
                    <span className={option.text}>{option.value}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="mt-4">
              <Label htmlFor="company-activities">Atividades</Label>
              <textarea
                id="company-activities"
                className="mt-1 min-h-24 w-full rounded-xl border border-input bg-background p-3 text-sm"
                value={form.activities}
                onChange={(event) => setForm({ ...form, activities: event.target.value })}
              />
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <Heading icon={MapPin} title="Endereço" />
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {field("postal_code", "CEP")}
              {field("address", "Endereço")}
              {field("number", "Número")}
              {field("neighborhood", "Bairro")}
              {field("city", "Cidade", true)}
              {field("state", "UF", true)}
              {field("complement", "Complemento")}
            </div>
            <p className="mt-2 min-h-5 text-xs text-muted-foreground" role="status">
              {cepStatus}
            </p>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <Heading icon={UserRound} title="Telefones e e-mails" />
            <div className="mt-4 space-y-5">
              {(
                [
                  { title: "Telefones", kind: "phone", items: phones, update: setPhones },
                  { title: "E-mails", kind: "email", items: emails, update: setEmails },
                ] as const
              ).map((group) => (
                <div key={group.kind}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium">{group.title}</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => group.update([...group.items, { value: "", contact: "" }])}
                    >
                      <Plus className="mr-1 size-4" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item, index) => (
                      <div
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-end gap-3"
                        key={index}
                      >
                        <div>
                          <Label htmlFor={`${group.kind}-${index}`}>
                            {group.kind === "phone" ? "Telefone" : "E-mail"}
                          </Label>
                          <Input
                            id={`${group.kind}-${index}`}
                            type={group.kind === "email" ? "email" : "tel"}
                            className="mt-1"
                            value={item.value}
                            onChange={(event) =>
                              group.update(
                                group.items.map((current, position) =>
                                  position === index
                                    ? {
                                        ...current,
                                        value:
                                          group.kind === "phone"
                                            ? mask(
                                                event.target.value,
                                                event.target.value.replace(/\D/g, "").length > 10
                                                  ? "(##) #####-####"
                                                  : "(##) ####-####",
                                              )
                                            : event.target.value,
                                      }
                                    : current,
                                ),
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`${group.kind}-contact-${index}`}>Contato</Label>
                          <Input
                            id={`${group.kind}-contact-${index}`}
                            className="mt-1"
                            placeholder="Nome do contato"
                            value={item.contact}
                            onChange={(event) =>
                              group.update(
                                group.items.map((current, position) =>
                                  position === index
                                    ? { ...current, contact: event.target.value }
                                    : current,
                                ),
                              )
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${group.kind === "phone" ? "telefone" : "e-mail"} ${index + 1}`}
                          onClick={() =>
                            group.update(
                              group.items.length === 1
                                ? [{ value: "", contact: "" }]
                                : group.items.filter((_, position) => position !== index),
                            )
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/comercial/contatos">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={saving || cnpjLoading}>
              {saving ? "Salvando..." : "Salvar empresa"}
            </Button>
          </div>
        </div>
        <RegistrationSummary
          title={form.name || "Nome da empresa"}
          subtitle={form.legal_name || form.trade_name || "Contato comercial"}
          items={[
            { label: "CNPJ", value: form.cnpj, icon: Building2 },
            { label: "Sigla", value: form.acronym, icon: Building2 },
            { label: "Porte", value: form.size, icon: Building2 },
            { label: "Ramo", value: form.sector, icon: Building2 },
            {
              label: "Cidade / UF",
              value: [form.city, form.state].filter(Boolean).join(" / "),
              icon: MapPin,
            },
            { label: "Site", value: form.website, icon: Globe },
            {
              label: "Telefone",
              value: phones.find((item) => item.value)?.value || "",
              icon: Phone,
            },
            { label: "E-mail", value: emails.find((item) => item.value)?.value || "", icon: Mail },
          ]}
          note="A empresa será adicionada aos contatos comerciais na etapa Prospecção."
        >
          <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs">
            Prioridade {form.priority}
          </span>
        </RegistrationSummary>
      </form>
    </AppShell>
  );
}
function Heading({ icon: Icon, title }: { icon: typeof Building2; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-base font-medium">
      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      {title}
    </h2>
  );
}
