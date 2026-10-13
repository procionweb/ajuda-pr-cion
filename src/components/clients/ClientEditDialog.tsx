import { useEffect, useState } from "react";
import { Pencil, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalAuth } from "@/lib/portal-auth";
import { companyModuleOptions, moduleCodes, parsedLegacy } from "@/lib/client-listing-rules";
import {
  loadClientEditData,
  saveClientEdit,
  type ClientEditData,
  type EditableRow,
} from "@/lib/client-edit-api";
import { loadClients } from "@/lib/clients-store";

function legacyObject(value: unknown): Record<string, unknown> {
  const parsed = parsedLegacy(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}
type Field = [string, string, string?];
const common: Field[] = [
  ["Razão social", "legal_name", "razao_social"],
  ["Nome fantasia", "trade_name", "nome_fantasia"],
  ["CNPJ / CPF", "document", "cnpj"],
  ["Inscrição estadual", "state_registration", "insc_estadual"],
  ["Inscrição municipal", "municipal_registration", "insc_municipal"],
  ["CNAE", "cnae", "cnae"],
  ["Cidade", "city", "cidade"],
  ["UF", "state", "uf"],
  ["CEP", "postal_code", "cep"],
  ["Endereço", "address", "endereco"],
];
const clientOnly: Field[] = [
  ["Nome do cliente", "name", "nome"],
  ["Sigla do grupo", "group_acronym", "sigla_grupo"],
  ["Número", "address_number", "numero"],
  ["Bairro", "neighborhood", "bairro"],
  ["Complemento", "address_complement", "complemento"],
  ["Site", "website", "site"],
  ["Operador responsável", "primary_operator", "operador_resp1"],
  ["Segundo responsável", "secondary_operator", "operador_resp2"],
];
const companyOnly: Field[] = [
  ["Responsável", "responsible_name"],
  ["CPF do responsável", "responsible_document"],
  ["Contador", "accountant_name"],
  ["Telefone do contador", "accountant_phone"],
  ["E-mail do contador", "accountant_email"],
];
const legacyFields: Field[] = [
  ["ANTT", "antt"],
  ["Quantidade de terminais", "nterminais"],
  ["Tempo de módulos", "tmp_mod"],
  ["Início de emissão NFE", "inicio_nfe"],
];
const companyLegacy: Field[] = [
  ["Site", "site"],
  ["Número", "numero"],
  ["Bairro", "bairro"],
  ["Complemento", "complemento"],
  ["Operador responsável", "operador_resp1"],
  ["Segundo responsável", "operador_resp2"],
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
  const { role, department } = usePortalAuth();
  const allowed = role === "s_admin" || department === "admin" || department === "commercial";
  const [data, setData] = useState<ClientEditData | null>(null);
  const [selected, setSelected] = useState(companyId ?? "client");
  const [row, setRow] = useState<EditableRow | null>(null);
  const [source, setSource] = useState<Record<string, unknown>>({});
  const [contacts, setContacts] = useState<EditableRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    loadClientEditData(acronym)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setContacts(d.contacts);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os dados para edição.");
      });
    return () => {
      cancelled = true;
    };
  }, [acronym]);
  useEffect(() => {
    if (!data) return;
    const value =
      selected === "client" ? data.client : data.companies.find((c) => c.id === selected);
    setRow(value ? { ...value } : null);
    setSource({ ...value?.source_payload });
  }, [data, selected]);
  const isClient = selected === "client";
  const prefix = isClient ? "cli_" : "tcl_";
  const baseline = isClient ? data?.client : data?.companies.find((c) => c.id === selected);
  const dirty = Boolean(
    row &&
    (JSON.stringify(row) !== JSON.stringify(baseline) ||
      JSON.stringify(source) !== JSON.stringify(baseline?.source_payload ?? {}) ||
      (isClient && JSON.stringify(contacts) !== JSON.stringify(data?.contacts))),
  );
  const field = (label: string, key: string, value: unknown, onChange: (v: string) => void) => (
    <label key={key} className="block min-w-0 space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      <Input
        aria-label={label}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0"
      />
    </label>
  );
  const update = (key: string, value: unknown, legacy?: string) => {
    setRow((r) => (r ? { ...r, [key]: value } : r));
    if (legacy) setSource((s) => ({ ...s, [prefix + legacy]: value }));
    if (!isClient) {
      const fields: Record<string, [string, string]> = {
        responsible_name: ["tcl_responsavel", "cli_res_nome"],
        responsible_document: ["tcl_responsavel", "cli_res_cpf"],
        accountant_name: ["tcl_contador", "cli_ctd_res"],
        accountant_phone: ["tcl_contador", "cli_ctd_tel"],
        accountant_email: ["tcl_contador", "cli_ctd_email"],
      };
      if (fields[key]) {
        const [container, nestedKey] = fields[key];
        setSource((s) => ({
          ...s,
          ...(key === "accountant_name" ? { accountant_name: value } : {}),
          [container]: JSON.stringify({ ...legacyObject(s[container]), [nestedKey]: value }),
        }));
      }
    }
  };
  async function save() {
    if (!row || !allowed) return;
    setSaving(true);
    try {
      await saveClientEdit(
        acronym,
        isClient ? null : selected,
        row,
        source,
        isClient ? contacts : undefined,
      );
      await loadClients(true).catch(() => undefined);
      toast.success(isClient ? "Cliente atualizado." : "Empresa vinculada atualizada.");
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
        className="flex max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:p-0"
      >
        <DialogHeader className="shrink-0 border-b p-4 sm:p-6">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            {isClient ? "Editar cliente" : "Editar empresa vinculada"} · {acronym}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {error ? (
            <p role="alert">{error}</p>
          ) : !row ? (
            <p className="flex gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </p>
          ) : (
            <>
              <label className="mb-5 block space-y-1.5">
                <span className="text-xs font-medium">Cadastro para editar</span>
                <select
                  aria-label="Cadastro para editar"
                  disabled={saving || dirty}
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="client">Cliente · {acronym}</option>
                  {data?.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      Empresa {String(c.company_number ?? "")} ·{" "}
                      {String(c.legal_name || c.trade_name || "")}
                    </option>
                  ))}
                </select>
                {dirty && (
                  <p className="text-xs text-muted-foreground">
                    Salve as alterações ou cancele antes de trocar de cadastro.
                  </p>
                )}
              </label>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  ...(isClient ? clientOnly : []),
                  ...common,
                  ...(!isClient ? companyOnly : []),
                ].map(([label, key, legacy]) =>
                  field(label, key, row[key], (v) =>
                    update(key, key === "state" ? v.toUpperCase().slice(0, 2) : v, legacy),
                  ),
                )}
                {[
                  [
                    "Ramo",
                    "industry",
                    "setor",
                    [
                      ["0", "Ramo não preenchido"],
                      ["1", "Comércio"],
                      ["2", "Serviços"],
                      ["3", "Serviços"],
                      ["4", "Indústria"],
                    ],
                  ],
                  [
                    "Porte",
                    "size",
                    "porte",
                    [
                      ["", "Porte não preenchido"],
                      ["P", "Pequeno"],
                      ["M", "Médio"],
                      ["G", "Grande"],
                    ],
                  ],
                  [
                    "Regime de apuração",
                    "tax_regime",
                    "regime",
                    [
                      ["", "Não informado"],
                      ["0", "Simples Nacional"],
                      ["1", "Lucro Presumido"],
                      ["2", "Lucro Real"],
                      ["3", "MEI"],
                    ],
                  ],
                ].map(([label, key, legacy, options]) => (
                  <label key={String(key)} className="space-y-1.5">
                    <span className="text-xs font-medium">{String(label)}</span>
                    <select
                      aria-label={String(label)}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={String(row[String(key)] ?? "")}
                      onChange={(e) => update(String(key), e.target.value, String(legacy))}
                    >
                      {(options as string[][]).some(
                        ([value]) => value === String(row[String(key)] ?? ""),
                      ) ? null : (
                        <option value={String(row[String(key)] ?? "")}>
                          {String(row[String(key)] ?? "Não informado")}
                        </option>
                      )}
                      {(options as string[][]).map(([value, name]) => (
                        <option key={value} value={value}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {[...legacyFields, ...(!isClient ? companyLegacy : [])].map(([label, key]) =>
                  field(label, prefix + key, source[prefix + key], (v) =>
                    setSource((s) => ({ ...s, [prefix + key]: v })),
                  ),
                )}
                {isClient && (
                  <>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium">Status</span>
                      <select
                        aria-label="Status"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={String(source.cli_status ?? (row.active ? "1" : "0"))}
                        onChange={(e) => {
                          update("active", e.target.value !== "0");
                          setSource((s) => ({ ...s, cli_status: e.target.value }));
                        }}
                      >
                        {[
                          ["0", "Inativo"],
                          ["1", "Ativo"],
                          ["2", "Pendente"],
                          ["9", "Bloqueado"],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {field("Aviso do cliente", "cli_aviso", source.cli_aviso, (v) =>
                      setSource((s) => ({ ...s, cli_aviso: v })),
                    )}
                    {field("Mensagem no Hádron", "cli_msg_hadron", source.cli_msg_hadron, (v) =>
                      setSource((s) => ({ ...s, cli_msg_hadron: v })),
                    )}
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="text-xs font-medium">Observações</span>
                      <textarea
                        aria-label="Observações"
                        rows={4}
                        className="w-full rounded-md border bg-background p-3 text-sm"
                        value={String(source.cli_obs ?? "")}
                        onChange={(e) => setSource((s) => ({ ...s, cli_obs: e.target.value }))}
                      />
                    </label>
                  </>
                )}
              </div>
              {!isClient && (
                <div className="mt-6 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
                  <h3 className="text-sm font-medium sm:col-span-2">Responsável e contabilidade</h3>
                  {field(
                    "Escritório de contabilidade",
                    "cli_ctd_nome",
                    legacyObject(source.tcl_contador).cli_ctd_nome,
                    (value) =>
                      setSource((s) => ({
                        ...s,
                        tcl_contador: JSON.stringify({
                          ...legacyObject(s.tcl_contador),
                          cli_ctd_nome: value,
                        }),
                      })),
                  )}
                  {[
                    ["RG do responsável", "rg"],
                    ["Endereço do responsável", "endereco"],
                    ["Número do responsável", "numero"],
                    ["Complemento do responsável", "complemento"],
                    ["Bairro do responsável", "bairro"],
                    ["Cidade do responsável", "cidade"],
                    ["UF do responsável", "uf"],
                    ["CEP do responsável", "cep"],
                  ].map(([label, key]) =>
                    field(
                      label,
                      key,
                      legacyObject(source.tcl_responsavel)["cli_res_" + key],
                      (value) =>
                        setSource((s) => ({
                          ...s,
                          tcl_responsavel: JSON.stringify({
                            ...legacyObject(s.tcl_responsavel),
                            ["cli_res_" + key]: value,
                          }),
                        })),
                    ),
                  )}
                  <h3 className="text-sm font-medium sm:col-span-2">Configuração e implantação</h3>
                  {field(
                    "Configuração de rede",
                    "tcl_config_rede",
                    source.tcl_config_rede,
                    (value) => setSource((s) => ({ ...s, tcl_config_rede: value })),
                  )}
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium">
                      Homologação NFE com cliente e contador
                    </span>
                    <select
                      aria-label="Homologação NFE"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={String(source.tcl_homo_nfes ?? "")}
                      onChange={(event) =>
                        setSource((s) => ({ ...s, tcl_homo_nfes: event.target.value }))
                      }
                    >
                      <option value="">Não informado</option>
                      <option value="1">Sim</option>
                      <option value="0">Não</option>
                    </select>
                  </label>
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-xs font-medium">Importação de dados</p>
                    <div className="flex flex-wrap gap-4">
                      {[
                        ["produtos", "Produtos"],
                        ["terceiros", "Terceiros"],
                        ["estoque", "Estoque"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={moduleCodes(source.tcl_import_dados).includes(key)}
                            onChange={(event) =>
                              setSource((s) => ({
                                ...s,
                                tcl_import_dados: JSON.stringify(
                                  event.target.checked
                                    ? [...moduleCodes(s.tcl_import_dados), key]
                                    : moduleCodes(s.tcl_import_dados).filter(
                                        (code) => code !== key,
                                      ),
                                ),
                              }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {!isClient && (
                <div className="mt-6 space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4" />
                    Módulos e cobrança da empresa
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {companyModuleOptions.map((m) => (
                      <label key={m.opcao} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={moduleCodes(source.tcl_modulos).includes(m.opcao)}
                          onChange={(e) => {
                            const parsed = parsedLegacy(source.tcl_modulos);
                            const next: Record<string, unknown> =
                              parsed && typeof parsed === "object" && !Array.isArray(parsed)
                                ? { ...parsed }
                                : Object.fromEntries(moduleCodes(parsed).map((k) => [k, ""]));
                            if (e.target.checked) next[m.opcao] = "";
                            else delete next[m.opcao];
                            setSource((s) => ({ ...s, tcl_modulos: JSON.stringify(next) }));
                          }}
                        />
                        {m.modulo}
                      </label>
                    ))}
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium">
                      Cobrança (boletos) · um tipo por linha
                    </span>
                    <textarea
                      aria-label="Cobrança (boletos)"
                      rows={3}
                      className="w-full rounded-md border bg-background p-3 text-sm"
                      value={(() => {
                        const p = parsedLegacy(source.tcl_boleto_dados);
                        return Array.isArray(p)
                          ? p.join("\n")
                          : p && typeof p === "object"
                            ? Object.values(p).join("\n")
                            : String(p ?? "");
                      })()}
                      onChange={(e) =>
                        setSource((s) => ({
                          ...s,
                          tcl_boleto_dados: JSON.stringify(
                            e.target.value
                              .split("\n")
                              .map((v) => v.trim())
                              .filter(Boolean),
                          ),
                        }))
                      }
                    />
                  </label>
                </div>
              )}
              {isClient && contacts.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-medium">Contatos do cliente</h3>
                  {contacts.map((contact, index) => (
                    <div
                      key={contact.id}
                      className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2"
                    >
                      {[
                        ["Nome", "name"],
                        ["Departamento", "department"],
                        ["E-mail", "email"],
                        ["Telefone", "phone"],
                        ["Celular", "mobile"],
                        ["WhatsApp", "whatsapp"],
                      ].map(([label, key]) =>
                        field(`${label} · contato ${index + 1}`, key, contact[key], (v) =>
                          setContacts((list) =>
                            list.map((c) => (c.id === contact.id ? { ...c, [key]: v } : c)),
                          ),
                        ),
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 border-t p-4 sm:flex sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!row || saving || !allowed}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
