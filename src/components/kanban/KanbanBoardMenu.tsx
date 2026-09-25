import {
  Activity,
  ArchiveRestore,
  BookOpen,
  Clock3,
  Eye,
  Layers3,
  ListChecks,
  MessageSquare,
  Trash2,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  kanbanMembers,
  type ColumnId,
  type KanbanCard,
  type KanbanColumn,
} from "@/lib/kanban-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: "about" | "activity" | "archive";
  onTabChange: (tab: "about" | "activity" | "archive") => void;
  cards: KanbanCard[];
  columns: KanbanColumn[];
  followedColumns: Set<ColumnId>;
  onOpenCard: (card: KanbanCard) => void;
  onRestoreCard: (card: KanbanCard) => void;
  onDeleteCard: (id: string) => void;
  onCreateColumn: () => void;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function memberById(id?: string) {
  return kanbanMembers.find((member) => member.id === id);
}

export function KanbanBoardMenu({
  open,
  onOpenChange,
  tab,
  onTabChange,
  cards,
  columns,
  followedColumns,
  onOpenCard,
  onRestoreCard,
  onDeleteCard,
  onCreateColumn,
}: Props) {
  const archivedCards = cards.filter((card) => card.archived || card.columnId === "arquivado");
  const activeCards = cards.filter((card) => !card.archived && card.columnId !== "arquivado");
  const watchedLists = columns.filter((column) => followedColumns.has(column.id));
  const commentTotal = cards.reduce((sum, card) => sum + card.comments, 0);
  const attachmentTotal = cards.reduce((sum, card) => sum + card.attachments, 0);

  const activity = cards
    .flatMap((card) => {
      const entries =
        card.activity?.map((entry) => ({
          id: `${card.id}-${entry.id}`,
          card,
          at: entry.at,
          text: entry.text,
          authorId: entry.authorId,
        })) ?? [];
      return [
        ...entries,
        {
          id: `${card.id}-snapshot`,
          card,
          at: card.dueDate ? `${card.dueDate}T12:00:00` : new Date().toISOString(),
          text: `Cartão em ${columns.find((column) => column.id === card.columnId)?.title ?? "lista"}`,
          authorId: card.assigneeId,
        },
      ];
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 30);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden p-0 sm:max-w-[440px]">
        <div className="flex h-full flex-col bg-white text-slate-900 dark:bg-[#07111f] dark:text-slate-100">
          <SheetHeader className="border-b border-slate-200 px-5 py-5 text-left dark:border-white/10">
            <SheetTitle className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-primary" />
              Menu do quadro
            </SheetTitle>
            <SheetDescription>
              Central de controle do Kanban Procion: atividade, listas, membros e arquivados.
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={tab}
            onValueChange={(value) => onTabChange(value as "about" | "activity" | "archive")}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="border-b border-slate-200 px-5 py-3 dark:border-white/10">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="about">Quadro</TabsTrigger>
                <TabsTrigger value="activity">Atividade</TabsTrigger>
                <TabsTrigger value="archive">Arquivo</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <TabsContent value="about" className="m-0 space-y-5 p-5">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-sm font-black">Kanban Procion</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Quadro para demandas internas, projetos, melhorias e tarefas da equipe.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Metric label="Cards ativos" value={activeCards.length} icon={ListChecks} />
                    <Metric label="Listas" value={columns.length} icon={Layers3} />
                    <Metric label="Comentarios" value={commentTotal} icon={MessageSquare} />
                    <Metric label="Anexos" value={attachmentTotal} icon={BookOpen} />
                  </div>
                </div>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Listas
                    </h3>
                    <Button
                      size="sm"
                      className="h-8 cursor-pointer text-xs"
                      onClick={onCreateColumn}
                    >
                      Nova lista
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {columns.map((column) => (
                      <div
                        key={column.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{column.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {cards.filter((card) => card.columnId === column.id).length} cards
                          </p>
                        </div>
                        {followedColumns.has(column.id) && (
                          <Badge variant="secondary" className="gap-1">
                            <Eye className="h-3 w-3" />
                            seguindo
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Users className="h-4 w-4" />
                    Membros do quadro
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {kanbanMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn("text-[10px] font-black", member.color)}>
                            {member.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 truncate text-xs font-semibold">
                          {member.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {watchedLists.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Listas acompanhadas
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {watchedLists.map((column) => (
                        <Badge key={column.id} variant="outline" className="gap-1">
                          <Eye className="h-3 w-3" />
                          {column.title}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}
              </TabsContent>

              <TabsContent value="activity" className="m-0 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-black">Atividade do quadro</h3>
                </div>
                <div className="space-y-3">
                  {activity.map((item) => {
                    const member = memberById(item.authorId);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onOpenCard(item.card)}
                        className="flex w-full cursor-pointer gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-primary/30 hover:bg-primary/5 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn("text-[10px] font-black", member?.color)}>
                            {member?.initials ?? "PR"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold leading-5 text-slate-700 dark:text-slate-200">
                            {item.text}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {item.card.title}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock3 className="h-3 w-3" />
                            {formatWhen(item.at)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="archive" className="m-0 p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-black">Cards arquivados</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Restaure ou exclua definitivamente os cards que sairam do quadro.
                  </p>
                </div>

                {archivedCards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    Nenhum card arquivado por enquanto.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {archivedCards.map((card) => (
                      <div
                        key={card.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-bold">{card.title}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {card.client} - {card.module}
                            </p>
                          </div>
                          <Badge variant="secondary">{card.priority}</Badge>
                        </div>
                        <Separator className="my-3" />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1 cursor-pointer text-xs"
                            onClick={() => onRestoreCard(card)}
                          >
                            <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                            Restaurar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 cursor-pointer border-rose-200 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            onClick={() => onDeleteCard(card.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
