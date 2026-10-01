import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-collector-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Source = {
  id: string;
  name: string;
  baseUrl: string;
  listingUrl: string;
  rssUrl?: string;
  linkPattern?: RegExp;
};

type Candidate = {
  source: Source;
  title: string;
  url: string;
  description?: string;
  imageUrl?: string;
  publishedAt?: string;
};

const SOURCES: Source[] = [
  {
    id: "receita-federal",
    name: "Receita Federal",
    baseUrl: "https://www.gov.br",
    listingUrl: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/ultimas-noticias",
    linkPattern: /\/receitafederal\/pt-br\/assuntos\/noticias\//,
  },
  {
    id: "sped",
    name: "Portal SPED",
    baseUrl: "https://www.gov.br",
    listingUrl: "https://www.gov.br/sped/pt-br",
    linkPattern: /\/sped\/pt-br\//,
  },
  {
    id: "nfe",
    name: "Portal Nacional NF-e",
    baseUrl: "https://www.nfe.fazenda.gov.br",
    listingUrl: "https://www.nfe.fazenda.gov.br/portal/informe.aspx?ehCTG=false",
    linkPattern: /\/portal\/informe\.aspx/i,
  },
  {
    id: "nfse",
    name: "Portal Nacional NFS-e",
    baseUrl: "https://www.gov.br",
    listingUrl: "https://www.gov.br/nfse/pt-br/noticias",
    linkPattern: /\/nfse\/pt-br\/noticias\//,
  },
  {
    id: "confaz",
    name: "CONFAZ",
    baseUrl: "https://www.confaz.fazenda.gov.br",
    listingUrl: "https://www.confaz.fazenda.gov.br/",
    linkPattern: /\/legislacao\/|\/publicacoes\//,
  },
  {
    id: "ministerio-fazenda",
    name: "Ministério da Fazenda",
    baseUrl: "https://www.gov.br",
    listingUrl: "https://www.gov.br/fazenda/pt-br/assuntos/noticias",
    linkPattern: /\/fazenda\/pt-br\/assuntos\/noticias\//,
  },
  {
    id: "dou",
    name: "Diário Oficial da União",
    baseUrl: "https://www.in.gov.br",
    listingUrl: "https://www.in.gov.br/consulta",
    linkPattern: /\/web\/dou\//,
  },
  {
    id: "sefaz-sp",
    name: "SEFAZ SP",
    baseUrl: "https://portal.fazenda.sp.gov.br",
    listingUrl: "https://portal.fazenda.sp.gov.br/Noticias",
    linkPattern: /\/Noticias\//i,
  },
  {
    id: "sefaz-mg",
    name: "SEFAZ MG",
    baseUrl: "https://www.fazenda.mg.gov.br",
    listingUrl: "https://www.fazenda.mg.gov.br/",
    linkPattern: /\/noticias\/\d{4}\//i,
  },
  {
    id: "sefaz-rs",
    name: "SEFAZ RS",
    baseUrl: "https://fazenda.rs.gov.br",
    listingUrl: "https://fazenda.rs.gov.br/noticias?classificacao=786",
    linkPattern: /\/conteudo\//i,
  },
];

