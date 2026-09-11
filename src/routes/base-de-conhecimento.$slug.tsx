import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Boxes,
  Link2,
  Tag,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/portal/AppShell";
import { Breadcrumbs } from "@/components/portal/Breadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getArticleBySlug,
  getRelatedArticles,
  categoryToneClass,
  getCategory,
  type KbBlock,
  type KbArticle,
} from "@/lib/kb-data";
import { KanbanCardDrawer } from "@/components/kanban/KanbanCardDrawer";
import { kanbanStore } from "@/lib/kanban-store";
import {
  type KanbanCard,
  kanbanMembers,
  kanbanModules,
} from "@/lib/kanban-data";

type ArticleSearch = { from?: string };

export const Route = createFileRoute("/base-de-conhecimento/$slug")({
  validateSearch: (search: Record<string, unknown>): ArticleSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  loader: ({ params }): { article: KbArticle } => {
    const article = getArticleBySlug(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    const a = loaderData?.article;
    return {
      meta: [
        {
          title: a
            ? `${a.title} — Base de Conhecimento`
            : "Artigo — Base de Conhecimento",
        },
        {
          name: "description",
          content: a?.summary ?? "Artigo da base de conhecimento Prócion.",
        },
      ],
    };
  },
  notFoundComponent: () => (
    <AppShell>
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold">Artigo não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O artigo solicitado não existe ou foi removido.
        </p>
        <Link
          to="/base-de-conhecimento"
          className="inline-flex items-center gap-1 mt-6 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a base
        </Link>
      </div>
    </AppShell>
  ),
  component: ArticleDetailPage,
});

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ArticleDetailPage() {
  const { article } = Route.useLoaderData() as { article: KbArticle };
  const search = Route.useSearch();
  const navigate = useNavigate();
  const related = getRelatedArticles(article);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const seedCard: KanbanCard = {
    id: "",
    columnId: "a-fazer",
    title: `[${article.id}] ${article.title}`,
    summary: article.summary,
    description: `Card criado a partir do artigo ${article.id} — ${article.title}.\n\n${article.summary}`,
    client: "Interno",
    module: kanbanModules.includes(article.module as (typeof kanbanModules)[number])
      ? article.module
      : kanbanModules[0],
    priority: article.category === "erros" ? "Alta" : "Média",
    type: article.category === "erros" ? "Bug" : "Suporte",
    assigneeId: kanbanMembers[0].id,
    dueDate: new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10),
    tags: article.tags,
    comments: 0,
    attachments: 0,
    participants: [kanbanMembers[0].id],
    checklist: [],
    commentsList: [],
    activity: [],
    attachmentsList: [],
    relatedArticles: [
      {
        id: article.id,
        title: article.title,
        category: getCategory(article.category).name,
      },
    ],
    relatedVersions: [],
  };

  const handleCreateCard = (card: KanbanCard) => {
    const created = kanbanStore.addCard(card);
    toast.success("Card criado no Kanban", {
      description: created.id,
      action: {
        label: "Ver no Kanban",
        onClick: () => navigate({ to: "/kanban" }),
      },
    });
  };

  return (
    <AppShell>
      {search.from === "hadron-article" && (
        <div className="mb-3 flex">
          <Button asChild variant="outline" size="sm" className="h-8 cursor-pointer rounded-lg">
            <Link to="/iniciar-hadron" search={{ tab: "artigos" }}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Voltar para artigos
            </Link>
          </Button>
        </div>
      )}
      <Breadcrumbs
        items={[
          { label: "Base de Conhecimento", to: "/base-de-conhecimento" },
          { label: getCategory(article.category).name },
          { label: article.title },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-8">
        {/* Content */}
        <article className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Badge className={cn("text-[10px]", categoryToneClass(article.category))}>
              {getCategory(article.category).name}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {article.id} · {article.module}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight leading-tight">
            {article.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-2xl">
            {article.summary}
          </p>

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {article.author}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Atualizado {formatDate(article.updatedAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {article.readTime} de leitura
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <Link2 className="h-4 w-4 mr-1.5" /> Vincular a um Card
            </Button>
            {article.sourceUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={article.sourceUrl} target="_blank" rel="noreferrer">
                  Ver original
                </a>
              </Button>
            )}
          </div>

          <hr className="my-6 border-border" />

          <div className="space-y-4">
            {article.content.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {article.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card className="p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Informações
            </h3>
            <SidebarItem icon={Boxes} label="Módulo" value={article.module} />
            <SidebarItem
              icon={FileText}
              label="Categoria"
              value={getCategory(article.category).name}
            />
            <SidebarItem icon={User} label="Autor" value={article.author} />
            <SidebarItem
              icon={Calendar}
              label="Atualização"
              value={formatDate(article.updatedAt)}
            />
            {article.sourceUrl && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" />
                Abrir artigo original
              </a>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Artigos relacionados
            </h3>
            {related.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nenhum artigo relacionado.
              </p>
            ) : (
              <ul className="space-y-3">
                {related.map((r: KbArticle) => (
                  <li key={r.id}>
                    <Link
                      to="/base-de-conhecimento/$slug"
                      params={{ slug: r.slug }}
                      className="group block"
                    >
                      <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
                        {r.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {getCategory(r.category).name} · {r.module}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <KanbanCardDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        card={seedCard}
        mode="create"
        defaultColumnId="a-fazer"
        onSave={handleCreateCard}
      />
    </AppShell>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

function BlockView({ block }: { block: KbBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-[15px] leading-relaxed text-foreground/90">{block.text}</p>
      );
    case "h2":
      return (
        <h2 className="text-xl font-semibold mt-6 tracking-tight">{block.text}</h2>
      );
    case "h3":
      return <h3 className="text-base font-semibold mt-4">{block.text}</h3>;
    case "ul":
      return (
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] text-foreground/90">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal pl-5 space-y-1.5 text-[15px] text-foreground/90">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre className="rounded-lg bg-muted/60 border border-border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
          {block.text}
        </pre>
      );
    case "image":
      return (
        <figure className="overflow-hidden rounded-xl border border-border bg-card">
          <img
            src={block.src}
            alt={block.alt ?? "Imagem do artigo"}
            loading="lazy"
            className="w-full object-contain"
          />
          {block.alt && block.alt !== "Imagem do artigo" && (
            <figcaption className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {block.alt}
            </figcaption>
          )}
        </figure>
      );
    case "callout": {
      const tone = {
        info: "border-primary/40 bg-primary/5 text-foreground",
        warning: "border-warning/40 bg-warning/10 text-foreground",
        success: "border-success/40 bg-success/10 text-foreground",
        danger: "border-destructive/40 bg-destructive/10 text-foreground",
      }[block.tone];
      return (
        <div className={cn("rounded-lg border p-4", tone)}>
          <p className="text-sm font-semibold">{block.title}</p>
          <p className="text-sm mt-1 text-foreground/85">{block.text}</p>
        </div>
      );
    }
  }
}
