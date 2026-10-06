export const closeDealCompanyFields = [
  ["Nome (apelido)", "nickname"],
  ["Sigla", "acronym"],
  ["E-mail do responsável (Admin.)", "admin_email"],
  ["Nome (Admin.)", "admin_name"],
  ["Sigla do grupo", "group_acronym"],
  ["Unidade de atendimento", "service_unit"],
  ["CNPJ", "cnpj"],
  ["Razão social", "legal_name"],
  ["Nome fantasia", "trade_name"],
  ["Inscrição estadual", "state_registration"],
  ["Inscrição municipal", "city_registration"],
  ["CNAE", "cnae"],
  ["ANTT (transportadora)", "antt"],
  ["Regime de apuração", "tax_regime"],
  ["Ramo", "branch"],
  ["Porte", "company_size"],
  ["Site", "website"],
] as const;
export const closeDealContactFields = [
  ["CEP", "postal_code"],
  ["Endereço", "address"],
  ["Número", "address_number"],
  ["Complemento", "address_complement"],
  ["Bairro", "neighborhood"],
  ["Cidade", "city"],
  ["UF", "state"],
  ["Telefone", "phone"],
  ["Contato do telefone", "phone_contact"],
  ["E-mail", "email"],
  ["Contato do e-mail", "email_contact"],
] as const;
export const closeDealResponsibleFields = [
  ["Responsável", "responsible_name"],
  ["CPF", "responsible_cpf"],
  ["RG", "responsible_rg"],
  ["CEP do responsável", "responsible_postal_code"],
  ["Endereço do responsável", "responsible_address"],
  ["Número", "responsible_number"],
  ["Complemento", "responsible_complement"],
  ["Bairro", "responsible_neighborhood"],
  ["Cidade", "responsible_city"],
  ["UF", "responsible_state"],
  ["Escritório", "accounting_office"],
  ["Contador", "accountant_name"],
  ["Telefone do contador", "accountant_phone"],
  ["E-mail do contador", "accountant_email"],
] as const;
export const closeDealHadronFields = [
  ["Responsável PRC 1", "hadron_responsible_1"],
  ["Responsável PRC 2", "hadron_responsible_2"],
  ["Tempo de instalação", "installation_time"],
  ["Terminais", "terminals"],
  ["Configuração de rede", "network"],
  ["Módulos contratados", "modules"],
  ["Documentos fiscais", "fiscal_documents"],
  ["Homologação de NF-e", "nfe_validation"],
  ["Importação de dados", "data_import"],
  ["Boleto bancário", "bank_slip"],
  ["Bancos para cobrança", "banks"],
  ["Aplicativos web", "web_apps"],
] as const;

import type { CompanyLeadDetails } from "./company-leads-api";

export function buildCloseDealForm(lead: CompanyLeadDetails): Record<string, string> {
  const commercial = lead.commercial_data || {};
  const raw = (lead as unknown as { raw_payload?: Record<string, unknown> }).raw_payload || {};
  const defaults: Record<string, unknown> = {
    nickname: commercial.name || raw.nome || lead.trade_name || lead.legal_name,
    acronym: commercial.acronym || raw.sigla,
    cnpj: lead.cnpj,
    legal_name: lead.legal_name,
    trade_name: lead.trade_name,
    cnae: lead.cnae_code || raw.cnae_fiscal || raw.tcl_cnae,
    state_registration: raw.inscricao_estadual || raw.ie || raw.tcl_ie,
    city_registration:
      raw.municipal_registration || raw.inscricao_municipal || raw.im || raw.tcl_im,
    antt: raw.rntrc || raw.tcl_antt,
    company_size: lead.company_size,
    website: lead.website,
    postal_code: lead.postal_code,
    address: commercial.address || raw.endereco || lead.address,
    address_number: commercial.number || raw.numero,
    address_complement: commercial.complement || raw.complemento,
    neighborhood: lead.neighborhood,
    city: lead.city,
    state: lead.state,
    phone: lead.phone,
    email: lead.email,
    admin_email: lead.email,
    branch: commercial.sector || raw.ramo,
    terminals: commercial.terminals || raw.terminais,
    tax_regime: lead.tax_regime,
  };
  const allFields = [
    ...closeDealCompanyFields,
    ...closeDealContactFields,
    ...closeDealResponsibleFields,
    ...closeDealHadronFields,
    ["Observação", "notes"],
  ];
  return Object.fromEntries(
    allFields.map(([, key]) => {
      const draft = lead.conversion_data?.[key];
      const value =
        draft ??
        (commercial[key] !== "" ? commercial[key] : undefined) ??
        (raw[key] !== "" ? raw[key] : undefined) ??
        defaults[key] ??
        "";
      return [key, String(value)];
    }),
  );
}

export const taxRegimeOptions = [
  "Simples Nacional",
  "Lucro Presumido",
  "Lucro Real",
  "MEI",
  "Lucro Arbitrado",
  "Imune ou Isenta",
];
export function formatFiscalField(key: string, value: string): string {
  if (key === "tax_regime")
    return (
      (
        {
          "0": "Simples Nacional",
          "1": "Lucro Presumido",
          "2": "Lucro Real",
          "3": "MEI",
          "4": "Lucro Arbitrado",
          "5": "Imune ou Isenta",
        } as Record<string, string>
      )[value] || value
    );
  if (key === "cnae")
    return value
      .replace(/\D/g, "")
      .slice(0, 7)
      .replace(/^(\d{4})(\d)/, "$1-$2")
      .replace(/^(\d{4}-\d)(\d)/, "$1/$2");
  if (key === "state_registration" || key === "city_registration")
    return value.toUpperCase().replace(/[^A-Z0-9.\/ -]/g, "");
  if (key === "antt") return value.replace(/\D/g, "");
  return value;
}