const CATEGORY_RULES: Array<[string, string[], number]> = [
  ["Reforma Tributária", ["reforma tributaria", "reforma do consumo", "rtc"], 5],
  ["CBS", ["cbs", "contribuicao sobre bens e servicos"], 4],
  ["IBS", ["ibs", "imposto sobre bens e servicos"], 4],
  ["Imposto Seletivo", ["imposto seletivo"], 5],
  ["ICMS", ["icms"], 5],
  ["IPI", ["ipi", "imposto sobre produtos industrializados"], 4],
  ["PIS/COFINS", ["pis/cofins", "pis", "cofins"], 4],
  ["NF-e", ["nf-e", "nfe", "nota fiscal eletronica"], 5],
  ["NFC-e", ["nfc-e", "nfce"], 5],
  ["NFS-e", ["nfs-e", "nfse", "nota fiscal de servico"], 5],
  ["CT-e", ["ct-e", "cte", "conhecimento de transporte eletronico"], 5],
  ["MDF-e", ["mdf-e", "mdfe", "manifesto eletronico"], 5],
  ["SPED", ["sped", "sistema publico de escrituracao digital"], 5],
  ["EFD", ["efd", "escrituracao fiscal digital"], 4],
  ["ECD", ["ecd", "escrituracao contabil digital"], 4],
  ["ECF", ["ecf", "escrituracao contabil fiscal"], 4],
  ["eSocial", ["esocial", "e-social"], 4],
  ["MIT", ["modulo de inclusao de tributos", "mit"], 4],
  ["Simples Nacional", ["simples nacional", "mei", "das"], 4],
  [
    "Obrigações Acessórias",
    ["obrigacao acessoria", "dctfweb", "dirf", "reinf", "declaracao fiscal"],
    4,
  ],
];

const GENERAL_TERMS: Array<[string, number]> = [
  ["receita federal", 3],
  ["tribut", 3],
  ["fiscal", 3],
  ["imposto", 2],
  ["arrecadacao", 2],
  ["contribuinte", 1],
  ["sefaz", 2],
  ["nota tecnica", 2],
  ["legislacao", 1],
  ["decreto", 1],
  ["portaria", 1],
  ["instrucao normativa", 2],
];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const stripHtml = (value: string) =>
  decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

const absoluteUrl = (value: string, base: string) => {
  try {
    const url = new URL(decodeEntities(value), base);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach((key) =>
      url.searchParams.delete(key),
    );
    return url.toString();
  } catch {
    return "";
  }
};

const meta = (html: string, key: string) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  return patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) || "";
};

const discoverRss = (html: string, baseUrl: string) =>
  absoluteUrl(
    html.match(
      /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)/i,
    )?.[1] ||
      html.match(
        /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml/i,
      )?.[1] ||
      "",
    baseUrl,
  );

const isoDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

function classify(title: string, description: string, source: Source) {
  const normalizedTitle = normalize(title);
  const normalizedText = normalize(`${title} ${description}`);
  const matches: Array<{ category: string; score: number; keywords: string[] }> = [];

  for (const [category, keywords, weight] of CATEGORY_RULES) {
    const found = keywords.filter((keyword) => normalizedText.includes(keyword));
    if (!found.length) continue;
    const titleBonus = found.some((keyword) => normalizedTitle.includes(keyword)) ? 2 : 0;
    matches.push({ category, score: weight + titleBonus, keywords: found });
  }

  let score = Math.min(
    4,
    matches.reduce((total, item) => total + item.score, 0),
  );
  const generalKeywords: string[] = [];
  for (const [keyword, weight] of GENERAL_TERMS) {
    if (!normalizedText.includes(keyword)) continue;
    score += weight + (normalizedTitle.includes(keyword) ? 1 : 0);
    generalKeywords.push(keyword);
  }
  if (source.id === "sped" || source.id === "nfe" || source.id === "nfse") score += 2;

  matches.sort((a, b) => b.score - a.score);
  return {
    score,
    category: matches[0]?.category || "Obrigações Acessórias",
    categories: matches.map((item) => item.category),
    keywords: [...new Set([...matches.flatMap((item) => item.keywords), ...generalKeywords])],
  };
}

