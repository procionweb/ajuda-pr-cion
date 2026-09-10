import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  SearchX,
  FileText,
  BookOpen,
  AlertTriangle,
  Scale,
  Megaphone,
  Sparkles,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  X,
  Boxes,
} from "lucide-react";
import { filterArticlesByModule, getModuleBySlug } from "@/lib/module-link";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { EmptyState } from "@/components/portal/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  kbArticlesFull,
  kbCategoriesFull,
  categoryToneClass,
  getCategory,
  type KbCategoryId,
} from "@/lib/kb-data";
import { cvsArticles } from "@/lib/cvs-catalogs-imported";

type KbSearch = {
  search?: string;
  release?: string;
  modulo?: string;
  from?: string;
  ticketId?: string;
};

export const Route = createFileRoute("/base-de-conhecimento/")({
  head: () => ({
    meta: [
      { title: "Base de Conhecimento — Portal Prócion" },
      {
        name: "description",
        content: "Manuais, guias, erros e correções, legislação e novidades da Prócion Sistemas.",
      },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): KbSearch => ({
    search: typeof raw.search === "string" ? raw.search : undefined,
    release: typeof raw.release === "string" ? raw.release : undefined,
    modulo: typeof raw.modulo === "string" ? raw.modulo : undefined,
    from: typeof raw.from === "string" ? raw.from : undefined,
    ticketId: typeof raw.ticketId === "string" ? raw.ticketId : undefined,
  }),
  component: KbIndexPage,
});

const categoryIcon: Record<KbCategoryId, React.ComponentType<{ className?: string }>> = {
  guia: BookOpen,
  manual: FileText,
  erros: AlertTriangle,
  legislacao: Scale,
  comunicacao: Megaphone,
  novidades: Sparkles,
  atualizacoes: RefreshCw,
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function KbIndexPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [activeCategory, setActiveCategory] = useState<KbCategoryId | "all">("all");
  const selectedRelease = useMemo(
    () =>
      search.release ? cvsArticles.find((article) => article.id === search.release) : undefined,
    [search.release],
  );
  const [query, setQuery] = useState(search.search ?? selectedRelease?.title ?? "");

  // Sync query state when URL param changes (chip click from other page)
  useEffect(() => {
    setQuery(search.search ?? selectedRelease?.title ?? "");
  }, [search.search, selectedRelease]);

  const countByCategory = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of kbArticlesFull) c[a.category] = (c[a.category] ?? 0) + 1;
    return c;
  }, []);

  const trimmed = query.trim();
  const tokens = useMemo(() => tokenize(trimmed), [trimmed]);
  const hasSearch = trimmed.length > 0;

  const activeModule = useMemo(() => getModuleBySlug(search.modulo), [search.modulo]);

  const moduleFiltered = useMemo(
    () => (activeModule ? filterArticlesByModule(kbArticlesFull, activeModule) : kbArticlesFull),
    [activeModule],
  );

  const filtered = useMemo(() => {
    return moduleFiltered.filter((a) => {
      if (activeCategory !== "all" && a.category !== activeCategory) return false;
      if (!hasSearch) return true;

      const haystack = [
        a.title,
        a.summary,
        a.module,
        getCategory(a.category).name,
        a.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const fullPhrase = trimmed.toLowerCase();
      if (haystack.includes(fullPhrase)) return true;
      // Fallback: match any meaningful token
      return tokens.some((t) => haystack.includes(t));
    });
  }, [moduleFiltered, activeCategory, hasSearch, trimmed, tokens]);

  const clearSearch = () => {
    setQuery("");
    navigate({
      search: { modulo: search.modulo } as KbSearch,
      replace: true,
    });
  };

  const clearModule = () => {
    navigate({
      search: { search: search.search } as KbSearch,
      replace: true,
    });
  };

  return (
    <AppShell>
      {search.from === "chamado" && search.ticketId ? (
        <div className="mb-3 flex">
          <Button asChild variant="outline" size="sm" className="h-8 cursor-pointer rounded-lg">
            <Link to="/chamados" search={{ ticket: search.ticketId }}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Voltar ao chamado
            </Link>
          </Button>
        </div>
      ) : null}
      <PageHeader
        title="Base de Conhecimento"
        description="Manuais, guias, erros e correções, legislação e novidades organizados por módulo."
        breadcrumbs={[{ label: "Base de Conhecimento" }]}
      />

      {selectedRelease && (
        <section className="mb-6 overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs text-primary">
                <Sparkles className="h-4 w-4" /> Release Hádron
              </div>
              <h2 className="text-lg font-semibold leading-snug text-foreground">
                {selectedRelease.title}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Responsável: {selectedRelease.owner || "Não informado"} · Atualizado em{" "}
                {formatReleaseDate(selectedRelease.updatedAt)}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/base-de-conhecimento" search={{}}>
                Voltar para a base
              </Link>
            </Button>
          </div>
          <div className="grid gap-5 p-5 lg:grid-cols-[190px_minmax(0,1fr)]">
            <aside className="space-y-3 text-sm lg:border-r lg:pr-5">
              <ReleaseField label="Categoria" value={selectedRelease.category || "Release"} />
              <ReleaseField label="Status" value={selectedRelease.status || "Não informado"} />
              <ReleaseField label="Cliques" value={String(selectedRelease.clicks || 0)} />
            </aside>
            <ReleaseContent
              value={
                selectedRelease.description || "Este release não possui detalhes no JSON importado."
              }
            />
          </div>
        </section>
      )}

      <Card className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Pesquisar por título, tag, módulo..."
            className="w-full h-11 pl-9 pr-10 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {hasSearch && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </Card>

      {activeModule && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Boxes className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary/80">
                Filtrando por módulo
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {activeModule.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {filtered.length} artigo(s)
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearModule}
            className="h-8 cursor-pointer rounded-lg text-[12px]"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Limpar filtro
          </Button>
        </div>
      )}

      {hasSearch && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary/80">
              Resultados para
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              “{trimmed}”
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {filtered.length} artigo(s)
              </span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSearch}
            className="h-8 cursor-pointer rounded-lg text-[12px]"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Limpar filtro
          </Button>
        </div>
      )}

      <section className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Categorias
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <CategoryPill
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
            label="Todas"
            count={kbArticlesFull.length}
            icon={FileText}
            tone="bg-muted text-muted-foreground"
          />
          {kbCategoriesFull.map((c) => {
            const Icon = categoryIcon[c.id];
            return (
              <CategoryPill
                key={c.id}
                active={activeCategory === c.id}
                onClick={() => setActiveCategory(c.id)}
                label={c.name}
                count={countByCategory[c.id] ?? 0}
                icon={Icon}
                tone={categoryToneClass(c.id)}
              />
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {hasSearch
              ? "Artigos relacionados"
              : activeCategory === "all"
                ? "Todos os artigos"
                : getCategory(activeCategory).name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </h3>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nenhum artigo encontrado"
            description="Tente ajustar a busca, remover o filtro ou selecionar outra categoria."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((a) => (
              <Link
                key={a.id}
                to="/base-de-conhecimento/$slug"
                params={{ slug: a.slug }}
                className="group"
              >
                <Card className="p-5 h-full hover:border-primary/40 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className={cn("text-[10px]", categoryToneClass(a.category))}>
                      {getCategory(a.category).name}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{a.module}</span>
                    <span className="text-[11px] text-muted-foreground">·</span>
                    <span className="text-[11px] text-muted-foreground">{a.readTime}</span>
                  </div>
                  <p className="font-semibold leading-snug group-hover:text-primary transition-colors">
                    {a.title}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{a.summary}</p>
                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {a.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Atualizado {formatDate(a.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition">
                    Abrir artigo <ArrowRight className="h-3 w-3" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function ReleaseField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b pb-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}

function ReleaseContent({ value }: { value: string }) {
  const images = [...value.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => normalizeReleaseUrl(match[1]))
    .filter(Boolean);
  const paragraphs = value
    .replace(/<img[^>]*>/gi, " ")
    .split(/<\/?(?:p|div|h[1-6]|li|ul|ol|br)[^>]*>/gi)
    .map(stripReleaseHtml)
    .filter(Boolean);
  return (
    <div className="min-w-0 space-y-3 text-sm leading-6 text-foreground">
      <h3 className="font-medium">Detalhes do release</h3>
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
      ))}
      {images.map((src) => (
        <img
          key={src}
          src={src}
          alt="Imagem do release"
          loading="lazy"
          className="max-h-[620px] max-w-full rounded-md border bg-white object-contain"
        />
      ))}
    </div>
  );
}

function normalizeReleaseUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? `https://crm.procion.com${value}` : "";
}

function stripReleaseHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function formatReleaseDate(value: string) {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function CategoryPill({
  label,
  count,
  active,
  onClick,
  icon: Icon,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all cursor-pointer",
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/30",
      )}
    >
      <div className={cn("grid h-8 w-8 place-items-center rounded-md shrink-0", tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground">{count} artigos</p>
      </div>
    </button>
  );
}
