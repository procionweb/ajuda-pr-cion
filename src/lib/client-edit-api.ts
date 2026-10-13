import { supabase } from "@/lib/supabase";
import type { ListingContext } from "@/lib/client-listing-rules";
export type EditableRow = Record<string, unknown> & {
  id: string;
  source_payload: Record<string, unknown>;
};
export type ClientEditData = {
  client: EditableRow;
  companies: EditableRow[];
  contacts: EditableRow[];
};
export async function loadClientListingContext(): Promise<ListingContext[]> {
  const { data, error } = await supabase.rpc("get_crm_client_listing_context" as never);
  if (error) throw error;
  return (data ?? []) as unknown as ListingContext[];
}
export async function loadClientEditData(acronym: string): Promise<ClientEditData> {
  const { data, error } = await supabase.rpc(
    "get_crm_client_edit_data" as never,
    { p_acronym: acronym } as never,
  );
  if (error) throw error;
  return data as unknown as ClientEditData;
}
export async function saveClientEdit(
  acronym: string,
  companyId: string | null,
  patch: Record<string, unknown>,
  source: Record<string, unknown>,
  contacts?: EditableRow[],
) {
  const { error } = await supabase.rpc(
    "save_crm_client_edit" as never,
    {
      p_acronym: acronym,
      p_company_id: companyId,
      p_patch: patch,
      p_source_patch: source,
      p_contacts: contacts ?? null,
    } as never,
  );
  if (error) throw error;
}
