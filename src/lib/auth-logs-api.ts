import { supabase } from "./supabase";

export type AuthLogRow = {
  id: string;
  controller: string | null;
  action: string | null;
  clientAcronym: string | null;
  url: string | null;
  info: string | null;
  operator: string | null;
  ipAddress: string | null;
  device: string | null;
  createdAt: string | null;
};

export type AuthLogsPage = {
  rows: AuthLogRow[];
  total: number;
  controllers: string[];
};

type RawRow = {
  id: string;
  controller: string | null;
  action: string | null;
  client_acronym: string | null;
  url: string | null;
  info: string | null;
  operator: string | null;
  ip_address: string | null;
  device?: string | null;
  crm_created_at: string | null;
};

export async function listAuthLogs(
  options: {
    search?: string;
    controller?: string;
    acronym?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AuthLogsPage> {
  const { data, error } = await supabase.rpc("list_auth_logs", {
    search: options.search ?? null,
    controller_filter: options.controller ?? null,
    acronym_filter: options.acronym ?? null,
    page_limit: options.limit ?? 6,
    page_offset: options.offset ?? 0,
  });
  if (error) throw error;

  const payload = (data ?? {}) as {
    rows?: RawRow[];
    total?: number;
    controllers?: string[];
  };

  return {
    total: payload.total ?? 0,
    controllers: Array.isArray(payload.controllers) ? payload.controllers : [],
    rows: (payload.rows ?? []).map((row) => ({
      id: row.id,
      controller: row.controller,
      action: row.action,
      clientAcronym: row.client_acronym,
      url: row.url,
      info: row.info,
      operator: row.operator,
      ipAddress: row.ip_address,
      device: row.device ?? null,
      createdAt: row.crm_created_at,
    })),
  };
}

type HadronLogRow = {
  id: string;
  client_acronym: string | null;
  ip_address: string | null;
  level: string | null;
  terminal_code: string | null;
  operation: string | null;
  new_operation_id: string | null;
  new_operator_code: string | null;
  parent_option: string | null;
  child_option: string | null;
  serial_number: string | null;
  user_code: string | null;
  previous_operation_id: string | null;
  previous_operator_code: string | null;
  crm_created_at: string | null;
};

export async function listHadronLogs(
  options: {
    search?: string;
    operation?: string;
    option?: string;
    acronym?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AuthLogsPage> {
  let query = supabase
    .from("tab_hadron_logs")
    .select(
      "id,client_acronym,ip_address,level,terminal_code,operation,new_operation_id,new_operator_code,parent_option,child_option,serial_number,user_code,previous_operation_id,previous_operator_code,crm_created_at",
      { count: "exact" },
    );
  if (options.operation) query = query.eq("operation", options.operation);
  if (options.option) {
    const option = options.option.replace(/[^a-zA-Z0-9_-]/g, "");
    query = query.or(
      `parent_option.eq.${option},child_option.eq.${option}`,
    );
  }
  if (options.acronym) query = query.ilike("client_acronym", `%${options.acronym}%`);
  if (options.search) {
    const term = options.search.replace(/[,%()]/g, " ").trim();
    if (term) {
      query = query.or(
        `operation.ilike.%${term}%,client_acronym.ilike.%${term}%,terminal_code.ilike.%${term}%,new_operator_code.ilike.%${term}%,user_code.ilike.%${term}%,serial_number.ilike.%${term}%`,
      );
    }
  }
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, options.limit ?? 25);
  const { data, error, count } = await query
    .order("crm_created_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = (data ?? []) as HadronLogRow[];
  const operations = [...new Set(rows.map((row) => row.operation).filter(Boolean))] as string[];
  return {
    total: count ?? rows.length,
    controllers: operations.sort((a, b) => a.localeCompare(b, "pt-BR")),
    rows: rows.map((row) => ({
      id: row.id,
      controller: row.operation,
      action: row.level,
      clientAcronym: row.client_acronym,
      url: [row.previous_operation_id, row.new_operation_id].filter(Boolean).join(" → ") || null,
      info:
        [
          row.terminal_code && `Terminal ${row.terminal_code}`,
          row.parent_option && `Opção ${row.parent_option}`,
          row.child_option && `Subopção ${row.child_option}`,
          row.serial_number && `Série ${row.serial_number}`,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      operator: row.new_operator_code || row.previous_operator_code || row.user_code,
      ipAddress: row.ip_address,
      device: row.terminal_code,
      createdAt: row.crm_created_at,
    })),
  };
}

export type ConfigurationAuthLogsPage = {
  rows: AuthLogRow[];
  total: number;
  operators: string[];
};

export async function listConfigurationAuthLogs(
  options: {
    search?: string;
    operator?: string;
    acronym?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ConfigurationAuthLogsPage> {
  const { data, error } = await supabase.rpc("configuration_auth_logs_list", {
    search_filter: options.search || null,
    operator_filter: options.operator || null,
    acronym_filter: options.acronym || null,
    from_filter: options.from || null,
    to_filter: options.to || null,
    page_limit: options.limit ?? 25,
    page_offset: options.offset ?? 0,
  });
  if (error) throw error;

  const payload = (data ?? {}) as {
    rows?: RawRow[];
    total?: number;
    operators?: string[];
  };

  return {
    total: payload.total ?? 0,
    operators: Array.isArray(payload.operators) ? payload.operators : [],
    rows: (payload.rows ?? []).map((row) => ({
      id: row.id,
      controller: row.controller,
      action: row.action,
      clientAcronym: row.client_acronym,
      url: row.url,
      info: row.info,
      operator: row.operator,
      ipAddress: row.ip_address,
      device: row.device ?? null,
      createdAt: row.crm_created_at,
    })),
  };
}

export async function listHadronOptionLogs(optionId: string, limit = 2147483647) {
  return (await listHadronLogs({ option: optionId, limit })).rows;
}

export async function recordHadronOptionLog(optionId: string, action: string, info: string) {
  const { error } = await supabase.rpc("record_hadron_option_log", {
    p_option_id: optionId,
    p_action: action,
    p_info: info,
  });
  if (error) return false;
  window.dispatchEvent(new CustomEvent("hadron-option-log-created", { detail: optionId }));
  return true;
}

/** dd/MM/aa HH:mm */
export function formatLogDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(", ", " ");
}
