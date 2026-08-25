import { supabase } from "@/lib/supabase";
import { normalizeCityName } from "@/lib/br-city";
import type { ClientRow } from "@/routes/clientes.index";

type DatabaseClient = Record<string, unknown>;

export type ClientContact = {
  id: string;
  name: string;
  department: string;
  email: string;
  phone: string;
  mobile: string;
  whatsapp: string;
  active: boolean;
};

export type ClientCompany = {
  id: string;
  clientAcronym: string;
  groupPosition: string;
  companyNumber: number | null;
  legalName: string;
  tradeName: string;
  document: string;
  stateRegistration: string;
  municipalRegistration: string;
  cnae: string;
  industry: string;
  size: string;
  taxRegime: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  responsibleName: string;
  responsibleDocument: string;
  responsibleRg: string;
  responsibleAddress: string;
  responsibleNumber: string;
  responsibleComplement: string;
  responsibleNeighborhood: string;
  responsibleCity: string;
  responsibleState: string;
  responsiblePostalCode: string;
  accountantOffice: string;
  accountantName: string;
  accountantPhone: string;
  accountantEmail: string;
  sourcePayload: Record<string, unknown>;
};

export type ClientHadronUser = {
  id: string;
  name: string;
  email: string;
  operator: string;
  role: string;
  status: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClientTerminal = {
  id: string;
  companyNumber: number | null;
  terminalNumber: number | null;
  ipAddress: string;
  installPath: string;
  version: string;
  versionDate: string;
  serialNumber: string;
  flags: string;
  operatingSystem: string;
  operatingSystemVersion: string;
  emitsNfe: boolean | null;
  notesIssued: number;
  memoryUsed: string;
  memoryTotal: string;
  certificateType: string;
  certificateExpiresAt: string;
  environment: string;
  drives: unknown[];
  registeredAt: string;
  updatedAt: string;
};

export type ClientHadronInfo = {
  id: string;
  companyNumber: number | null;
  branchNumber: number | null;
  companyDescription: string;
  terminalNumber: number | null;
  versionDate: string;
  operatingSystem: string;
  operatingSystemVersion: string;
  emitsNfe: boolean;
  notesIssued: number;
  memoryUsed: string;
  memoryTotal: string;
  drives: Array<{
    name: string;
    role: string;
    total: number | null;
    free: number | null;
    used: number | null;
  }>;
  certificateType: string;
  certificateExpiresAt: string;
  environment: string;
  totalIncompatible: number | null;
  registeredAt: string;
  updatedAt: string;
};

export type ClientModule = {
  id: string;
  name: string;
  contracted: boolean;
  version: string;
};

export type ClientInternetDevice = {
  id: string;
  legacyId: string;
  contractLegacyId: string;
  deviceUuid: string;
  user: string;
  representativeCode: string;
  type: string;
  system: string;
  status: string;
  active: boolean;
  appType: string;
  buildVersion: string;
  dbVersion: string;
  lastCheckedAt: string;
  updatedAt: string;
};

export type ClientInternetContract = {
  id: string;
  legacyId: string;
  contractKey: string;
  name: string;
  webUrl: string;
  databaseName: string;
  serverHost: string;
  status: string;
  active: boolean;
  startsAt: string;
  expiresAt: string;
  updatedAt: string;
  sourcePayload: Record<string, unknown>;
  devices: ClientInternetDevice[];
};

export type ClientInternetApplication = {
  id: string;
  legacyId: string;
  contractLegacyId: string;
  name: string;
  appType: string;
  version: string;
  status: string;
  active: boolean;
  updatedAt: string;
};

export type ClientInternet = {
  hasActiveContract: boolean;
  hasDevices: boolean;
  devices: ClientInternetDevice[];
  contracts: ClientInternetContract[];
  applications: ClientInternetApplication[];
};

export type ClientTicket = {
  id: string;
  protocol: string;
  subject: string;
  module: string;
  submodule: string;
  operator: string;
  priority: string;
  status: string;
  createdAt: string;
  createdAtIso: string;
  updatedAt: string;
};

export type ClientEvent = {
  id: string;
  title: string;
  description: string;
  kind: string;
  startsAt: string;
  startsAtIso: string;
  endsAt: string;
  operator: string;
  origin: string;
  status: string;
  ticketProtocol: string;
  legacyTicketId: string;
};

export type ClientTicketActivity = {
  id: string;
  ticketId: string;
  protocol: string;
  subject: string;
  eventType: string;
  title: string;
  description: string;
  actor: string;
  occurredAt: string;
  occurredAtIso: string;
};

export type ClientParameter = {
  id: string;
  legacyId: string;
  parameterLegacyId: string;
  optionLegacyId: string;
  signature: string;
  optionData: string;
  authUserLegacyId: string;
  signedBy: string;
  operator: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientHadronLog = {
  id: string;
  level: string;
  terminalCode: string;
  operation: string;
  operatorCode: string;
  parentOption: string;
  childOption: string;
  serialNumber: string;
  userCode: string;
  ipAddress: string;
  occurredAt: string;
};

export type ClientExternalLog = {
  id: string;
  action: string;
  controller: string;
  operator: string;
  agent: string;
  device: string;
  ipAddress: string;
  url: string;
  info: string;
  occurredAt: string;
};

export type ClientLogs = {
  authorized: boolean;
  logs: ClientHadronLog[];
  externalLogs: ClientExternalLog[];
};

export type ClientDetail = {
  client: ClientRow;
  contacts: ClientContact[];
  companies: ClientCompany[];
  groupCompanies: ClientCompany[];
  users: ClientHadronUser[];
  terminals: ClientTerminal[];
  hadronInfo: ClientHadronInfo[];
  modules: ClientModule[];
  internet: ClientInternet;
  tickets: ClientTicket[];
  events: ClientEvent[];
  activities: ClientTicketActivity[];
  parameters: ClientParameter[];
  logs: ClientLogs;
};

const industryLabels: Record<string, string> = {
  "1": "Comércio",
  "2": "Serviços",
  "3": "Serviços",
  "4": "Indústria",
};

const sizeLabels: Record<string, string> = {
  P: "Pequeno",
  M: "Médio",
  G: "Grande",
};

const taxRegimeLabels: Record<string, string> = {
  "0": "Simples Nacional",
  "1": "Lucro Presumido",
  "2": "Lucro Real",
  "3": "MEI",
};

const labelFromCode = (value: unknown, labels: Record<string, string>) => {
  const code = String(value || "").trim();
  return labels[code.toUpperCase()] || code || "Não informado";
};

const optionalLabel = (value: unknown, labels: Record<string, string>) => {
  const code = String(value ?? "").trim();
  if (!code) return "";
  return labels[code.toUpperCase()] || "";
};

const date = (value: unknown, withTime = false) => {
  if (!value) return "";
  const raw = String(value).trim();
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
  if (!withTime && dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(
    "pt-BR",
    withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" },
  ).format(parsed);
};

const legacyDate = (value: unknown, withTime = false) => {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(
    "pt-BR",
    withTime
      ? { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }
      : { dateStyle: "short", timeZone: "UTC" },
  ).format(parsed);
};

const formatCnpj = (value: unknown) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 14) return String(value || "");
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

const formatCpf = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return raw;
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};

const formatCep = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return raw;
  return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
};

