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
  if (error) {
    throw new Error(
      `Não foi possível salvar o contador: ${error.message}${error.details ? ` (${error.details})` : ""}`,
    );
  }
  return data as Accountant;
}
export async function listAccountantClientOptions() {
  const { data, error } = await supabase
    .from("client_companies")
    .select("id,legal_name,trade_name,document,city,state")
    .order("trade_name");
  if (error) throw error;
  return data ?? [];
}
export async function linkAccountantClients(accountantId: string, clientIds: string[]) {
  if (!clientIds.length) return;
  const { error } = await supabase
    .from("crm_accountant_clients")
    .upsert(
      clientIds.map((client_company_id) => ({ accountant_id: accountantId, client_company_id })),
    );
  if (error) throw error;
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
    clients = clients.map((client: any) => {
      const merged = { ...client, ...detailsById.get(String(client.id)) };
      const source =
        merged.source_payload && typeof merged.source_payload === "object"
          ? merged.source_payload
          : {};
      return {
        ...merged,
        document: merged.document || source.tcl_cnpj || source.cli_cnpj || null,
        state_registration:
          merged.state_registration || source.tcl_ie || source.cli_insc_estadual || null,
        cnae: merged.cnae || source.tcl_cnae || source.cli_cnae || null,
      };
    });
  }
  return {
    ...(data as any),
    clientIds,
    clients,
  } as Accountant & { clientIds: string[]; clients: any[] };
}

export async function updateAccountant(
  id: string,
  input: Omit<Accountant, "id">,
  clientIds: string[],
) {
  const { error } = await supabase.rpc(
    "update_crm_accountant" as never,
    { p_id: id, p_data: input, p_clients: clientIds } as never,
  );
  if (error) throw new Error(error.message);
}
