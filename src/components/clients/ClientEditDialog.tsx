import { useEffect, useState, useRef } from "react";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalAuth } from "@/lib/portal-auth";
import { parsedLegacy } from "@/lib/client-listing-rules";
import {
  loadClientEditData,
  saveClientEdit,
  type ClientEditData,
  type EditableRow,
} from "@/lib/client-edit-api";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { AccountantSelect } from "@/components/portal/AccountantSelect";
import { loadClients } from "@/lib/clients-store";

function object(value: unknown): Record<string, unknown> {
  const parsed = parsedLegacy(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}
const formatCep = (value: unknown) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
type Field = [string, string, string?];
const companyFields: Field[] = [
  ["Razão social", "legal_name", "razao_social"],
  ["Nome fantasia", "trade_name", "nome_fantasia"],
  ["Inscrição estadual", "state_registration", "insc_estadual"],
  ["CNAE", "cnae", "cnae"],
  ["Inscrição municipal", "municipal_registration", "insc_municipal"],
];
const addressFields: Field[] = [
  ["CEP", "postal_code", "cep"],
  ["Endereço", "address", "endereco"],
  ["Cidade", "city", "cidade"],
  ["UF", "state", "uf"],
];
const units = [
  ["1", "São Carlos"],
  ["25", "Campinas"],
  ["26", "São Sebastião do Paraíso"],
];
const applications = [
  { type: "MOB", name: "Hádron Mobile" },
  { type: "WEB", name: "Hádron Web" },
  { type: "B2C", name: "Hádron Commerce" },
  { type: "B2B", name: "Hádron Portal B2B" },
  { type: "EXE", name: "Hádron Calc RT" },
];

export function ClientEditDialog({
  acronym,
  companyId,
  onClose,
  onSaved,
}: {
  acronym: string;
  companyId?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const isCompany = Boolean(companyId);
  const { role, department } = usePortalAuth();
  const allowed = role === "s_admin" || department === "admin" || department === "commercial";
  const [data, setData] = useState<ClientEditData | null>(null);
  const [row, setRow] = useState<EditableRow | null>(null);
  const [source, setSource] = useState<Record<string, unknown>>({});
  const [contacts, setContacts] = useState<EditableRow[]>([]);
  const [webApps, setWebApps] = useState<string[]>([]);
  const [tab, setTab] = useState("client");
  const [internet, setInternet] = useState({ status: 1, devices: "" });
  const cepRequests = useRef<Record<string, AbortController>>({});
  useEffect(() => () => Object.values(cepRequests.current).forEach((c) => c.abort()), []);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRow(null);
    setError("");
    loadClientEditData(acronym, companyId)
      .then((d) => {
        if (!active) return;
        const record = companyId ? d.companies.find((c) => c.id === companyId) : d.client;
        if (!record) {
          setError("Empresa vinculada não encontrada.");
          return;
        }
        setData(d);
        setRow({
          ...record,
          ...(!companyId ? { name: record.name || record.trade_name || record.legal_name } : {}),
        });
        setSource({ ...record.source_payload });
        setContacts(d.contacts);
        setWebApps(d.webApps ?? []);
        setInternet({
          status: d.internet?.status ?? 1,
          devices: String(d.internet?.devices ?? ""),
        });
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar os dados para edição.");
      });
    return () => {
      active = false;
    };
  }, [acronym, companyId]);
  const update = (key: string, value: unknown, legacy?: string) => {
    setRow((r) => (r ? { ...r, [key]: value } : r));
    if (legacy) setSource((s) => ({ ...s, [(isCompany ? "tcl_" : "cli_") + legacy]: value }));
  };
  const sourceValue = (key: string) => source["tcl_" + key];
  const sourceChange = (key: string, value: unknown) =>
    setSource((s) => ({ ...s, ["tcl_" + key]: value }));
  const nestedValue = (container: string, key: string) => {
    const values = object(source[container]);
    return values[key] ?? values[key.replace(/^cli_/, "tcl_")];
  };
  const nestedChange = (container: string, key: string, value: unknown) =>
    setSource((s) => ({
      ...s,
      [container]: JSON.stringify({ ...object(s[container]), [key]: value }),
    }));
  const input = (label: string, value: unknown, change: (value: string) => void, type = "text") => (
    <label key={label} className="block min-w-0 space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      <Input
        aria-label={label}
        type={type}
        value={String(value ?? "")}
        onChange={(e) => change(e.target.value)}
        className="min-w-0 w-full"
      />
    </label>
  );
  const select = (
    label: string,
    value: unknown,
    options: string[][],
    change: (value: string) => void,
  ) => (
    <label key={label} className="space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      <select
        aria-label={label}
        value={String(value ?? "")}
        onChange={(e) => change(e.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        <option value="">Não informado</option>
        {!options.some(([code]) => code === String(value ?? "")) && String(value ?? "") && (
          <option value={String(value)}>{String(value)}</option>
        )}
        {options.map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
  const section = (title: string, children: React.ReactNode) => (
    <section className="space-y-4 border-t pt-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
  const patchContact = (id: string, patch: Record<string, unknown>) =>
    setContacts((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addContact = (kind: string) =>
    setContacts((list) => [
      ...list,
      { id: crypto.randomUUID(), name: "", email: "", phone: "", source_payload: {}, _kind: kind },
    ]);
  const contactSection = (kind: "phone" | "email") => {
    const list = contacts
      .filter((c) => !c._delete)
      .flatMap((c) => {
        const fields =
          kind === "email"
            ? c.email || c._kind === "email"
              ? ["email"]
              : []
            : ["phone", "mobile", "whatsapp"].filter((field) => c[field]);
        if (kind === "phone" && !fields.length && c._kind === "phone") fields.push("phone");
        return fields.map((field) => ({ contact: c, field }));
      });
    return (
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-medium">{kind === "phone" ? "Telefones" : "E-mails"}</h4>
          <Button type="button" variant="outline" size="sm" onClick={() => addContact(kind)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Adicionar {kind === "phone" ? "telefone" : "e-mail"}
          </Button>
        </div>
        {list.map(({ contact: c, field }, i) => (
          <div
            key={c.id + field}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border p-3"
          >
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {input(
                `${kind === "phone" ? "Telefone" : "E-mail"} ${i + 1}`,
                c[field],
                (v) => patchContact(c.id, { [field]: v }),
                kind === "phone" ? "tel" : "email",
              )}
              {input(
                `Contato do ${kind === "phone" ? "telefone" : "e-mail"} ${i + 1}`,
                c.name,
                (v) => patchContact(c.id, { name: v }),
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-5 h-9 w-9 text-destructive"
              aria-label={`Remover ${kind === "phone" ? "telefone" : "e-mail"} ${i + 1}`}
              onClick={() =>
                patchContact(c.id, {
                  [field]: "",
                  _delete: !["phone", "mobile", "whatsapp", "email"].some(
                    (key) => key !== field && c[key],
                  ),
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {!list.length && (
          <p className="text-xs text-muted-foreground">
            Nenhum {kind === "phone" ? "telefone" : "e-mail"} cadastrado.
          </p>
        )}
      </div>
    );
  };
  async function changeCep(value: string, responsible = false) {
    const formatted = formatCep(value);
    const key = responsible ? "responsible" : "company";
    cepRequests.current[key]?.abort();
    if (responsible) nestedChange("tcl_responsavel", "cli_res_cep", formatted);
    else update("postal_code", formatted, "cep");
    const digits = formatted.replace(/\D/g, "");
    if (digits.length !== 8) return;
    const controller = new AbortController();
    cepRequests.current[key] = controller;
    try {
      const response = await fetch("https://viacep.com.br/ws/" + digits + "/json/", {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error();
      const address = await response.json();
      if (controller.signal.aborted) return;
      if (address.erro) {
        toast.error("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      if (responsible)
        setSource((previous) => ({
          ...previous,
          tcl_responsavel: JSON.stringify({
            ...object(previous.tcl_responsavel),
            cli_res_endereco: address.logradouro,
            cli_res_cidade: address.localidade,
            cli_res_uf: address.uf,
            cli_res_bairro: address.bairro,
          }),
        }));
      else {
        setRow((previous) =>
          previous
            ? {
                ...previous,
                address: address.logradouro,
                city: address.localidade,
                state: address.uf,
              }
            : previous,
        );
        setSource((previous) => ({
          ...previous,
          tcl_endereco: address.logradouro,
          tcl_cidade: address.localidade,
          tcl_uf: address.uf,
          tcl_bairro: address.bairro,
        }));
      }
    } catch {
      if (!controller.signal.aborted)
        toast.error("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
    }
  }
  async function checkCnpj() {
    const cnpj = String(row?.document ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    setChecking(true);
    try {
      const response = await fetch(`https://minhareceita.org/${cnpj}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      const values: Record<string, unknown> = {
        legal_name: result.razao_social,
        trade_name: result.nome_fantasia,
        cnae: result.cnae_fiscal,
        postal_code: result.cep,
        address: [result.descricao_tipo_de_logradouro, result.logradouro].filter(Boolean).join(" "),
        city: result.municipio,
        state: result.uf,
      };
      setRow((r) =>
        r
          ? {
              ...r,
              ...Object.fromEntries(
                Object.entries(values).filter(([, v]) => v !== undefined && v !== null),
              ),
            }
          : r,
      );
      setSource((s) => ({
        ...s,
        tcl_endereco: values.address ?? s.tcl_endereco,
        tcl_razao_social: values.legal_name ?? s.tcl_razao_social,
        tcl_nome_fantasia: values.trade_name ?? s.tcl_nome_fantasia,
        tcl_cnae: values.cnae ?? s.tcl_cnae,
        tcl_cep: values.postal_code ?? s.tcl_cep,
        tcl_cidade: values.city ?? s.tcl_cidade,
        tcl_uf: values.state ?? s.tcl_uf,
        tcl_numero: result.numero ?? s.tcl_numero,
        tcl_bairro: result.bairro ?? s.tcl_bairro,
        tcl_complemento: result.complemento ?? s.tcl_complemento,
      }));
      toast.success("Dados do CNPJ encontrados. Confira antes de salvar.");
    } catch {
      toast.error("Não foi possível consultar o CNPJ. Você pode preencher os dados manualmente.");
    } finally {
      setChecking(false);
    }
  }
  async function save() {
    if (!row || !allowed) return;
    if (!String(row.legal_name ?? "").trim() || (!isCompany && !String(row.name ?? "").trim())) {
      toast.error("Preencha nome e razão social.");
      return;
    }
    if (
      !isCompany &&
      contacts.some(
        (c) =>
          !c._delete &&
          c.email &&
          c.email !== data?.contacts.find((original) => original.id === c.id)?.email &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email)),
      )
    ) {
      toast.error("Confira os e-mails dos contatos.");
      return;
    }
    if (
      !isCompany &&
      internet.devices !== "" &&
      (!/^\d+$/.test(internet.devices) || Number(internet.devices) > 2147483647)
    ) {
      toast.error("Informe uma quantidade de dispositivos válida.");
      return;
    }
    setSaving(true);
    try {
      const appsChanged =
        JSON.stringify([...webApps].sort()) !== JSON.stringify([...(data?.webApps ?? [])].sort());
      await saveClientEdit(
        acronym,
        companyId ?? null,
        isCompany
          ? {
              ...row,
              address:
                [
                  source.tcl_endereco ?? row.address,
                  source.tcl_numero,
                  source.tcl_complemento,
                  source.tcl_bairro,
                ]
                  .map((value) => String(value ?? "").trim())
                  .filter(Boolean)
                  .join(", ") || row.address,
            }
          : row,
        source,
        isCompany ? undefined : contacts,
        appsChanged ? webApps : undefined,
        !isCompany &&
          (internet.status !== (data?.internet?.status ?? 1) ||
            internet.devices !== String(data?.internet?.devices ?? ""))
          ? {
              status: internet.status,
              devices: internet.devices === "" ? null : Number(internet.devices),
            }
          : undefined,
      );
      await loadClients(true).catch(() => undefined);
      toast.success(isCompany ? "Empresa atualizada." : "Cliente atualizado.");
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        autoFooter={false}
        className="flex max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:p-0"
      >
        <DialogTitle className="sr-only">
          {isCompany ? "Editar empresa" : "Editar cliente"} · {acronym}
        </DialogTitle>
        <DetailModalHeader
          icon={Pencil}
          title={isCompany ? "Editar empresa" : "Editar cliente"}
          protocol={acronym}
          meta={String(row?.legal_name ?? "")}
        />
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {error ? (
            <p role="alert">{error}</p>
          ) : !row ? (
            <p className="flex gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </p>
          ) : isCompany ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  {input("CNPJ", row.document, (v) => update("document", v, "cnpj"))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={checkCnpj}
                    disabled={checking}
                  >
                    {checking ? "Consultando..." : "Checar CNPJ"}
                  </Button>
                </div>
                {companyFields.map(([label, key, legacy]) =>
                  input(label, row[key] ?? source["tcl_" + legacy], (v) => update(key, v, legacy)),
                )}
                {input("Site", sourceValue("site"), (v) => sourceChange("site", v))}
                {input("ANTT (transportadora)", sourceValue("antt"), (v) =>
                  sourceChange("antt", v),
                )}
                {select(
                  "Ramo",
                  row.industry,
                  [
                    ["0", "Ramo não preenchido"],
                    ["1", "Comércio"],
                    ["2", "Serviços"],
                    ["3", "Serviços"],
                    ["4", "Indústria"],
                  ],
                  (v) => update("industry", v, "setor"),
                )}
                {select(
                  "Porte",
                  row.size,
                  [
                    ["P", "Pequeno"],
                    ["M", "Médio"],
                    ["G", "Grande"],
                  ],
                  (v) => update("size", v, "porte"),
                )}
                <fieldset className="space-y-2 sm:col-span-2">
                  <legend className="text-xs font-medium">Regime de apuração</legend>
                  <div className="flex flex-wrap gap-4">
                    {[
                      ["0", "Simples"],
                      ["1", "Presumido"],
                      ["2", "Lucro Real"],
                    ].map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="company-tax-regime"
                          checked={String(row.tax_regime ?? "") === value}
                          onChange={() => update("tax_regime", value, "regime")}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              {section(
                "Endereço",
                <div className="grid gap-4 sm:grid-cols-2">
                  {addressFields.map(([label, key, legacy]) =>
                    input(
                      label,
                      key === "address"
                        ? (source.tcl_endereco ?? row[key])
                        : key === "postal_code"
                          ? formatCep(row[key] ?? source["tcl_" + legacy])
                          : (row[key] ?? source["tcl_" + legacy]),
                      (v) =>
                        key === "postal_code"
                          ? void changeCep(v)
                          : update(key, key === "state" ? v.toUpperCase().slice(0, 2) : v, legacy),
                    ),
                  )}
                  {[
                    ["Bairro", "bairro"],
                    ["Número", "numero"],
                    ["Complemento", "complemento"],
                  ].map(([label, key]) =>
                    input(label, sourceValue(key), (v) => sourceChange(key, v)),
                  )}
                </div>,
              )}
              {section(
                "Complemento",
                <div className="grid gap-4 sm:grid-cols-2">
                  {input(
                    "Responsável pela empresa",
                    row.responsible_name || nestedValue("tcl_responsavel", "cli_res_nome"),
                    (v) => {
                      update("responsible_name", v);
                      nestedChange("tcl_responsavel", "cli_res_nome", v);
                    },
                  )}
                  {input(
                    "CPF do responsável",
                    row.responsible_document || nestedValue("tcl_responsavel", "cli_res_cpf"),
                    (v) => {
                      update("responsible_document", v);
                      nestedChange("tcl_responsavel", "cli_res_cpf", v);
                    },
                  )}
                  {[
                    ["RG do responsável", "rg"],
                    ["CEP do responsável", "cep"],
                    ["Cidade do responsável", "cidade"],
                    ["UF do responsável", "uf"],
                    ["Número do responsável", "numero"],
                    ["Complemento do responsável", "complemento"],
                    ["Endereço do responsável", "endereco"],
                    ["Bairro do responsável", "bairro"],
                  ].map(([label, key]) =>
                    input(
                      label,
                      key === "cep"
                        ? formatCep(nestedValue("tcl_responsavel", "cli_res_" + key))
                        : nestedValue("tcl_responsavel", "cli_res_" + key),
                      (v) =>
                        key === "cep"
                          ? void changeCep(v, true)
                          : nestedChange("tcl_responsavel", "cli_res_" + key, v),
                    ),
                  )}
                </div>,
              )}
              {section(
                "Contador da empresa",
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <AccountantSelect
                      value={String(source.accountant_id ?? "")}
                      name={String(
                        source.accountant_name || nestedValue("tcl_contador", "cli_ctd_res") || "",
                      )}
                      office={String(nestedValue("tcl_contador", "cli_ctd_nome") ?? "")}
                      onChange={(accountant) => {
                        setRow((previous) =>
                          previous
                            ? {
                                ...previous,
                                accountant_name: accountant?.name ?? "",
                                accountant_phone: accountant?.phone ?? "",
                                accountant_email: accountant?.email ?? "",
                              }
                            : previous,
                        );
                        setSource((previous) => ({
                          ...previous,
                          accountant_id: accountant?.id ?? null,
                          accountant_name: accountant?.name ?? "",
                          tcl_contador: JSON.stringify({
                            ...object(previous.tcl_contador),
                            cli_ctd_nome: accountant?.office ?? "",
                            cli_ctd_res: accountant?.name ?? "",
                            cli_ctd_tel: accountant?.phone ?? "",
                            cli_ctd_email: accountant?.email ?? "",
                          }),
                        }));
                      }}
                    />
                  </div>
                  {input(
                    "Escritório de contabilidade",
                    nestedValue("tcl_contador", "cli_ctd_nome") ||
                      (!source.accountant_name && !source.tcl_contador ? row.accountant_name : ""),
                    (v) => nestedChange("tcl_contador", "cli_ctd_nome", v),
                  )}
                  {input(
                    "Contador responsável",
                    source.accountant_name ||
                      nestedValue("tcl_contador", "cli_ctd_res") ||
                      (!source.tcl_contador ? row.accountant_name : ""),
                    (v) => {
                      update("accountant_name", v);
                      nestedChange("tcl_contador", "cli_ctd_res", v);
                      setSource((s) => ({ ...s, accountant_name: v }));
                    },
                  )}
                  {input(
                    "Telefone do contador",
                    nestedValue("tcl_contador", "cli_ctd_tel") || row.accountant_phone,
                    (v) => {
                      update("accountant_phone", v);
                      nestedChange("tcl_contador", "cli_ctd_tel", v);
                    },
                    "tel",
                  )}
                  {input(
                    "E-mail do contador",
                    nestedValue("tcl_contador", "cli_ctd_email") || row.accountant_email,
                    (v) => {
                      update("accountant_email", v);
                      nestedChange("tcl_contador", "cli_ctd_email", v);
                    },
                    "email",
                  )}
                </div>,
              )}
              {section(
                "Aplicações web",
                <div className="flex flex-wrap gap-4">
                  {(data?.applications?.length ? data.applications : applications).map((app) => (
                    <label key={app.type} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={webApps.includes(app.type)}
                        onChange={(e) =>
                          setWebApps((list) =>
                            e.target.checked
                              ? [...list, app.type]
                              : list.filter((type) => type !== app.type),
                          )
                        }
                      />
                      {app.name}
                    </label>
                  ))}
                </div>,
              )}
            </>
          ) : (
            <>
              <div
                role="tablist"
                aria-label="Dados do cliente"
                className="grid grid-cols-2 gap-2 rounded-xl border p-1"
              >
                {[
                  ["client", "Cliente"],
                  ["internet", "Internet"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    variant={tab === value ? "default" : "ghost"}
                    onClick={() => setTab(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {tab === "internet" ? (
                <div role="tabpanel" className="space-y-5">
                  {section(
                    "Hádron Web",
                    <div className="grid gap-4 sm:grid-cols-2">
                      {select(
                        "Status da Internet",
                        internet.status,
                        [
                          ["1", "Ativo"],
                          ["2", "Pendente"],
                          ["9", "Bloqueado"],
                          ["0", "Inativo"],
                        ],
                        (value) =>
                          setInternet((previous) => ({ ...previous, status: Number(value) })),
                      )}
                      {input(
                        "Quantidade de dispositivos",
                        internet.devices,
                        (value) => setInternet((previous) => ({ ...previous, devices: value })),
                        "number",
                      )}
                    </div>,
                  )}
                  {section(
                    "Aplicações web",
                    <div className="flex flex-wrap gap-4">
                      {(data?.applications?.length ? data.applications : applications).map(
                        (app) => (
                          <label key={app.type} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={webApps.includes(app.type)}
                              onChange={(event) =>
                                setWebApps((previous) =>
                                  event.target.checked
                                    ? [...previous, app.type]
                                    : previous.filter((type) => type !== app.type),
                                )
                              }
                            />
                            {app.name}
                          </label>
                        ),
                      )}
                    </div>,
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {input("Nome (apelido)", row.name, (v) => update("name", v, "nome"))}
                    {select(
                      "Status do cliente",
                      source.cli_status ?? (row.active ? "1" : "0"),
                      [
                        ["1", "Ativo"],
                        ["2", "Pendente"],
                        ["9", "Bloqueado"],
                        ["0", "Inativo"],
                      ],
                      (v) => {
                        update("active", v !== "0");
                        setSource((s) => ({ ...s, cli_status: v }));
                      },
                    )}
                    {input("Sigla do grupo", row.group_acronym, (v) =>
                      update("group_acronym", v.toUpperCase(), "sigla_grupo"),
                    )}
                    {input("Aviso do cliente", source.cli_aviso, (v) =>
                      setSource((s) => ({ ...s, cli_aviso: v })),
                    )}
                    {input("Mensagem do Hádron", source.cli_msg_hadron, (v) =>
                      setSource((s) => ({ ...s, cli_msg_hadron: v })),
                    )}
                    {input("Razão social", row.legal_name, (v) =>
                      update("legal_name", v, "razao_social"),
                    )}
                  </div>
                  {section(
                    "Unidade de atendimento",
                    <div className="flex flex-wrap gap-4">
                      {units.map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="client-service-unit"
                            checked={String(source.empresa_id_emp ?? "") === value}
                            onChange={() => setSource((s) => ({ ...s, empresa_id_emp: value }))}
                          />
                          {label}
                        </label>
                      ))}
                    </div>,
                  )}
                  {section(
                    "Atividades",
                    <textarea
                      aria-label="Atividades"
                      rows={4}
                      className="w-full rounded-md border bg-background p-3 text-sm"
                      value={String(source.cli_obs ?? "").replace(/<[^>]*>/g, "")}
                      onChange={(e) => setSource((s) => ({ ...s, cli_obs: e.target.value }))}
                    />,
                  )}
                  {section(
                    "Contatos",
                    <div className="grid gap-5 lg:grid-cols-2">
                      {contactSection("phone")}
                      {contactSection("email")}
                    </div>,
                  )}
                </>
              )}
            </>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 border-t p-4 sm:flex sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={!row || saving || !allowed}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
