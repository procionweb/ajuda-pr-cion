import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-service-slug",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });

type ChartPoint = { time: string; reports: number };
type ReportedFailure = { label: string; percent: number; reports?: number };
const BUCKET = "crm-monitoring";

function validChartPoint(value: unknown): value is ChartPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.time === "string" &&
    point.time.length <= 20 &&
    typeof point.reports === "number" &&
    Number.isFinite(point.reports) &&
    point.reports >= 0
  );
}

function validFailure(value: unknown): value is ReportedFailure {
  if (!value || typeof value !== "object") return false;
  const failure = value as Record<string, unknown>;
  return (
    typeof failure.label === "string" &&
    failure.label.length > 0 &&
    failure.label.length <= 100 &&
    typeof failure.percent === "number" &&
    Number.isFinite(failure.percent) &&
    failure.percent >= 0 &&
    failure.percent <= 100 &&
    (failure.reports === undefined ||
      (typeof failure.reports === "number" &&
        Number.isFinite(failure.reports) &&
        failure.reports >= 0))
  );
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!["GET", "POST"].includes(request.method)) {
    return respond({ error: "Método não permitido." }, 405);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Não autenticado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "Sessão inválida." }, 401);

  if (request.method === "GET") {
    const serviceSlug = request.headers.get("x-service-slug") ?? "sefaz";
    if (!/^[a-z0-9-]+$/.test(serviceSlug)) return respond({ error: "Serviço inválido." }, 400);
    const { data, error } = await admin.storage
      .from(BUCKET)
      .download(`downdetector/${serviceSlug}/latest.json`);
    if (error) {
      if (/not found|does not exist/i.test(error.message)) return respond({ snapshot: null });
      return respond({ error: error.message }, 500);
    }
    return respond({ snapshot: JSON.parse(await data.text()) });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role,active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!profile?.active || !["admin", "support", "specialist"].includes(profile.role)) {
    return respond({ error: "Apenas a equipe pode enviar coletas." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "JSON inválido." }, 400);
  }

  const serviceSlug = typeof body.serviceSlug === "string" ? body.serviceSlug : "sefaz";
  const statusText = body.statusText;
  const sourceUrl = body.sourceUrl;
  const collectedAt = body.collectedAt;
  const chartPoints = body.chartPoints;
  const reportedFailures = body.reportedFailures;

  if (
    !/^[a-z0-9-]+$/.test(serviceSlug) ||
    typeof statusText !== "string" ||
    statusText.length === 0 ||
    statusText.length > 240 ||
    sourceUrl !== "https://downdetector.com.br/fora-do-ar/sefaz/" ||
    typeof collectedAt !== "string" ||
    Number.isNaN(Date.parse(collectedAt)) ||
    !Array.isArray(chartPoints) ||
    chartPoints.length < 2 ||
    chartPoints.length > 200 ||
    !chartPoints.every(validChartPoint) ||
    !Array.isArray(reportedFailures) ||
    reportedFailures.length < 1 ||
    reportedFailures.length > 10 ||
    !reportedFailures.every(validFailure)
  ) {
    return respond({ error: "Snapshot inválido." }, 400);
  }

  const snapshot = {
    id: Date.now(),
    serviceSlug,
    statusText,
    sourceUrl,
    collectedAt: new Date(collectedAt).toISOString(),
    chartPoints,
    reportedFailures,
  };
  const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 262_144,
    allowedMimeTypes: ["application/json"],
  });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    return respond({ error: bucketError.message }, 500);
  }
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(`downdetector/${serviceSlug}/latest.json`, JSON.stringify(snapshot), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) return respond({ error: error.message }, 500);
  return respond({ snapshot: { id: snapshot.id, collectedAt: snapshot.collectedAt } }, 201);
});