const parseJsonField = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export function mapDatabaseClient(c: DatabaseClient): ClientRow {
  return {
    id: String(c.acronym || c.legacy_id || "").toLowerCase(),
    registered: date(c.crm_created_at),
    acronym: String(c.acronym || ""),
    group: String(c.group_acronym || ""),
    name: String(c.name || c.trade_name || c.legal_name || ""),
    razaoSocial: String(c.legal_name || c.name || c.acronym || ""),
    fantasia: String(c.trade_name || c.name || ""),
    segment: labelFromCode(c.industry, industryLabels),
    size: labelFromCode(c.size, sizeLabels),
    version: String(c.version || ""),
    versionDate: date(c.version_released_at),
    versionUpdatedAt: date(c.setup_at, true),
    updated: date(c.crm_updated_at, true),
    updatedAt: date(c.crm_updated_at, true),
    city: [normalizeCityName(String(c.city || "")), c.state ? String(c.state).toUpperCase() : ""]
      .filter(Boolean)
      .join(" - "),
    uf: String(c.state || ""),
    cep: String(c.postal_code || ""),
    cnpj: formatCnpj(c.document),
    status: c.active ? "Ativo" : "Inativo",
    sourcePayload: parseJsonField(c.source_payload),
  };
}

export async function listClients(): Promise<ClientRow[]> {
  const rows: DatabaseClient[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc("list_crm_clients", {
      p_limit: 500,
      p_offset: offset,
    });
    if (error) throw error;
    rows.push(...((data || []) as DatabaseClient[]));
    if (!data || data.length < 500) break;
  }
  return rows.map(mapDatabaseClient);
}

