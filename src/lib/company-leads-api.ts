import { supabase } from "@/lib/supabase";

export type CompanyLeadStage =
  | "novo"
  | "prospeccao"
  | "relacionamento"
  | "proposta"
  | "negociacao"
  | "demonstracao"
  | "negocio_fechado"
  | "sem_interesse";

export type CompanyLead = {
  id: string;
  cnpj: string;
  legal_name: string;
  trade_name: string | null;
  search_alias?: string | null;
  matched_cnaes?: Array<{ code: string; description: string }>;
  is_client?: boolean;
  existing_client_id?: string | null;
  existing_client_company_id?: string | null;
  opened_at: string | null;
  registration_status: string;
  cnae_code: string | null;
  cnae_description: string | null;
  company_size: string | null;
  legal_nature: string | null;
  city: string;
  state: string;
  address: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  mei: boolean;
  simples: boolean;
  tax_regime: string | null;
  tax_regime_year?: string | null;
  tax_regime_source?: string | null;
  relevance_score: number;
  stage: CompanyLeadStage;
  assigned_to?: string | null;
  last_modified_by?: string | null;
  notes?: string | null;
  source: string;
  source_url: string | null;
  discovered_at: string;
};

export type CompanyLeadPartner = {
  id: string;
  name: string;
  type: string;
  qualification: string | null;
  joined_at: string | null;
  country: string | null;
};

export type CompanyLeadDetails = CompanyLead & {
  commercial_data?: Record<string, string | number | boolean | null>;
  conversion_data?: Record<string, unknown>;
  conversion_status?: string | null;
  inactivation_reason?: string | null;
  company_root: string | null;
  branch_type: string | null;
  secondary_cnaes: string[];
  phone_secondary: string | null;
  website: string | null;
  additional_phones: Array<{ phone: string; source: string; source_url: string }>;
  additional_emails: Array<{ email: string; source: string; source_url: string }>;
  fax: string | null;
  capital_social: number | null;
  responsible_qualification: string | null;
  special_status: string | null;
  special_status_at: string | null;
  simple_opted_at: string | null;
  simple_excluded_at: string | null;
  mei_opted_at: string | null;
  mei_excluded_at: string | null;
  partners: CompanyLeadPartner[];
};

export type CompanyLeadSort =
  | "company"
  | "cnpj"
  | "opened_at"
  | "registration_status"
  | "city"
  | "cnae"
  | "company_size"
  | "phone"
  | "score"
  | "stage";

export type CompanyLeadFilters = {
  city: string;
  state: string;
  openedWithinDays: number;
  cnae: string;
  cnaeDescription?: string;
  companyName?: string;
  cnpj?: string;
  companySize: string;
  taxRegime?: string;
  registrationStatus?: string;
  stage?: string;
  minScore?: string;
  openedFrom?: string;
  openedTo?: string;
  hasPhone?: boolean;
  hasEmail?: boolean;
  onlyMei?: boolean;
  onlySimples?: boolean;
};

export type CompanyLeadsQuery = {
  filters: CompanyLeadFilters;
  sort: CompanyLeadSort;
  direction: "asc" | "desc";
  limit: number;
  offset: number;
};

type LeadsResponse = {
  leads: CompanyLead[];
  total: number;
  totalCapped: boolean;
  source: string;
};

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function buildFilterPayload(filters: CompanyLeadFilters) {
  const openedFrom =
    filters.openedFrom?.trim() ||
    (filters.openedWithinDays ? daysAgo(filters.openedWithinDays) : "");

  return {
    city: filters.city.trim(),
    state: filters.state.trim().toUpperCase(),
    openedFrom: openedFrom || null,
    openedTo: filters.openedTo?.trim() || null,
    cnae: filters.cnae?.trim() || null,
    cnaeDescription: filters.cnaeDescription?.trim() || null,
    companyName: filters.companyName?.trim() || null,
    cnpj: filters.cnpj?.replace(/\D/g, "") || null,
    companySize: filters.companySize?.trim() || null,
    taxRegime: filters.taxRegime?.trim() || null,
    registrationStatus: filters.registrationStatus?.trim() || null,
    stage: filters.stage?.trim() || null,
    minScore: filters.minScore?.toString().trim() || null,
    hasPhone: Boolean(filters.hasPhone),
    hasEmail: Boolean(filters.hasEmail),
    onlyMei: Boolean(filters.onlyMei),
    onlySimples: Boolean(filters.onlySimples),
  };
}

