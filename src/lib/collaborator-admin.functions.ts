import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const collaboratorIdSchema = z.object({ id: z.string().uuid() });

const collaboratorPayloadSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  operator_acronym: z.string().nullable(),
  operator_code: z.string().nullable(),
  active: z.boolean(),
  department: z.string().nullable(),
  job_title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  personal_mobile: z.string().nullable(),
  business_mobile: z.string().nullable(),
  birth_date: z.string().nullable(),
  cpf: z.string().nullable(),
  pis: z.string().nullable(),
  work_card: z.string().nullable(),
  admitted_at: z.string().nullable(),
  terminated_at: z.string().nullable(),
  driver_license_type: z.string().nullable(),
  driver_license_expires_at: z.string().nullable(),
});

const detailColumns = [
  "id", "legacy_id", "first_name", "last_name", "full_name", "email",
  "clb_departamento", "job_title", "operator_acronym", "operator_code", "active",
  "phone", "personal_mobile", "business_mobile", "birth_date", "cpf", "pis",
  "work_card", "admitted_at", "terminated_at", "driver_license_type",
  "driver_license_expires_at", "company_legacy_id", "source_created_at",
  "source_updated_at", "created_at", "updated_at",
].join(",");

function clean(value: string | null): string | null {
  const result = value?.trim() ?? "";
  return result || null;
}

export const getCollaboratorDetail = createServerFn({ method: "POST" })
  .validator((data) => collaboratorIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("tab_colaboradores")
      .select(detailColumns)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Colaborador não encontrado.");
    return {
      ...row,
      department: row.clb_departamento,
      company_name: "Prócion Informática Ltda",
      created_at: row.source_created_at ?? row.created_at,
      updated_at: row.source_updated_at ?? row.updated_at,
    };
  });

export const saveCollaboratorDetail = createServerFn({ method: "POST" })
  .validator((data) => collaboratorPayloadSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const firstName = clean(data.first_name);
    const lastName = clean(data.last_name);
    const { error } = await (supabaseAdmin as any)
      .from("tab_colaboradores")
      .update({
        first_name: firstName,
        last_name: lastName,
        full_name: clean([firstName, lastName].filter(Boolean).join(" ")),
        operator_acronym: clean(data.operator_acronym)?.toUpperCase() ?? null,
        operator_code: clean(data.operator_code),
        active: data.active,
        clb_departamento: clean(data.department),
        job_title: clean(data.job_title),
        email: clean(data.email)?.toLowerCase() ?? null,
        phone: clean(data.phone),
        personal_mobile: clean(data.personal_mobile),
        business_mobile: clean(data.business_mobile),
        birth_date: clean(data.birth_date),
        cpf: clean(data.cpf),
        pis: clean(data.pis),
        work_card: clean(data.work_card),
        admitted_at: clean(data.admitted_at),
        terminated_at: clean(data.terminated_at),
        driver_license_type: clean(data.driver_license_type),
        driver_license_expires_at: clean(data.driver_license_expires_at),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const deactivateCollaborator = createServerFn({ method: "POST" })
  .validator((data) => collaboratorIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("tab_colaboradores")
      .update({
        active: false,
        terminated_at: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });
