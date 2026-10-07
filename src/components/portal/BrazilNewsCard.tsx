import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getBrazilFiscalNews, type BrazilNewsArticle } from "@/lib/news-api";

const formatPublishedAt = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const isUsableImageUrl = (value?: string) => {
  if (!value) return false;
  try {
    const parsed = new URL(value, window.location.href);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
};

function NewsThumb({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const usable = isUsableImageUrl(src) && !failed;

  if (!usable) {
    return (
      <span className="grid h-14 w-20 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Newspaper className="h-5 w-5" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? ""}
      className="h-14 w-20 shrink-0 rounded-md object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function NewsList({ articles }: { articles: BrazilNewsArticle[] }) {
  return (
    <ul className="divide-y divide-border/60">
      {articles.map((article) => (
        <li key={article.url}>
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="group flex min-w-0 gap-3 px-5 py-3 transition hover:bg-muted/40"
          >
            <NewsThumb src={article.imageUrl} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground group-hover:text-primary">
                {article.title}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
                {article.category ? (
                  <span className="max-w-full shrink-0 truncate rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                    {article.category}
                  </span>
                ) : null}
                <span className="min-w-0 truncate">{article.source}</span>
                {article.publishedAt ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{formatPublishedAt(article.publishedAt)}</span>
                  </>
                ) : null}
                <ExternalLink className="ml-auto h-3 w-3 shrink-0" />
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function BrazilNewsCard() {
  const [showAll, setShowAll] = useState(false);
  const [articles, setArticles] = useState<BrazilNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadNews = () => {
      getBrazilFiscalNews()
        .then((result) => {
          if (!active) return;
          setArticles(result);
          setError(null);
        })
        .catch((reason: unknown) => {
          if (!active) return;
          setError(reason instanceof Error ? reason.message : "Falha ao carregar notícias.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    loadNews();
    const refreshInterval = window.setInterval(loadNews, 15 * 60_000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  return (
    <>
      <section className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-card text-card-foreground shadow-[0_14px_36px_rgba(15,16,20,0.08)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.35)]">
        <header className="border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <h2 className="text-[17px] font-semibold leading-tight">Notícias fiscais</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Receita Federal, tributação e ICMS</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Carregando notícias...</p>
          ) : error ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">{error}</p>
          ) : articles.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma notícia encontrada.</p>
          ) : (
            <>
              <div className="xl:hidden">
                <NewsList articles={articles.slice(0, 3)} />
              </div>
              <div className="hidden xl:block">
                <NewsList articles={articles} />
              </div>
            </>
          )}
        </div>
        {!loading && !error && articles.length > 3 && (
          <footer className="shrink-0 border-t border-border/60 px-5 py-2 xl:hidden">
            <Button
              variant="ghost"
              className="w-full text-primary"
              onClick={() => setShowAll(true)}
            >
              Ver todos ({articles.length})
            </Button>
          </footer>
        )}
      </section>
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl sm:p-0">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-primary" /> Notícias fiscais
            </DialogTitle>
            <DialogDescription>
              Receita Federal, tributação e ICMS · {articles.length} notícias
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <NewsList articles={articles} />
          </div>
          <DialogFooter className="border-t border-border/60 px-5 py-3" />
        </DialogContent>
      </Dialog>
    </>
  );
}