export const companyLeadsApi = {
  async list(query: CompanyLeadsQuery): Promise<LeadsResponse> {
    let { data, error } = await supabase.rpc("company_leads_search", {
      p_filters: buildFilterPayload(query.filters),
      p_sort: query.sort,
      p_direction: query.direction,
      p_limit: query.limit,
      p_offset: query.offset,
    });
    if (error?.code === "PGRST202") {
      const legacyResult = await supabase.rpc("company_leads_search", {
        p_filters: buildFilterPayload(query.filters),
        p_sort_key: query.sort,
        p_sort_dir: query.direction,
        p_limit: query.limit,
        p_offset: query.offset,
      });
      data = legacyResult.data;
      error = legacyResult.error;
    }
    if (error) {
      throw new Error(
        [error.message, error.details, error.hint].filter(Boolean).join(" ") ||
          "Falha ao procurar empresas.",
      );
    }
    const payload = (data || {}) as {
      rows?: CompanyLead[];
      total?: number;
      total_capped?: boolean;
    };
    return {
      leads: payload.rows || [],
      total: Number(payload.total || 0),
      totalCapped: Boolean(payload.total_capped),
      source: "Dados públicos do CNPJ/Receita Federal",
    };
  },

  async details(id: string): Promise<CompanyLeadDetails> {
    const { data, error } = await supabase.rpc("company_lead_details", { p_id: id });
    if (error) throw error;
    if (!data) throw new Error("Lead não encontrado.");
    return data as CompanyLeadDetails;
  },

  async countInProgress(filters: CompanyLeadFilters) {
    const activeStages: CompanyLeadStage[] = [
      "prospeccao",
      "relacionamento",
      "proposta",
      "negociacao",
      "demonstracao",
    ];
    const results = await Promise.all(
      activeStages.map((stage) =>
        this.list({
          filters: { ...filters, stage },
          sort: "stage",
          direction: "asc",
          limit: 1,
          offset: 0,
        }),
      ),
    );
    return results.reduce((sum, result) => sum + result.total, 0);
  },

  async enrichContacts(id: string): Promise<{
    lead: CompanyLeadDetails;
    cached: boolean;
    statistics: { phones: number; emails: number; website: boolean };
  }> {
    const { data, error } = await supabase.functions.invoke("company-lead-enrich", {
      body: { leadId: id },
    });
    if (error) throw error;
    if (!data?.lead) throw new Error(data?.error || "Não foi possível buscar novos contatos.");
    return data;
  },

  async updateStage(id: string, stage: CompanyLeadStage, actor: string) {
    let { error } = await supabase.rpc("company_leads_update_stage", {
      p_id: id,
      p_stage: stage,
      p_actor: actor,
    });
    if (error?.code === "PGRST202") {
      const legacyResult = await supabase.rpc("company_leads_update_stage", {
        p_id: id,
        p_stage: stage,
      });
      error = legacyResult.error;
    }
    if (error) throw error;
    return { success: true };
  },

  async updateCommercial(
    id: string,
    input: { stage: CompanyLeadStage; assignedTo?: string; notes?: string },
  ) {
    const { data, error } = await supabase.rpc("company_leads_update_commercial", {
      p_id: id,
      p_stage: input.stage,
      p_assigned_to: input.assignedTo?.trim() || null,
      p_notes: input.notes?.trim() || null,
    });
    if (error) throw error;
    if (!data) throw new Error("Lead não encontrado.");
    return data as CompanyLeadDetails;
  },

  async saveAction(
    id: string,
    action: "edit" | "inactivate" | "close_deal",
    payload: Record<string, unknown>,
    finalize = false,
    actor = "PRCREN",
  ) {
    const { data, error } = await supabase.rpc("company_leads_save_action", {
      p_id: id,
      p_action: action,
      p_payload: { ...payload, _actor: actor },
      p_finalize: finalize,
    });
    if (error) throw error;
    if (!data) throw new Error("Lead não encontrado.");
    return data as CompanyLeadDetails;
  },
};