export async function searchClientsByCompanies(query: string): Promise<ClientRow[]> {
  const term = query.trim();
  if (!term) return [];
  const { data, error } = await supabase.rpc("search_crm_client_companies", {
    search_term: term,
    result_limit: 200,
  });
  if (error) throw error;
  return ((data || []) as DatabaseClient[]).map(mapDatabaseClient);
}

export async function getClient(acronym: string): Promise<ClientRow | null> {
  const { data, error } = await supabase.rpc("get_crm_client", { client_acronym: acronym });
  if (error) throw error;
  return data?.client ? mapDatabaseClient(data.client) : null;
}

export async function getClientDetail(acronym: string): Promise<ClientDetail | null> {
  const [
    { data, error },
    { data: activityData, error: activityError },
    { data: parameterData, error: parameterError },
    { data: clientEventData, error: clientEventError },
    { data: logData, error: logError },
    { data: groupCompanyData, error: groupCompanyError },
    { data: hadronInfoData, error: hadronInfoError },
  ] = await Promise.all([
    supabase.rpc("get_crm_client", { client_acronym: acronym }),
    supabase.rpc("get_crm_client_ticket_activity", { client_acronym: acronym }),
    supabase.rpc("get_crm_client_params", { client_acronym: acronym }),
    supabase.rpc("get_crm_client_events", { client_acronym: acronym }),
    supabase.rpc("get_crm_client_logs", { client_acronym: acronym }),
    supabase.rpc("get_crm_client_group_companies", { client_acronym: acronym }),
    supabase.rpc("get_crm_client_hadron_info", { client_acronym: acronym }),
  ]);
  if (error) throw error;
  if (activityError) throw activityError;
  if (parameterError) throw parameterError;
  if (clientEventError) throw clientEventError;
  if (logError && logError.code !== "PGRST202") throw logError;
  if (groupCompanyError && groupCompanyError.code !== "PGRST202") throw groupCompanyError;
  if (hadronInfoError && hadronInfoError.code !== "PGRST202") throw hadronInfoError;
  if (!data?.client) return null;

  const contacts = (Array.isArray(data.contacts) ? data.contacts : []).map(
    (contact: Record<string, unknown>): ClientContact => ({
      id: String(contact.id || ""),
      name: String(contact.name || ""),
      department: String(contact.department || ""),
      email: String(contact.email || ""),
      phone: String(contact.phone || ""),
      mobile: String(contact.mobile || ""),
      whatsapp: String(contact.whatsapp || ""),
      active: contact.active !== false,
    }),
  );

  const rawGroupCompanies =
    Array.isArray(groupCompanyData) && groupCompanyData.length
      ? groupCompanyData
      : Array.isArray(data.companies)
        ? data.companies
        : [];
  const mapCompany = (company: Record<string, unknown>): ClientCompany => {
    const payload = parseJsonField(company.source_payload);
    const respRaw = parseJsonField(payload.tcl_responsavel || payload.cli_responsavel);
    const ctdRaw = parseJsonField(payload.tcl_contador || payload.cli_contador);
    const regimeCode = String(company.tax_regime ?? payload.tcl_regime ?? "").trim();
    return {
      id: String(company.id || ""),
      clientAcronym: String(company.client_acronym || ""),
      groupPosition: String(company.group_position || ""),
      companyNumber: typeof company.company_number === "number" ? company.company_number : null,
      legalName: String(company.legal_name || ""),
      tradeName: String(company.trade_name || ""),
      document: formatCnpj(company.document),
      stateRegistration: String(company.state_registration || payload.tcl_ie || ""),
      municipalRegistration: String(payload.tcl_im || ""),
      cnae: String(company.cnae || payload.tcl_cnae || ""),
      industry: labelFromCode(company.industry ?? payload.tcl_setor, industryLabels),
      size: labelFromCode(company.size ?? payload.tcl_porte, sizeLabels),
      taxRegime: optionalLabel(regimeCode, taxRegimeLabels),
      address: String(company.address || payload.tcl_endereco || ""),
      city: normalizeCityName(String(company.city || payload.tcl_cidade || "")),
      state: String(company.state || payload.tcl_uf || "").toUpperCase(),
      postalCode: formatCep(company.postal_code || payload.tcl_cep || ""),
      responsibleName: String(
        company.responsible_name || respRaw.cli_res_nome || respRaw.tcl_res_nome || "",
      ),
      responsibleDocument: formatCpf(
        company.responsible_document || respRaw.cli_res_cpf || respRaw.tcl_res_cpf || "",
      ),
      responsibleRg: String(respRaw.cli_res_rg || respRaw.tcl_res_rg || ""),
      responsibleAddress: String(respRaw.cli_res_endereco || respRaw.tcl_res_endereco || ""),
      responsibleNumber: String(respRaw.cli_res_numero || respRaw.tcl_res_numero || ""),
      responsibleComplement: String(
        respRaw.cli_res_complemento || respRaw.tcl_res_complemento || "",
      ),
      responsibleNeighborhood: String(respRaw.cli_res_bairro || respRaw.tcl_res_bairro || ""),
      responsibleCity: normalizeCityName(
        String(respRaw.cli_res_cidade || respRaw.tcl_res_cidade || ""),
      ),
      responsibleState: String(respRaw.cli_res_uf || respRaw.tcl_res_uf || "").toUpperCase(),
      responsiblePostalCode: formatCep(respRaw.cli_res_cep || respRaw.tcl_res_cep || ""),
      accountantOffice: String(
        ctdRaw.cli_ctd_nome || ctdRaw.tcl_ctd_nome || company.accountant_name || "",
      ),
      accountantName: String(ctdRaw.cli_ctd_res || ctdRaw.tcl_ctd_res || ""),
      accountantPhone: String(
        ctdRaw.cli_ctd_tel || ctdRaw.tcl_ctd_tel || company.accountant_phone || "",
      ),
      accountantEmail: String(
        ctdRaw.cli_ctd_email || ctdRaw.tcl_ctd_email || company.accountant_email || "",
      ),
      sourcePayload: payload,
    };
  };
  const groupCompanies = rawGroupCompanies.map(mapCompany);
  const rawCurrentCompanies = Array.isArray(data.companies) ? data.companies : [];
  const currentCompanies =
    rawCurrentCompanies.length > 0
      ? rawCurrentCompanies
      : rawGroupCompanies.filter(
          (company: Record<string, unknown>) =>
            String(company.client_acronym || "").toUpperCase() === acronym.toUpperCase(),
        );
  const companies = currentCompanies.map(mapCompany);

  const users = (Array.isArray(data.users) ? data.users : []).map(
    (user: Record<string, unknown>): ClientHadronUser => ({
      id: String(user.id || ""),
      name: String(user.name || ""),
      email: String(user.email || ""),
      operator: String(user.operator || ""),
      role: String(user.role || ""),
      status: String(user.status || ""),
      active: user.active !== false,
      createdAt: date(user.crm_created_at, true),
      updatedAt: date(user.crm_updated_at || user.crm_created_at, true),
    }),
  );

  const terminals = (Array.isArray(data.terminals) ? data.terminals : []).map(
    (terminal: Record<string, unknown>): ClientTerminal => ({
      id: String(terminal.id || ""),
      companyNumber: typeof terminal.company_number === "number" ? terminal.company_number : null,
      terminalNumber:
        typeof terminal.terminal_number === "number" ? terminal.terminal_number : null,
      ipAddress: String(terminal.ip_address || ""),
      installPath: String(terminal.install_path || ""),
      version: String(terminal.hadron_version || ""),
      versionDate: legacyDate(terminal.version_released_at),
      serialNumber: String(terminal.serial_number || ""),
      flags: String(terminal.legacy_flags || ""),
      operatingSystem: String(terminal.operating_system || ""),
      operatingSystemVersion: String(terminal.operating_system_version || ""),
      emitsNfe: typeof terminal.emits_nfe === "boolean" ? terminal.emits_nfe : null,
      notesIssued: Number(terminal.notes_issued || 0),
      memoryUsed: String(terminal.memory_used_mb ?? ""),
      memoryTotal: String(terminal.memory_total_mb ?? ""),
      certificateType: String(terminal.certificate_type || ""),
      certificateExpiresAt: date(terminal.certificate_expires_at),
      environment: String(terminal.environment || ""),
      drives: Array.isArray(terminal.drives) ? terminal.drives : [],
      registeredAt: legacyDate(terminal.registered_at, true),
      updatedAt: date(terminal.updated_at, true),
    }),
  );

  const hadronInfo = (Array.isArray(hadronInfoData) ? hadronInfoData : []).map(
    (info: Record<string, unknown>): ClientHadronInfo => ({
      id: String(info.id || ""),
      companyNumber: typeof info.company_number === "number" ? info.company_number : null,
      branchNumber: typeof info.branch_number === "number" ? info.branch_number : null,
      companyDescription: String(info.company_description || ""),
      terminalNumber: typeof info.terminal_number === "number" ? info.terminal_number : null,
      versionDate: legacyDate(info.version_released_at),
      operatingSystem: String(info.operating_system || ""),
      operatingSystemVersion: String(info.operating_system_version || ""),
      emitsNfe: info.emits_nfe === true,
      notesIssued: Number(info.notes_issued || 0),
      memoryUsed: String(info.memory_used ?? ""),
      memoryTotal: String(info.memory_total ?? ""),
      drives: Array.isArray(info.drives) ? (info.drives as ClientHadronInfo["drives"]) : [],
      certificateType: String(info.certificate_type || ""),
      certificateExpiresAt: legacyDate(info.certificate_expires_at),
      environment: String(info.environment || ""),
      totalIncompatible:
        typeof info.total_incompatible === "number" ? info.total_incompatible : null,
      registeredAt: date(info.registered_at, true),
      updatedAt: date(info.technical_updated_at, true),
    }),
  );

  const modules = (Array.isArray(data.modules) ? data.modules : []).map(
    (module: Record<string, unknown>): ClientModule => ({
      id: String(module.id || ""),
      name: String(module.name || ""),
      contracted: module.contracted !== false,
      version: String(module.version || ""),
    }),
  );

  const internetData = (data.internet || {}) as Record<string, unknown>;
  const mapInternetDevice = (
    device: Record<string, unknown>,
    contractLegacyId = "",
  ): ClientInternetDevice => ({
    id: String(device.id || ""),
    legacyId: String(device.legacy_id || ""),
    contractLegacyId: String(device.auth_contratos_id_con || contractLegacyId),
    deviceUuid: String(device.device_uuid || ""),
    user: String(device.utilizador || ""),
    representativeCode: String(device.codrep || ""),
    type: String(device.tipo || ""),
    system: String(device.sistema || ""),
    status: String(device.status || ""),
    active: device.active !== false,
    appType: String(device.app_type || ""),
    buildVersion: String(device.build_version || ""),
    dbVersion: String(device.db_version || ""),
    lastCheckedAt: date(device.last_checked_at, true),
    updatedAt: date(device.updated_at, true),
  });

  const contracts = (Array.isArray(internetData.contracts) ? internetData.contracts : []).map(
    (contract: Record<string, unknown>): ClientInternetContract => {
      const devices = (Array.isArray(contract.devices) ? contract.devices : []).map(
        (device: Record<string, unknown>): ClientInternetDevice =>
          mapInternetDevice(device, String(contract.legacy_id || "")),
      );

      return {
        id: String(contract.id || ""),
        legacyId: String(contract.legacy_id || ""),
        contractKey: String(contract.contract_key || ""),
        name: String(contract.name || ""),
        webUrl: String(contract.web_url || ""),
        databaseName: String(contract.database_name || ""),
        serverHost: String(contract.server_host || ""),
        status: String(contract.status || ""),
        active: contract.active !== false,
        startsAt: date(contract.starts_at),
        expiresAt: date(contract.expires_at),
        updatedAt: date(contract.updated_at, true),
        sourcePayload: parseJsonField(contract.source_payload),
        devices,
      };
    },
  );
  const directDevices = (Array.isArray(internetData.devices) ? internetData.devices : []).map(
    (device: Record<string, unknown>) => mapInternetDevice(device),
  );
  const devices = directDevices.length
    ? directDevices
    : contracts.flatMap((contract) => contract.devices);

  const applications = (
    Array.isArray(internetData.applications) ? internetData.applications : []
  ).map((app: Record<string, unknown>): ClientInternetApplication => ({
    id: String(app.id || ""),
    legacyId: String(app.legacy_id || ""),
    contractLegacyId: String(app.contract_legacy_id || ""),
    name: String(app.name || ""),
    appType: String(app.app_type || ""),
    version: String(app.version || ""),
    status: String(app.status || ""),
    active: app.active !== false,
    updatedAt: date(app.updated_at, true),
  }));

  const anyActiveContract = contracts.some((c) => c.active);
  const internet: ClientInternet = {
    hasActiveContract: internetData.has_active_contract === true || anyActiveContract,
    hasDevices: internetData.has_devices === true || devices.length > 0,
    devices,
    contracts,
    applications,
  };

  const tickets = (Array.isArray(data.tickets) ? data.tickets : []).map(
    (ticket: Record<string, unknown>): ClientTicket => ({
      id: String(ticket.id || ""),
      protocol: String(ticket.protocol || ""),
      subject: String(ticket.subject || ""),
      module: String(ticket.module || ""),
      submodule: String(ticket.submodule || ""),
      operator: String(ticket.operator || ""),
      priority: String(ticket.priority || ""),
      status: String(ticket.status || ""),
      createdAt: date(ticket.created_at, true),
      createdAtIso: String(ticket.created_at || ""),
      updatedAt: date(ticket.updated_at || ticket.created_at, true),
    }),
  );

  const events = (Array.isArray(clientEventData) ? clientEventData : []).map(
    (event: Record<string, unknown>): ClientEvent => ({
      id: String(event.id || ""),
      title: String(event.title || ""),
      description: String(event.description || ""),
      kind: String(event.kind || ""),
      startsAt: date(event.starts_at, true),
      startsAtIso: String(event.starts_at || ""),
      endsAt: date(event.ends_at, true),
      operator: String(event.operator || ""),
      origin: String(event.origin || ""),
      status: String(event.status || ""),
      ticketProtocol: String(event.ticket_protocol || ""),
      legacyTicketId: String(event.legacy_ticket_id || ""),
    }),
  );

  const activities = (Array.isArray(activityData) ? activityData : []).map(
    (activity: Record<string, unknown>): ClientTicketActivity => ({
      id: String(activity.id || ""),
      ticketId: String(activity.ticket_id || ""),
      protocol: String(activity.protocol || ""),
      subject: String(activity.subject || ""),
      eventType: String(activity.event_type || ""),
      title: String(activity.title || ""),
      description: String(activity.description || ""),
      actor: String(activity.actor || ""),
      occurredAt: date(activity.occurred_at, true),
      occurredAtIso: String(activity.occurred_at || ""),
    }),
  );

  const parameters = (Array.isArray(parameterData) ? parameterData : []).map(
    (parameter: Record<string, unknown>): ClientParameter => {
      const optionData = parseJsonField(parameter.option_data);
      return {
        id: String(parameter.id || ""),
        legacyId: String(parameter.legacy_id || ""),
        parameterLegacyId: String(parameter.parameter_legacy_id || ""),
        optionLegacyId: String(parameter.option_legacy_id || ""),
        signature: String(parameter.signature || ""),
        optionData: String(optionData.raw || parameter.option_data || ""),
        authUserLegacyId: String(parameter.auth_user_legacy_id || ""),
        signedBy: String(parameter.signed_by || ""),
        operator: String(parameter.operator || ""),
        createdAt: date(parameter.created_at, true),
        updatedAt: date(parameter.updated_at, true),
      };
    },
  );

  const rawLogs = (logData || {}) as Record<string, unknown>;
  const logs: ClientLogs = {
    authorized: rawLogs.authorized === true,
    logs: (Array.isArray(rawLogs.logs) ? rawLogs.logs : []).map(
      (log: Record<string, unknown>): ClientHadronLog => ({
        id: String(log.id || log.legacy_id || ""),
        level: String(log.level || ""),
        terminalCode: String(log.terminal_code || ""),
        operation: String(log.operation || ""),
        operatorCode: String(log.new_operator_code || log.previous_operator_code || ""),
        parentOption: String(log.parent_option || ""),
        childOption: String(log.child_option || ""),
        serialNumber: String(log.serial_number || ""),
        userCode: String(log.user_code || ""),
        ipAddress: String(log.ip_address || ""),
        occurredAt: date(log.crm_created_at, true),
      }),
    ),
    externalLogs: (Array.isArray(rawLogs.external_logs) ? rawLogs.external_logs : []).map(
      (log: Record<string, unknown>): ClientExternalLog => ({
        id: String(log.id || log.legacy_id || ""),
        action: String(log.action || ""),
        controller: String(log.controller || ""),
        operator: String(log.operator || ""),
        agent: String(log.agent || ""),
        device: String(log.device || ""),
        ipAddress: String(log.ip_address || ""),
        url: String(log.url || ""),
        info: String(log.info || ""),
        occurredAt: date(log.crm_created_at, true),
      }),
    ),
  };

  return {
    client: mapDatabaseClient(data.client),
    contacts,
    companies,
    groupCompanies,
    users,
    terminals,
    hadronInfo,
    modules,
    internet,
    tickets,
    events,
    activities,
    parameters,
    logs,
  };
}
