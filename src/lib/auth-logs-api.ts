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