function summarize(value: string, title: string) {
  const clean = stripHtml(value).replace(title, "").trim();
  if (!clean) return title;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  return sentences.slice(0, 2).join(" ").trim().slice(0, 420);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ProcionFiscalNewsBot/1.0 (+https://ajudaprocion.lovable.app)",
      Accept: "text/html,application/xhtml+xml,application/rss+xml,application/xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return { text: await response.text(), contentType: response.headers.get("content-type") || "" };
}

function parseRss(xml: string, source: Source): Candidate[] {
  const entries = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];
  return entries.slice(0, 20).map((entry) => {
    const get = (tag: string) =>
      stripHtml(entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "");
    const link = entry.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || get("link") || get("guid");
    return {
      source,
      title: get("title"),
      url: absoluteUrl(link, source.baseUrl),
      description: get("description") || get("summary") || get("content"),
      publishedAt: get("pubDate") || get("published") || get("updated"),
      imageUrl: entry.match(/<(?:media:content|enclosure)[^>]+url=["']([^"']+)/i)?.[1] || "",
    };
  });
}

function parseHtml(html: string, source: Source): Candidate[] {
  const links = [...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)];
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const match of links) {
    const url = absoluteUrl(match[2], source.baseUrl);
    const title = stripHtml(match[4]);
    if (!url || !title || title.length < 18 || title.length > 220) continue;
    if (source.linkPattern && !source.linkPattern.test(new URL(url).pathname)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    candidates.push({ source, title, url });
    if (candidates.length >= 20) break;
  }
  return candidates;
}

async function hydrate(candidate: Candidate) {
  try {
    const { text: html } = await fetchText(candidate.url);
    const title =
      stripHtml(meta(html, "og:title") || meta(html, "twitter:title")) || candidate.title;
    const description = stripHtml(
      meta(html, "og:description") ||
        meta(html, "description") ||
        candidate.description ||
        html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
        "",
    );
    return {
      ...candidate,
      title,
      description,
      imageUrl: absoluteUrl(
        meta(html, "og:image") || meta(html, "twitter:image") || candidate.imageUrl || "",
        candidate.url,
      ),
      publishedAt:
        meta(html, "article:published_time") || meta(html, "date") || candidate.publishedAt || "",
    };
  } catch {
    return candidate;
  }
}

async function downloadImage(imageUrl: string, sourceId: string, canonicalUrl: string) {
  if (!imageUrl) return { imageUrl: "", path: "" };
  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "ProcionFiscalNewsBot/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.startsWith("image/")) return { imageUrl: "", path: "" };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 5_000_000) return { imageUrl: "", path: "" };
    const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalUrl));
    const hash = [...new Uint8Array(digest)]
      .slice(0, 12)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const path = `${sourceId}/${hash}.${extension}`;
    const { error } = await admin.storage
      .from("fiscal-news-images")
      .upload(path, bytes, { contentType: type, upsert: true });
    if (error) return { imageUrl: "", path: "" };
    const { data } = admin.storage.from("fiscal-news-images").getPublicUrl(path);
    return { imageUrl: data.publicUrl, path };
  } catch {
    return { imageUrl: "", path: "" };
  }
}

