import { supabase } from "./supabase";
export type Accountant = {
  id: string;
  name: string;
  office: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  responsible_name?: string | null;
  responsible_document?: string | null;
  responsible_rg?: string | null;
  address?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  clientCount?: number;
};
export async function listAccountants() {
  const { data, error } = await supabase
    .from("crm_accountants")
    .select("*,crm_accountant_clients(client_company_id)")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    clientCount: Array.isArray(row.crm_accountant_clients) ? row.crm_accountant_clients.length : 0,
  })) as Accountant[];
}
export async function createAccountant(input: Omit<Accountant, "id">) {
  const { data, error } = await supabase.from("crm_accountants").insert(input).select("*").single();
  if (error) throw error;
  return data as Accountant;
}

export async function getAccountant(id: string) {
  const { data, error } = await supabase
    .from("crm_accountants")
    .select("*,crm_accountant_clients(client_company_id)")
    .eq("id", id)
    .single();
  if (error) throw error;
  const links = Array.isArray((data as any)?.crm_accountant_clients)
    ? (data as any).crm_accountant_clients
    : [];
  const clientIds = links.map((row: any) => String(row.client_company_id));
  let clients: any[] = [];
  if (clientIds.length) {
    const result = await supabase.rpc("get_crm_client_companies_by_ids", { ids: clientIds });
    if (result.error) throw result.error;
    clients = result.data ?? [];
    const detailed = await supabase
      .from("client_companies")
      .select("*")
      .or(`id.in.(${clientIds.join(",")}),client_id.in.(${clientIds.join(",")})`);
    if (detailed.error) throw detailed.error;
    const detailsById = new Map(
      (detailed.data ?? []).flatMap((client: any) => [
        [String(client.id), client],
        [String(client.client_id), client],
      ]),
    );
    clients = clients.map((client: any) => ({
      ...client,
      ...detailsById.get(String(client.id)),
    }));
  }
  const row = data as any;
  const parse = (value: any) => {
    if (value && typeof value === "object") return value;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return {};
  };
  const payload = parse(row.source_payload);
  const responsible = parse(payload.tcl_responsavel ?? payload.cli_responsavel);
  let linkedResponsible: any = {};
  if (clientIds.length) {
    const linked = await supabase
      .from("client_companies")
      .select("responsible_name,responsible_document,source_payload")
      .in("id", clientIds)
      .limit(1)
      .maybeSingle();
    if (linked.error) throw linked.error;
    const linkedPayload = parse(linked.data?.source_payload);
    linkedResponsible = {
      ...(linked.data ?? {}),
      ...parse(linkedPayload.tcl_responsavel ?? linkedPayload.cli_responsavel),
    };
  }
  const value = (current: any, ...fallbacks: string[]) =>
    current ||
    fallbacks.map((key) => responsible[key]).find(Boolean) ||
    fallbacks.map((key) => linkedResponsible[key]).find(Boolean) ||
    null;
  return {
    ...row,
    responsible_name: value(row.responsible_name, "tcl_res_nome", "cli_res_nome"),
    responsible_document: value(row.responsible_document, "tcl_res_cpf", "cli_res_cpf"),
    responsible_rg: value(row.responsible_rg, "tcl_res_rg", "cli_res_rg"),
    clientIds,
    clients,
  } as Accountant & { clientIds: string[]; clients: any[] };
}
