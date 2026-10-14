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
  internet?: { status: number | null; devices: number | null };
  webApps?: string[];
  applications?: Array<{ type: string; name: string }>;
};
export async function loadClientListingContext(): Promise<ListingContext[]> {
  const { data, error } = await supabase.rpc("get_crm_client_listing_context" as never);
  if (error) throw error;
  return (data ?? []) as unknown as ListingContext[];
}
export async function loadClientEditData(
  acronym: string,
  companyId?: string,
): Promise<ClientEditData> {
  const { data, error } = await supabase.rpc(
    "get_crm_client_edit_data_v2" as never,
    { p_acronym: acronym, p_company_id: companyId ?? null } as never,
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
  webApps?: string[],
  internet?: { status: number; devices: number | null },
) {
  const { error } = await supabase.rpc(
    "save_crm_client_edit_v3" as never,
    {
      p_acronym: acronym,
      p_company_id: companyId,
      p_patch: patch,
      p_source_patch: source,
      p_contacts: contacts ?? null,
      p_web_apps: webApps ?? null,
      p_internet: internet ?? null,
    } as never,
  );
  if (error) throw error;
}