async function collectSource(source: Source) {
  const startedAt = new Date().toISOString();
  try {
    await admin.from("fiscal_news_sources").upsert({
      id: source.id,
      name: source.name,
      base_url: source.baseUrl,
      listing_url: source.listingUrl,
      rss_url: source.rssUrl || null,
      enabled: true,
      updated_at: startedAt,
    });
    let candidates: Candidate[] = [];
    const listing = await fetchText(source.listingUrl);
    const rssUrl = source.rssUrl || discoverRss(listing.text, source.listingUrl);
    if (rssUrl) {
      try {
        candidates = parseRss((await fetchText(rssUrl)).text, source);
      } catch {
        candidates = [];
      }
    }
    if (!candidates.length) {
      candidates = parseHtml(listing.text, source);
    }

    let saved = 0;
    let discarded = 0;
    const hydrated = await Promise.all(candidates.slice(0, 12).map(hydrate));
    for (const article of hydrated) {
      const classification = classify(article.title, article.description || "", source);
      if (classification.score < 5) {
        discarded += 1;
        continue;
      }
      const canonicalUrl = absoluteUrl(article.url, source.baseUrl);
      const storedImage = await downloadImage(article.imageUrl || "", source.id, canonicalUrl);
      const row = {
        source_id: source.id,
        title: article.title,
        summary: summarize(article.description || "", article.title),
        category: classification.category,
        categories: classification.categories,
        url: article.url,
        canonical_url: canonicalUrl,
        source_image_url: article.imageUrl || null,
        image_url: storedImage.imageUrl || null,
        image_storage_path: storedImage.path || null,
        published_at: isoDate(article.publishedAt),
        relevance_score: classification.score,
        keywords: classification.keywords,
        raw_metadata: { collector: rssUrl ? "rss" : "html", rss_url: rssUrl || null },
        collected_at: startedAt,
        updated_at: startedAt,
      };
      const { error } = await admin
        .from("fiscal_news")
        .upsert(row, { onConflict: "canonical_url" });
      if (!error) saved += 1;
    }
    await admin.from("fiscal_news_sources").upsert({
      id: source.id,
      name: source.name,
      base_url: source.baseUrl,
      listing_url: source.listingUrl,
      rss_url: source.rssUrl || null,
      enabled: true,
      last_collected_at: startedAt,
      last_error: null,
      updated_at: startedAt,
    });
    return { source: source.name, found: candidates.length, saved, discarded };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("fiscal_news_sources").upsert({
      id: source.id,
      name: source.name,
      base_url: source.baseUrl,
      listing_url: source.listingUrl,
      rss_url: source.rssUrl || null,
      enabled: true,
      last_collected_at: startedAt,
      last_error: message.slice(0, 500),
      updated_at: startedAt,
    });
    return { source: source.name, found: 0, saved: 0, discarded: 0, error: message };
  }
}

async function collectAll() {
  const results = [];
  for (let index = 0; index < SOURCES.length; index += 2) {
    results.push(...(await Promise.all(SOURCES.slice(index, index + 2).map(collectSource))));
  }
  return results;
}

async function listNews(limit = 12, category?: string) {
  let query = admin
    .from("fiscal_news")
    .select(
      "title,summary,url,image_url,source_id,published_at,category,categories,relevance_score,fiscal_news_sources(name)",
    )
    .gte("relevance_score", 5)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (category) query = query.contains("categories", [category]);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((item: Record<string, unknown>) => ({
    title: item.title,
    description: item.summary,
    url: item.url,
    imageUrl: item.image_url || "",
    source: (item.fiscal_news_sources as { name?: string } | null)?.name || item.source_id,
    publishedAt: item.published_at || "",
    category: item.category,
    categories: item.categories,
    relevanceScore: item.relevance_score,
  }));
}

async function collectionIsFresh() {
  const { data, error } = await admin
    .from("fiscal_news_sources")
    .select("last_collected_at")
    .not("last_collected_at", "is", null)
    .order("last_collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.last_collected_at) return false;
  const age = Date.now() - new Date(data.last_collected_at).getTime();
  return age < 165 * 60 * 1000;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const action = body.action || "list";
    if (action === "scheduled_collect") {
      const expected = `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`;
      if (request.headers.get("authorization") !== expected) {
        return json({ error: "NÃ£o autorizado." }, 401);
      }
      if (await collectionIsFresh()) {
        return json({ data: [], skipped: true, reason: "Coleta recente." });
      }
      return json({ data: await collectAll(), skipped: false });
    }

    if (action === "collect") {
      const expected = Deno.env.get("NEWS_COLLECTOR_TOKEN");
      const supplied = request.headers.get("x-collector-token");
      if (!expected) return json({ error: "Coletor não configurado." }, 503);
      if (supplied !== expected) return json({ error: "Não autorizado." }, 401);
      return json({ data: await collectAll() });
    }

    if (!(await collectionIsFresh())) {
      await collectAll();
    }
    const articles = await listNews(Number(body.limit) || 12, body.category);
    return json({ articles });
  } catch (error) {
    console.error("[fiscal-news]", error);
    return json({
      articles: [],
      warning: "As fontes fiscais oficiais estão temporariamente indisponíveis.",
    });
  }
});
