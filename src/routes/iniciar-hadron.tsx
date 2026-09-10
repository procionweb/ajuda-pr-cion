import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  Bug,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Code2,
  FileCode2,
  Eye,
  Filter,
  Flag,
  GitBranch,
  History,
  Globe2,
  KeyRound,
  ListChecks,
  ListTodo,
  Minus,
  PackageCheck,
  Pencil,
  Rocket,
  Search,
  SlidersHorizontal,
  Sparkles,
  ArrowUp,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { AppShell } from "@/components/portal/AppShell";
import { ListPaginationFooter } from "@/components/portal/ListPaginationFooter";
import { DateRangeFilter } from "@/components/portal/DateRangeFilter";
import { Breadcrumbs } from "@/components/portal/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Info } from "lucide-react";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { TicketTimelineList } from "@/components/tickets/TicketTimelineList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { erpVersions, formatVersionDate } from "@/lib/erp-versions";
import { hadronOptions, type HadronOption } from "@/lib/hadron-options";
import {
  acquireHadronOptionLock,
  listHadronOptionLocks,
  releaseHadronOptionLock,
  type HadronOptionLock,
} from "@/lib/hadron-option-locks";
import { moduleOptions, modulesMap } from "@/lib/modules-map";
import { collaboratorLabel, findCollaborator, useCollaborators } from "@/lib/collaborators-store";
import { cvsArticles } from "@/lib/cvs-catalogs-imported";
import { getCategory, kbArticlesFull } from "@/lib/kb-data";
import { ticketsStore, useTickets, type TicketEvent } from "@/lib/tickets-store";
import { currentUser } from "@/lib/mock-data";
import { usePortalAuth } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  deleteHadronOccurrence,
  listHadronOccurrences,
  listHadronOccurrenceOperators,
  reviewHadronOccurrence,
  updateHadronOccurrenceSolution,
  type HadronOccurrence,
} from "@/lib/hadron-occurrences";

const hadronOptionsById = new Map(hadronOptions.map((option) => [option.id, option]));

export const Route = createFileRoute("/iniciar-hadron")({
  head: () => ({ meta: [{ title: "Hadron - CRM Procion" }] }),
  component: HadronPage,
});

type Detail = {
  title: string;
  subtitle: string;
  body: string;
  meta: string[];
  occurrences?: TicketEvent[];
  hadronOccurrence?: HadronOccurrenceDetail;
  release?: ReleaseDetail;
};

type ReleaseDetail = {
  id: string;
  title: string;
  content: string;
  option: string;
  form: string;
  owner: string;
  version: string;
  date: string;
  module: string;
  submodule: string;
  clicks: number;
};

type HadronOccurrenceDetail = {
  id?: number;
  option: string;
  form: string;
  kind: ReturnType<typeof occurrenceKind>;
  reporter: string;
  openedAt: string;
  solver: string;
  solvedAt?: string | null;
  description: string;
  solution: string;
  status: string;
  reviewedAt?: string | null;
  version?: string;
  baseAddress?: string;
  events?: TicketEvent[];
};

const options = [
  {
    id: "1111",
    title: "Cadastro de Tabelas de Tributacoes",
    description: "Ajustes e melhorias nas regras fiscais.",
    owner: "PRCEDU",
    priority: "Alta",
    status: "Correcao",
  },
  {
    id: "1116",
    title: "Cadastro de Operadores",
    description: "Permissões e configurações dos usuários.",
    owner: "PRCEDU",
    priority: "Media",
    status: "Melhoria",
  },
  {
    id: "1243",
    title: "Complementos Gerais N.C.M.",
    description: "Manutencao dos complementos tributarios.",
    owner: "PRCWAG",
    priority: "Alta",
    status: "Correcao",
  },
  {
    id: "1398",
    title: "Emissão de Nota Fiscal Eletrônica",
    description: "Validacoes e retorno da SEFAZ.",
    owner: "PRCJUL",
    priority: "Baixa",
    status: "Evolucao",
  },
];

const occurrences = [
  {
    type: "Problema Hadron",
    option: "1111 - Tabelas de Tributacoes",
    title: "Alíquota não aplicada na venda",
    owner: "PRCEDU",
    state: "Aguardando revisao",
    date: "18/07/2026",
  },
  {
    type: "Configuração",
    option: "1116 - Cadastro de Operadores",
    title: "Permissão de acesso ao financeiro",
    owner: "PRCJUL",
    state: "Em análise",
    date: "17/07/2026",
  },
  {
    type: "Problema Externo",
    option: "1398 - Nota Fiscal Eletronica",
    title: "Retorno intermitente da SEFAZ",
    owner: "PRCWAG",
    state: "Resolvido",
    date: "16/07/2026",
  },
  {
    type: "Solicitação/Sugestão",
    option: "1243 - Complementos N.C.M.",
    title: "Novo filtro por classificacao",
    owner: "PRCGUI",
    state: "Em desenvolvimento",
    date: "15/07/2026",
  },
];

const operatorStats = [
  ["PRCEDU", 11],
  ["PRCJUL", 11],
  ["PRCWAG", 8],
  ["PRCWLS", 6],
  ["PRCGUI", 2],
  ["PRCAND", 1],
] as const;

const hadronChecklist = [
  [
    "direction",
    "Elaborado",
    "Direcionamento",
    "Direcionamento de Impressão",
    true,
    "18/10/2019 11:17",
    "18/10/2019 11:17",
  ],
  [
    "pagination",
    "Elaborado",
    "Intervalo paginação",
    "Intervalo de Páginas / Inicial / Final",
    true,
    "18/10/2019 11:17",
    "18/10/2019 11:17",
  ],
  [
    "ordering",
    "Elaborado",
    "Ordenação",
    "Verificar ordenação/separação/quebra",
    false,
    "18/10/2019 11:17",
    "18/10/2019 11:17",
  ],
  [
    "data-integrity",
    "Elaborado",
    "Integridade dos dados",
    "Verificar integridade e resultados de todos os Filtros e Intervalos utilizados",
    false,
    "18/10/2019 11:17",
    "18/10/2019 11:17",
  ],
  [
    "models",
    "Elaborado",
    "Modelos",
    "Modelos dos Relatórios",
    false,
    "18/10/2019 11:17",
    "18/10/2019 11:17",
  ],
  [
    "alignment",
    "Elaborado",
    "Alinhamento",
    "Alinhamento de Campos, Sintaxe em cada opção habilitada",
    false,
    "18/10/2019 11:17",
    "18/10/2019 11:17",
  ],
  [
    "print-types",
    "Elaborado",
    "Impres. tipos habilitados",
    "Impressão nas opções habilitadas",
    true,
    "18/10/2019 11:17",
    "18/10/2019 11:17",
  ],
  [
    "print-enable",
    "Elaborado",
    "Hab. tipos impressão",
    "Habilitação das opções de impressão (disponíveis/necessárias)",
    true,
    "18/10/2019 11:17",
    "18/10/2019 11:17",
  ],
  [
    "specific-integrity",
    "Específico",
    "Integridade",
    "Consequência dos dados após processo",
    false,
    "01/11/2019 16:49",
    "01/11/2019 16:49",
  ],
  [
    "other-integrity",
    "Outros s/ ACP",
    "Integridade",
    "Consequência dos dados após processo",
    false,
    "01/11/2019 16:48",
    "01/11/2019 16:49",
  ],
  [
    "process-integrity",
    "Processos",
    "Integridade",
    "Consequência dos dados após processo",
    false,
    "01/11/2019 16:47",
    "01/11/2019 16:47",
  ],
  [
    "f3-item",
    "F3",
    "Escolher item",
    "Escolher itens com tela preenchida ou durante sua montagem",
    true,
    "01/11/2019 16:43",
    "01/11/2019 16:43",
  ],
  [
    "f3-exit",
    "F3",
    "Saída com ESC",
    "Sair com ESC logo na entrada do Formulário, após marcado um item e durante a montagem com vários itens",
    true,
    "01/11/2019 16:43",
    "01/11/2019 16:46",
  ],
  [
    "zebra",
    "RHCD",
    "Impressão Zebra",
    "Teste em Impressora Zebra e similares",
    false,
    "01/11/2019 16:38",
    "01/11/2019 16:38",
  ],
] as const;

const hadronParameters = [
  {
    id: "1",
    option: "60",
    form: "60",
    title: "Tag ICMS-60 do XML da Nota Fiscal Eletrônica (NF-e, NFC-e, SAT)",
    description: "Cálculo do valor do ICMS-ST recolhido anteriormente.",
    createdAt: "16/08/2022 17:46",
    updatedAt: "17/08/2022 17:05",
  },
  {
    id: "2",
    option: "3",
    form: "3",
    title: "Automatização B2C de procedimento de Cadastro de Clientes (e-commerce)",
    description: "Web",
    createdAt: "18/08/2022 11:03",
    updatedAt: "29/11/2022 12:08",
  },
] as const;

function HadronPage() {
  const tickets = useTickets();
  const { department } = usePortalAuth();
  const hasAdvancedHadronAccess = ["admin", "development", "tester"].includes(department || "");
  const [tab, setTab] = useState("visao-geral");
  const query = "";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reviewingOccurrence, setReviewingOccurrence] = useState(false);
  const [viewingOption, setViewingOption] = useState<HadronOption | null>(null);
  const [editingOption, setEditingOption] = useState<HadronOption | null>(null);
  const viewingOptionTickets = useMemo(
    () =>
      viewingOption
        ? tickets.filter((ticket) => findTicketOption(ticket)?.id === viewingOption.id)
        : [],
    [tickets, viewingOption],
  );
  const confirmOccurrenceReview = async () => {
    const occurrence = detail?.hadronOccurrence;
    if (!occurrence?.id || occurrence.reviewedAt || !occurrence.solvedAt) return;
    setReviewingOccurrence(true);
    try {
      const reviewedAt = await reviewHadronOccurrence(
        occurrence.id,
        currentUser.operator || currentUser.name,
      );
      setDetail((current) =>
        current?.hadronOccurrence
          ? {
              ...current,
              hadronOccurrence: { ...current.hadronOccurrence, reviewedAt, kind: "revisado" },
            }
          : current,
      );
      window.dispatchEvent(new CustomEvent("hadron-occurrence-reviewed"));
      toast.success("Ocorrência revisada com sucesso.");
    } catch {
      toast.error("Não foi possível revisar a ocorrência.");
    } finally {
      setReviewingOccurrence(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Breadcrumbs items={[{ label: "Hadron" }]} />
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Rocket className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-medium text-foreground">Hadron</h1>
                <p className="text-xs text-muted-foreground">
                  Gestao de opcoes, ocorrencias, releases e artigos do sistema.
                </p>
              </div>
            </div>
          </div>
        </header>

        {viewingOption ? (
          <HadronOptionPage
            option={viewingOption}
            tickets={viewingOptionTickets}
            disabled={false}
            onBack={() => setViewingOption(null)}
            onExit={() => setViewingOption(null)}
            onEdit={() => setEditingOption(viewingOption)}
          />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-card p-1">
              {[
                ["visao-geral", "Visao geral", Rocket],
                ["opcoes", "Opcoes", ListChecks],
                ["ocorrencias", "Ocorrências", ClipboardCheck],
                ["releases", "Releases", GitBranch],
                ["artigos", "Artigos", BookOpenText],
                ...(hasAdvancedHadronAccess
                  ? [
                      ["checklist", "Checklist", ListTodo],
                      ["parametros", "Parâmetros", SlidersHorizontal],
                      ["modulos", "Módulos", Boxes],
                      ["seriais", "Seriais", KeyRound],
                      ["versoes", "Versões", History],
                    ]
                  : []),
              ].map(([value, label, Icon]) => (
                <TabsTrigger
                  key={String(value)}
                  value={String(value)}
                  className="cursor-pointer gap-2 px-4"
                >
                  <Icon className="h-4 w-4" />
                  {String(label)}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="visao-geral">
              <Overview onOpen={setDetail} onViewOption={setViewingOption} />
            </TabsContent>
            <TabsContent value="opcoes">
              <OptionsTable query={query} onOpen={setDetail} />
            </TabsContent>
            <TabsContent value="ocorrencias">
              <ImportedOccurrencesTable query={query} onOpen={setDetail} />
            </TabsContent>
            <TabsContent value="releases">
              <ReleasesTable query={query} onOpen={setDetail} />
            </TabsContent>
            <TabsContent value="checklist">
              <ChecklistTable query={query} onOpen={setDetail} />
            </TabsContent>
            <TabsContent value="parametros">
              <ParametersTable query={query} onOpen={setDetail} />
            </TabsContent>
            <TabsContent value="modulos">
              <ModulesTable query={query} onOpen={setDetail} />
            </TabsContent>
            <TabsContent value="seriais">
              <SerialsTable query={query} onOpen={setDetail} />
            </TabsContent>
            <TabsContent value="versoes">
              <VersionsTable query={query} onOpen={setDetail} />
            </TabsContent>
            <TabsContent value="artigos">
              <ArticlesTable query={query} onOpen={setDetail} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <OptionEditDialog
        option={editingOption}
        onClose={() => setEditingOption(null)}
        onSave={(option) => {
          const overrides = JSON.parse(localStorage.getItem("hadron-option-overrides") || "{}");
          localStorage.setItem(
            "hadron-option-overrides",
            JSON.stringify({ ...overrides, [option.id]: option }),
          );
          setViewingOption(option);
          setEditingOption(null);
        }}
      />

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          className={cn(
            detail?.release ? "max-w-5xl" : "max-w-2xl",
            "gap-0 overflow-hidden bg-card p-0 [&>button]:hidden",
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">{detail?.title}</DialogTitle>
          <DetailModalHeader
            icon={Info}
            title={detail?.title ?? ""}
            meta={detail?.subtitle}
            onClose={() => setDetail(null)}
          />
          <div className="max-h-[68vh] space-y-4 overflow-y-auto px-5 py-4">
            {detail?.release ? (
              <ReleaseDetailView release={detail.release} />
            ) : detail?.hadronOccurrence ? (
              <HadronOccurrenceDetailView occurrence={detail.hadronOccurrence} />
            ) : detail?.occurrences ? (
              <TicketTimelineList
                events={detail.occurrences}
                variant="compact"
                emptyLabel="Nenhuma ocorrência vinculada a esta opção."
              />
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail?.meta.map((item) => (
                    <div
                      key={item}
                      className="rounded-lg border bg-background p-3 text-xs text-muted-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <p className="rounded-lg border bg-background p-4 text-sm leading-6 text-foreground">
                  {detail?.body}
                </p>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDetail(null)} className="cursor-pointer">
                Fechar
              </Button>
              {detail?.hadronOccurrence?.id &&
                detail.hadronOccurrence.solvedAt &&
                !detail.hadronOccurrence.reviewedAt && (
                  <Button
                    onClick={() => void confirmOccurrenceReview()}
                    disabled={reviewingOccurrence}
                    className="cursor-pointer"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {reviewingOccurrence ? "Revisando..." : "Revisar"}
                  </Button>
                )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Overview({
  onOpen,
  onViewOption,
}: {
  onOpen: (d: Detail) => void;
  onViewOption: (option: HadronOption) => void;
}) {
  const tickets = useTickets();
  const active = useMemo(
    () => tickets.filter((ticket) => !["Finalizado", "Cancelado"].includes(ticket.status)),
    [tickets],
  );
  const completed = useMemo(
    () => tickets.filter((ticket) => ["Finalizado", "Cancelado"].includes(ticket.status)),
    [tickets],
  );
  const latestVersion = erpVersions[0];
  const optionRows = useMemo(() => {
    const grouped = new Map<string, TicketRow[]>();
    tickets.forEach((ticket) => {
      const optionId = findTicketOption(ticket)?.id;
      if (!optionId) return;
      grouped.set(optionId, [...(grouped.get(optionId) || []), ticket]);
    });
    return hadronOptions
      .map((option) => ({ option, tickets: grouped.get(option.id) || [] }))
      .sort(
        (a, b) =>
          b.tickets.length - a.tickets.length ||
          a.option.option.localeCompare(b.option.option, "pt-BR", { numeric: true }),
      );
  }, [tickets]);
  const overviewOperatorStats = useMemo(() => {
    const totals = new Map<string, number>();
    optionRows.forEach(({ option, tickets: related }) => {
      if (related.length)
        related.forEach((ticket) => totals.set(ticket.owner, (totals.get(ticket.owner) || 0) + 1));
      else if (option.owner) totals.set(option.owner, (totals.get(option.owner) || 0) + 1);
    });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [optionRows]);
  const cards = [
    [
      "Ag. revisão / ocorrência",
      `${active.length} / ${tickets.length}`,
      ClipboardCheck,
      "text-rose-600 bg-rose-500/10",
    ],
    [
      "Opção ocorrência / total",
      `${active.length} / ${hadronOptions.length}`,
      ListChecks,
      "text-cyan-600 bg-cyan-500/10",
    ],
    ["Releases", String(cvsArticles.length), PackageCheck, "text-amber-600 bg-amber-500/10"],
    [
      "Versão Hádron",
      latestVersion
        ? `${formatVersionDate(latestVersion.data_versao)} v${latestVersion.versao}`
        : "Não informada",
      Code2,
      "text-slate-600 bg-slate-500/10",
    ],
  ] as const;
  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, color]) => (
          <div key={label} className="min-h-20 rounded-md border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className={cn("grid h-6 w-6 place-items-center rounded", color)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
            </div>
            <p className="mt-2 text-lg font-medium">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-md border bg-card shadow-sm">
          <div className="flex items-baseline gap-2 px-4 py-4">
            <h2 className="text-base font-medium">Opções</h2>
            <span className="text-[10px] text-primary">Exceto Hádron</span>
          </div>
          <div className="grid grid-cols-[118px_36px_64px_minmax(190px,1fr)_92px_44px] border-b px-5 pb-2 text-[11px] text-muted-foreground">
            <span>Status</span>
            <span>P</span>
            <span>Opção</span>
            <span>Descrição</span>
            <span>Responsável</span>
            <span className="text-center">Ações</span>
          </div>
          <div className="h-72 overflow-y-auto px-3">
            {optionRows.map(({ option, tickets: related }) => {
              const openCount = related.filter(
                (ticket) => !["Finalizado", "Cancelado"].includes(ticket.status),
              ).length;
              const count = Math.max(1, openCount);
              const occurrencesForModal: TicketEvent[] = related.map((ticket) => ({
                id: ticket.id,
                kind: ["Finalizado", "Cancelado"].includes(ticket.status) ? "closed" : "status",
                when: ticket.closedAt || ticket.updatedAt || ticket.openedAt,
                actor: ticket.owner || option.owner || "Não informado",
                actorType: "suporte",
                description: `${ticket.subject}${ticket.description ? ` — ${ticket.description}` : ""}`,
              }));
              const priority = normalizeOptionPriority(related[0]?.priority || option.priority);
              const PriorityIcon = priority.icon;
              const openPreview = () =>
                onOpen({
                  title: "Ocorrências",
                  subtitle: `Opção: ${option.option}`,
                  body: option.observation || option.description,
                  meta: [],
                  occurrences: occurrencesForModal,
                });
              return (
                <div
                  key={option.id}
                  className="grid min-h-9 grid-cols-[118px_36px_64px_minmax(190px,1fr)_92px_44px] items-center border-b bg-background px-2 text-xs transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-1">
                    <Badge className="h-5 rounded-sm bg-rose-500 px-1.5 text-[9px] text-white hover:bg-rose-500">
                      CORREÇÕES
                    </Badge>
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                      {count}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full border",
                      priority.className,
                    )}
                    title={`Prioridade ${priority.label}`}
                  >
                    <PriorityIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-muted-foreground">{option.option}</span>
                  <button
                    type="button"
                    onClick={() => onViewOption(option)}
                    className="cursor-pointer truncate text-left text-primary hover:underline"
                  >
                    {option.description}
                  </button>
                  <span className="truncate text-muted-foreground">
                    {related[0]?.owner || option.owner || "-"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={openPreview}
                    className="h-8 w-8 cursor-pointer"
                    title="Prévia das ocorrências"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="border-t px-4 py-3">
            <p className="text-[10px] text-muted-foreground">Total de Ocorrências por Operador</p>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {overviewOperatorStats.map(([operator, count]) => (
                <span
                  key={operator}
                  className="flex items-center gap-1 text-xs font-medium text-primary"
                >
                  {operator}
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                    {count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </section>
        <HadronDashboardPanel title="Ocorrências" subtitle="Aguardando revisão">
          <HadronOccurrenceRows
            rows={active.slice(0, 10)}
            onOpen={onOpen}
            empty="Nenhuma ocorrência aguardando revisão."
          />
        </HadronDashboardPanel>
        <HadronDashboardPanel title="Ocorrências" subtitle="Geral">
          <HadronOccurrenceRows
            rows={[...active, ...completed].slice(0, 12)}
            onOpen={onOpen}
            empty="Nenhuma ocorrência registrada."
            variant="general"
          />
        </HadronDashboardPanel>
        <HadronDashboardPanel title="Releases" subtitle="Últimos releases">
          <div className="grid grid-cols-[28px_92px_minmax(180px,1fr)_118px_90px_68px] gap-2 border-b bg-muted/25 px-3 py-2 text-[10px] uppercase text-muted-foreground">
            <span>Tipo</span>
            <span>Opç./Form.</span>
            <span>Descrição</span>
            <span>Responsável/versão</span>
            <span>Data</span>
            <span>Ações</span>
          </div>
          {[...cvsArticles]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 12)
            .map((release) => {
              const option = findReleaseOption(release.title);
              const releaseDetail = createReleaseDetail(release, option);
              return (
                <div
                  key={release.id}
                  className="grid min-h-12 grid-cols-[28px_92px_minmax(180px,1fr)_118px_90px_68px] items-center gap-2 border-b px-3 py-2 text-[11px] hover:bg-muted/40"
                >
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="truncate">
                    {option ? `${option.option}/${option.form || option.option}` : release.id}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onOpen({
                        title: release.title,
                        subtitle: `Release ${release.id}`,
                        body: "",
                        meta: [],
                        release: releaseDetail,
                      })
                    }
                    className="line-clamp-2 cursor-pointer text-left font-medium hover:text-primary"
                  >
                    {release.title}
                  </button>
                  <span>
                    <span className="block truncate">{release.owner || "Não informado"}</span>
                    <span className="text-muted-foreground">{release.status}</span>
                  </span>
                  <span className="text-primary">{formatCatalogDate(release.updatedAt)}</span>
                  <span className="flex items-center justify-end gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 cursor-pointer"
                      title="Abrir release na Base de Conhecimento"
                    >
                      <Link to="/base-de-conhecimento" search={{ release: release.id }}>
                        <Globe2 className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 cursor-pointer"
                      title="Visualizar release"
                      onClick={() =>
                        onOpen({
                          title: release.title,
                          subtitle: `Release ${release.id}`,
                          body: "",
                          meta: [],
                          release: releaseDetail,
                        })
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </span>
                </div>
              );
            })}
        </HadronDashboardPanel>
      </div>
    </div>
  );
}

function HadronDashboardPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-80 overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="flex items-baseline gap-2 border-b px-3 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-[10px] text-primary">{subtitle}</span>
      </div>
      <div className="max-h-80 overflow-y-auto">{children}</div>
    </section>
  );
}

function HadronOccurrenceRows({
  rows,
  onOpen,
  empty,
  variant = "review",
}: {
  rows: ReturnType<typeof useTickets>;
  onOpen: (d: Detail) => void;
  empty: string;
  variant?: "review" | "general";
}) {
  if (!rows.length) return <p className="p-6 text-center text-xs text-muted-foreground">{empty}</p>;
  if (variant === "general")
    return (
      <>
        <div className="grid grid-cols-[28px_92px_minmax(130px,0.8fr)_minmax(220px,1.5fr)_92px_38px] gap-2 border-b bg-muted/25 px-3 py-2 text-[10px] uppercase text-muted-foreground">
          <span>Tipo</span>
          <span>Opção/Form.</span>
          <span>Descrição</span>
          <span>Ocorrência</span>
          <span>Operador</span>
          <span />
        </div>
        {rows.map((ticket) => {
          const option = findTicketOption(ticket);
          return (
            <button
              key={ticket.id}
              type="button"
              onClick={() => openOccurrence(ticket, option, onOpen)}
              className="grid w-full cursor-pointer grid-cols-[28px_92px_minmax(130px,0.8fr)_minmax(220px,1.5fr)_92px_38px] items-center gap-2 border-b px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted/40"
            >
              <OccurrenceTypeIcon ticket={ticket} />
              <span className="truncate font-medium">
                {option ? `${option.option}/${option.form || option.option}` : ticket.module}
              </span>
              <span className="line-clamp-2 font-medium leading-4">
                {option?.description || ticket.subject}
              </span>
              <span className="line-clamp-2 leading-4 text-muted-foreground">
                {htmlToText(ticket.description || ticket.subject)}
              </span>
              <OccurrenceDate value={ticket.openedAt} operator={ticket.owner} />
              <span
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground"
                title="Ver prévia"
              >
                <ClipboardCheck className="h-4 w-4" />
              </span>
            </button>
          );
        })}
      </>
    );
  return (
    <>
      <div className="grid grid-cols-[28px_92px_minmax(150px,1fr)_88px_88px_38px] gap-2 border-b bg-muted/25 px-3 py-2 text-[10px] uppercase text-muted-foreground">
        <span>Tipo</span>
        <span>Opç./Form.</span>
        <span>Detalhes</span>
        <span>Ocorrência</span>
        <span>Solução</span>
        <span />
      </div>
      {rows.map((ticket) => {
        const option = findTicketOption(ticket);
        return (
          <button
            key={ticket.id}
            onClick={() => openOccurrence(ticket, option, onOpen)}
            className="grid w-full cursor-pointer grid-cols-[28px_92px_minmax(150px,1fr)_88px_88px_38px] items-center gap-2 border-b px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted/40"
          >
            <OccurrenceTypeIcon ticket={ticket} />
            <span className="truncate font-medium">
              {option ? `${option.option}/${option.form || option.option}` : ticket.module}
            </span>
            <span className="line-clamp-2 leading-4">{ticket.description || ticket.subject}</span>
            <OccurrenceDate value={ticket.openedAt} operator={ticket.owner} />
            <OccurrenceDate
              value={ticket.closedAt}
              operator={ticket.closedAt ? ticket.owner : ""}
            />
            <span
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground"
              title="Ver detalhes"
            >
              <ClipboardCheck className="h-4 w-4" />
            </span>
          </button>
        );
      })}
    </>
  );
}

type HadronOptionStatus =
  "desenvolvimento" | "testes" | "correcoes" | "aprovada" | "hadron" | "desativada";

const HADRON_OPTION_MODULES: [string, string][] = [
  ["todos", "Módulo"],
  ["0", "0 : RESUMO DA VERSÃO"],
  ["1", "1 : BÁSICO"],
  ["5", "5 : VENDAS"],
  ["9", "9 : COMPRAS"],
  ["13", "13 : FINANCEIRO"],
  ["17", "17 : CONTROLE DE ESTOQUES"],
  ["21", "21 : PRODUÇÃO"],
  ["25", "25 : RECURSOS HUMANOS"],
  ["29", "29 : FISCAL"],
  ["33", "33 : CONTÁBIL"],
  ["37", "37 : GESTÃO RURAL"],
  ["41", "41 : TRANSPORTES"],
  ["45", "45 : COMBUSTÍVEIS"],
  ["80", "80 : OUTROS MÓDULOS"],
];

const HADRON_OPTION_CHARACTERISTICS: [string, string][] = [
  ["todos", "Característica"],
  ["f3", "F3"],
  ["abas", "Abas"],
  ["rhcd", "RHCD"],
  ["geral", "Geral"],
  ["cadastro", "Cadastro"],
  ["gerencia", "Gerência"],
  ["listagem", "Listagem"],
  ["listview", "Grids/List View"],
  ["processos", "Processos"],
  ["elaborado", "Elaborado"],
  ["relatorios", "Relatórios"],
  ["especifico", "Específico"],
  ["outros_c_acp", "Outros c/ ACP"],
  ["outros_s_acp", "Outros s/ ACP"],
];

function getHadronOptionStatus(
  option: HadronOption,
  activeCount: number,
  disabled: boolean,
): HadronOptionStatus {
  if (disabled || option.status === "90") return "desativada";
  if (option.status === "10") return "hadron";
  if (option.status === "9") return "testes";
  if (option.status === "8") return "aprovada";
  if (option.status === "4" || activeCount > 0) return "correcoes";
  return "desenvolvimento";
}

function getHadronOptionDate(
  option: HadronOption,
  latest: TicketRow | undefined,
  related: TicketRow[],
  dateType: string,
) {
  if (dateType === "criacao") return latest?.openedAt || option.updatedAt;
  if (dateType === "liberacao") return latest?.closedAt || latest?.updatedAt || option.updatedAt;
  const approved = related
    .filter((ticket) => ticket.status === "Finalizado")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return approved?.closedAt || approved?.updatedAt || option.updatedAt;
}

function OptionsTable({ query }: TableProps) {
  const tickets = useTickets();
  const { session } = usePortalAuth();
  const [optionOverrides, setOptionOverrides] = useState<Record<string, Partial<HadronOption>>>({});
  const [disabledOptions, setDisabledOptions] = useState<string[]>([]);
  const [viewingOption, setViewingOption] = useState<HadronOption | null>(null);
  const [previewingOption, setPreviewingOption] = useState<HadronOption | null>(null);
  const [editingOption, setEditingOption] = useState<HadronOption | null>(null);
  const [deactivatingOption, setDeactivatingOption] = useState<HadronOption | null>(null);
  const [optionLocks, setOptionLocks] = useState<Record<string, HadronOptionLock>>({});
  const [optionQuery, setOptionQuery] = useState("");
  const [formQuery, setFormQuery] = useState("");
  const [operator, setOperator] = useState("todos");
  const [hadronScope, setHadronScope] = useState("todos");
  const [characteristic, setCharacteristic] = useState("todos");
  const [module, setModule] = useState("todos");
  const [dateType, setDateType] = useState("criacao");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    try {
      setOptionOverrides(JSON.parse(localStorage.getItem("hadron-option-overrides") || "{}"));
      setDisabledOptions(JSON.parse(localStorage.getItem("hadron-disabled-options") || "[]"));
    } catch {
      setOptionOverrides({});
      setDisabledOptions([]);
    }
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listHadronOptionLocks()
        .then((locks) => active && setOptionLocks(locks))
        .catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!viewingOption) return;
    const returnToOptions = () => {
      setEditingOption(null);
      setViewingOption(null);
    };
    window.addEventListener("popstate", returnToOptions);
    return () => window.removeEventListener("popstate", returnToOptions);
  }, [viewingOption]);
  const optionsWithTickets = useMemo(() => {
    const grouped = new Map<string, TicketRow[]>();
    tickets.forEach((ticket) => {
      const optionId = findTicketOption(ticket)?.id;
      if (!optionId) return;
      const group = grouped.get(optionId) || [];
      group.push(ticket);
      grouped.set(optionId, group);
    });
    return hadronOptions.map((sourceOption) => {
      const option = { ...sourceOption, ...optionOverrides[sourceOption.id] };
      const related = grouped.get(option.id) || [];
      const active = related.filter(
        (ticket) => !["Finalizado", "Cancelado"].includes(ticket.status),
      );
      const latest = related.reduce<TicketRow | undefined>(
        (current, ticket) => (!current || ticket.updatedAt > current.updatedAt ? ticket : current),
        undefined,
      );
      return { option, active, latest, related, disabled: disabledOptions.includes(option.id) };
    });
  }, [disabledOptions, optionOverrides, tickets]);
  const operators = useMemo(
    () => [...new Set(tickets.map((ticket) => ticket.owner).filter(Boolean))].sort(),
    [tickets],
  );
  const rows = useMemo(() => {
    const global = normalizeOccurrenceText(query);
    const optionFilter = normalizeOccurrenceText(optionQuery);
    const formFilter = normalizeOccurrenceText(formQuery);
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return optionsWithTickets.filter(({ option, active, latest, related, disabled }) => {
      const searchable = normalizeOccurrenceText(
        [
          option.option,
          option.form,
          option.description,
          latest?.subject,
          latest?.owner,
          latest?.module,
        ]
          .filter(Boolean)
          .join(" "),
      );
      const rawDate = getHadronOptionDate(option, latest, related, dateType);
      const dateValue = rawDate ? new Date(rawDate).getTime() : null;
      const status = getHadronOptionStatus(option, active.length, disabled);
      return (
        (!global || searchable.includes(global)) &&
        (!optionFilter ||
          normalizeOccurrenceText(`${option.option} ${option.description}`).includes(
            optionFilter,
          )) &&
        (!formFilter || normalizeOccurrenceText(option.form).includes(formFilter)) &&
        (operator === "todos" || latest?.owner === operator) &&
        (hadronScope === "todos"
          ? status !== "desativada"
          : hadronScope === "exceto"
            ? status !== "hadron" && status !== "desativada"
            : status === hadronScope) &&
        (characteristic === "todos" || option.characteristic === characteristic) &&
        (module === "todos" || option.moduleId === module) &&
        (from === null || (dateValue !== null && dateValue >= from)) &&
        (to === null || (dateValue !== null && dateValue <= to))
      );
    });
  }, [
    characteristic,
    dateFrom,
    dateTo,
    dateType,
    formQuery,
    hadronScope,
    module,
    operator,
    optionQuery,
    optionsWithTickets,
    query,
  ]);
  const clearFilters = () => {
    setOptionQuery("");
    setFormQuery("");
    setOperator("todos");
    setHadronScope("todos");
    setCharacteristic("todos");
    setModule("todos");
    setDateType("criacao");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const optionSummary = useMemo(() => {
    const counts = {
      development: 0,
      corrections: 0,
      tests: 0,
      approved: 0,
      hadron: 0,
    };
    const activeDates: number[] = [];
    const now = Date.now();

    optionsWithTickets.forEach(({ option, active, disabled }) => {
      active.forEach((ticket) => {
        const openedAt = new Date(ticket.openedAt).getTime();
        if (Number.isFinite(openedAt)) activeDates.push(openedAt);
      });

      const status = getHadronOptionStatus(option, active.length, disabled);
      if (status === "desativada") return;
      if (status === "hadron") counts.hadron += 1;
      else if (status === "testes") counts.tests += 1;
      else if (status === "desenvolvimento") counts.development += 1;
      else if (status === "correcoes") counts.corrections += 1;
      else if (status === "aprovada") counts.approved += 1;
    });

    const averageDelay = activeDates.length
      ? Math.round(
          activeDates.reduce(
            (total, openedAt) => total + Math.max(0, (now - openedAt) / 86_400_000),
            0,
          ) / activeDates.length,
        )
      : 0;

    return { ...counts, averageDelay };
  }, [optionsWithTickets]);
  const persistOverride = (option: HadronOption) => {
    const next = { ...optionOverrides, [option.id]: option };
    setOptionOverrides(next);
    localStorage.setItem("hadron-option-overrides", JSON.stringify(next));
    setEditingOption(null);
    if (viewingOption?.id === option.id) setViewingOption(option);
  };
  const deactivateOption = () => {
    if (!deactivatingOption) return;
    const next = [...new Set([...disabledOptions, deactivatingOption.id])];
    setDisabledOptions(next);
    localStorage.setItem("hadron-disabled-options", JSON.stringify(next));
    setDeactivatingOption(null);
  };
  const openLockedOption = async (option: HadronOption, edit = false) => {
    if (!session?.user.id) {
      toast.error("Sua sessão não está disponível.");
      return;
    }
    const operator = currentUser.operator || currentUser.name;
    try {
      const result = await acquireHadronOptionLock(option.id, operator);
      if (!result.acquired) {
        toast.error(`Opção ocupada por ${result.lockedBy}.`);
        void listHadronOptionLocks().then(setOptionLocks);
        return;
      }
      setOptionLocks((current) => ({
        ...current,
        [option.id]: {
          optionId: option.id,
          userId: session.user.id,
          operator,
          lockedAt: new Date().toISOString(),
        },
      }));
      window.history.pushState(
        { ...window.history.state, hadronOptionId: option.id },
        "",
        window.location.href,
      );
      setViewingOption(option);
      if (edit) setEditingOption(option);
    } catch {
      toast.error("Não foi possível reservar esta opção.");
    }
  };
  const returnToOptions = () => {
    setEditingOption(null);
    if (window.history.state?.hadronOptionId === viewingOption?.id) {
      window.history.back();
      return;
    }
    setViewingOption(null);
  };
  const leaveOption = async () => {
    if (!viewingOption) return;
    const optionId = viewingOption.id;
    try {
      await releaseHadronOptionLock(optionId);
      setOptionLocks((current) => {
        const next = { ...current };
        delete next[optionId];
        return next;
      });
      setEditingOption(null);
      setViewingOption(null);
      if (window.history.state?.hadronOptionId === optionId) window.history.back();
    } catch {
      toast.error("Não foi possível liberar esta opção.");
    }
  };
  if (viewingOption) {
    const row = optionsWithTickets.find(({ option }) => option.id === viewingOption.id);
    return (
      <>
        <HadronOptionPage
          option={row?.option || viewingOption}
          tickets={row?.related || []}
          disabled={row?.disabled || false}
          onBack={returnToOptions}
          onExit={() => void leaveOption()}
          onEdit={() => setEditingOption(row?.option || viewingOption)}
        />
        <OptionEditDialog
          option={editingOption}
          onClose={() => setEditingOption(null)}
          onSave={persistOverride}
        />
      </>
    );
  }
  return (
    <>
      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-4">
          <h2 className="text-lg font-medium">Opções</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_.8fr_.75fr_.8fr_.8fr_.8fr_.75fr_.72fr_.72fr_auto]">
            <Input
              value={optionQuery}
              onChange={(event) => {
                setOptionQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Opção"
            />
            <Input
              value={formQuery}
              onChange={(event) => {
                setFormQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Formulário"
              className="text-xs placeholder:text-xs"
            />
            <OccurrenceSelect
              value={operator}
              onValueChange={(value) => {
                setOperator(value);
                setPage(1);
              }}
              items={[
                ["todos", "Operador"],
                ...operators.map((item) => [item, item] as [string, string]),
              ]}
            />
            <OccurrenceSelect
              value={hadronScope}
              onValueChange={(value) => {
                setHadronScope(value);
                setPage(1);
              }}
              items={[
                ["todos", "Status"],
                ["desenvolvimento", "Desenvolvimento"],
                ["testes", "Testes"],
                ["correcoes", "Correções"],
                ["aprovada", "Aprovada"],
                ["hadron", "Hádron"],
                ["desativada", "Desativada"],
                ["exceto", "Exceto HÁDRON"],
              ]}
            />
            <OccurrenceSelect
              value={characteristic}
              onValueChange={(value) => {
                setCharacteristic(value);
                setPage(1);
              }}
              items={HADRON_OPTION_CHARACTERISTICS}
            />
            <OccurrenceSelect
              value={module}
              onValueChange={(value) => {
                setModule(value);
                setPage(1);
              }}
              items={HADRON_OPTION_MODULES}
            />
            <OccurrenceSelect
              value={dateType}
              onValueChange={(value) => {
                setDateType(value);
                setPage(1);
              }}
              items={[
                ["criacao", "Criação"],
                ["liberacao", "Liberação Cliente"],
                ["aprovacao", "Aprovação"],
              ]}
            />
            <DateRangeFilter
              from={dateFrom}
              to={dateTo}
              onChange={(start, end) => {
                setDateFrom(start);
                setDateTo(end);
                setPage(1);
              }}
            />
            <Button type="button" className="cursor-pointer px-7">
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="mt-3 cursor-pointer"
          >
            Limpar
          </Button>
        </div>
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-left text-[11px] xl:text-xs">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[3%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[19%]" />
              <col className="w-[15%]" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="border-b bg-muted/25 text-primary">
              <tr>
                {[
                  "Status",
                  "P",
                  "Opção",
                  "Formulário",
                  "Descrição",
                  "Chamada",
                  "Data",
                  "DLL EXE",
                  "Módulo / Submódulo",
                  "Responsável",
                  "Ações",
                ].map((header) => (
                  <th key={header} className="break-words px-2 py-3 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map(({ option, active, latest, related, disabled }) => {
                const optionLock = optionLocks[option.id];
                const lockedByAnother = Boolean(
                  optionLock && optionLock.userId !== session?.user.id,
                );
                const optionStatus = getHadronOptionStatus(option, active.length, disabled);
                const statusDisplay = {
                  desenvolvimento: {
                    label: "DESENVOLVIMENTO",
                    className: "bg-slate-600 text-white hover:bg-slate-600",
                  },
                  correcoes: {
                    label: active.length ? `CORREÇÕES ${active.length}` : "CORREÇÕES",
                    className: "bg-rose-600 text-white hover:bg-rose-600",
                  },
                  testes: {
                    label: "TESTES",
                    className: "bg-amber-500 text-white hover:bg-amber-500",
                  },
                  aprovada: {
                    label: "APROVADA",
                    className: "bg-cyan-600 text-white hover:bg-cyan-600",
                  },
                  hadron: {
                    label: "HÁDRON",
                    className: "bg-lime-600 text-white hover:bg-lime-600",
                  },
                  desativada: {
                    label: "DESATIVADA",
                    className: "bg-muted text-muted-foreground hover:bg-muted",
                  },
                }[optionStatus];
                const priority = normalizeOptionPriority(option.priority).label;
                return (
                  <tr
                    key={option.id}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/40",
                      optionStatus === "correcoes" && "bg-rose-50/80 dark:bg-rose-950/20",
                      disabled && "opacity-55",
                    )}
                  >
                    <td className="px-2 py-3">
                      <Badge className={cn("whitespace-nowrap", statusDisplay.className)}>
                        {statusDisplay.label}
                      </Badge>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        title={`Prioridade ${priority}`}
                        className={cn(
                          "block h-3 w-3 rounded-full",
                          priority === "Alta"
                            ? "bg-rose-500"
                            : priority === "Media"
                              ? "bg-amber-500"
                              : "bg-emerald-500",
                        )}
                      />
                    </td>
                    <td className="break-words px-2 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {option.option}
                        {optionLock && (
                          <span
                            className="grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-white"
                            title={`Ocupada por ${optionLock.operator}`}
                          >
                            <Minus className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="break-words px-2 py-3">{option.form || "Não informado"}</td>
                    <td className="break-words px-2 py-3 text-primary">{option.description}</td>
                    <td className="break-words px-2 py-3">{option.call || "Não informado"}</td>
                    <td className="break-words px-2 py-3">
                      {option.openedAt ? formatCatalogDate(option.openedAt) : "Não informado"}
                    </td>
                    <td className="break-words px-2 py-3">
                      {option.executable || "Não informado"}
                    </td>
                    <td className="break-words px-2 py-3">
                      {[option.moduleId, option.submoduleId].filter(Boolean).join(" - ") ||
                        "Não informado"}
                    </td>
                    <td className="break-words px-2 py-3">{option.owner || "Não informado"}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center gap-0">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Prévia das ocorrências"
                          className="h-7 w-7 cursor-pointer"
                          onClick={() => setPreviewingOption(option)}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Visualizar opção"
                          className="h-7 w-7 cursor-pointer"
                          disabled={lockedByAnother}
                          onClick={() => void openLockedOption(option)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Editar opção"
                          className="h-7 w-7 cursor-pointer"
                          disabled={lockedByAnother}
                          onClick={() => void openLockedOption(option, true)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Desativar opção"
                          disabled={disabled}
                          className="h-7 w-7 cursor-pointer text-destructive hover:text-destructive"
                          onClick={() => setDeactivatingOption(option)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma opção encontrada com os filtros aplicados.
            </p>
          )}
        </div>
        <div className="border-t bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Média de atraso:</strong>{" "}
            {optionSummary.averageDelay} dias (sendo exibido)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ["DESENVOLVIMENTO", optionSummary.development, "bg-slate-600", "desenvolvimento"],
              ["CORREÇÕES", optionSummary.corrections, "bg-rose-600", "correcoes"],
              ["TESTES", optionSummary.tests, "bg-amber-500", "testes"],
              ["APROVADA", optionSummary.approved, "bg-cyan-600", "aprovada"],
              ["HÁDRON", optionSummary.hadron, "bg-lime-600", "hadron"],
            ].map(([label, count, color, filter]) => (
              <button
                type="button"
                key={String(label)}
                onClick={() => {
                  setHadronScope(String(filter));
                  setPage(1);
                }}
                aria-pressed={hadronScope === filter}
                className={cn(
                  "inline-flex cursor-pointer items-center px-2 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  color,
                  hadronScope === filter && "ring-2 ring-ring ring-offset-2",
                )}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>
        {!!rows.length && (
          <TablePagination
            noun="opções"
            page={safePage}
            pageCount={pageCount}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        )}
      </section>
      <OptionOccurrencesPreviewDialog
        option={previewingOption}
        onClose={() => setPreviewingOption(null)}
      />
      <OptionEditDialog
        option={editingOption}
        onClose={() => setEditingOption(null)}
        onSave={persistOverride}
      />
      <Dialog
        open={!!deactivatingOption}
        onOpenChange={(open) => !open && setDeactivatingOption(null)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Desativar opção?</DialogTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            A opção{" "}
            <strong className="font-medium text-foreground">
              {deactivatingOption?.option} - {deactivatingOption?.description}
            </strong>{" "}
            ficará marcada como desativada. Os dados e as ocorrências existentes serão preservados.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeactivatingOption(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deactivateOption}>
              Desativar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HadronOptionPage({
  option,
  tickets,
  disabled,
  onBack,
  onExit,
  onEdit,
}: {
  option: HadronOption;
  tickets: TicketRow[];
  disabled: boolean;
  onBack: () => void;
  onExit: () => void;
  onEdit: () => void;
}) {
  const priority = normalizeOptionPriority(option.priority);
  const PriorityIcon = priority.icon;
  const moduleName = getOptionModuleName(option);
  const submoduleName = getOptionSubmoduleName(option);
  return (
    <section className="space-y-4">
      <header className="rounded-md border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Voltar para opções"
              onClick={onBack}
              className="cursor-pointer"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-medium">
                  {option.option} - {option.description}
                </h2>
                <Badge variant={disabled ? "secondary" : "outline"}>
                  {disabled ? "Desativada" : hadronOptionStatusLabel(option.status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-primary">{moduleName}</span>
                {" / "}
                <span className="font-medium text-primary">{submoduleName}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onEdit} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" />
              Alterar
            </Button>
            <Button type="button" onClick={onExit} className="cursor-pointer">
              Sair
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-x-5 gap-y-3 border-t pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <OptionHeaderMeta label="Data" value={formatCatalogDate(option.openedAt)} />
          <OptionHeaderMeta label="Responsável" value={option.owner} />
          <OptionHeaderMeta label="Tester" value={option.tester} />
          <OptionHeaderMeta label="Formulário" value={option.form} />
          <OptionHeaderMeta label="DLL/EXE" value={option.executable} />
          <OptionHeaderMeta label="Liberação" value={option.releaseOwner} />
          <OptionHeaderMeta
            label="Aprovação"
            value={joinOptionMeta(formatCatalogDate(option.approvedAt), option.approvalOwner)}
          />
          <OptionHeaderMeta
            label="Hádron"
            value={joinOptionMeta(formatCatalogDate(option.hadronAt), option.hadronOwner)}
          />
        </div>
        {option.observation && (
          <p className="mt-4 border-t pt-4 text-sm leading-6">{option.observation}</p>
        )}
      </header>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-md border bg-card p-4 shadow-sm">
          <Tabs defaultValue="ocorrencias">
            <TabsList className="justify-start bg-transparent p-0">
              <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
              <TabsTrigger value="releases">Releases</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="ocorrencias" className="mt-5">
              <OptionImportedOccurrences option={option} />
            </TabsContent>
            <TabsContent
              value="releases"
              className="mt-5 rounded-md border bg-background p-5 text-sm text-muted-foreground"
            >
              Os releases desta opção são apresentados na aba Releases do Hádron.
            </TabsContent>
            <TabsContent value="logs" className="mt-5 space-y-2">
              {tickets.length ? (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm"
                  >
                    <span>{ticket.subject}</span>
                    <span className="text-muted-foreground">
                      {ticket.owner} · {formatOccurrenceDate(ticket.updatedAt)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum log disponível.</p>
              )}
            </TabsContent>
          </Tabs>
        </section>
        <aside className="space-y-4 rounded-md border bg-card p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
            <Badge
              className={
                disabled
                  ? "mt-2 bg-muted text-muted-foreground hover:bg-muted"
                  : "mt-2 bg-rose-600 text-white hover:bg-rose-600"
              }
            >
              {disabled ? "DESATIVADA" : hadronOptionStatusLabel(option.status).toUpperCase()}
            </Badge>
          </div>
          <div className="border-t pt-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Prioridade</p>
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                priority.className,
              )}
            >
              <PriorityIcon className="h-3.5 w-3.5" />
              {priority.label}
            </span>
          </div>
          <div className="border-t pt-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Checklist</p>
            <div className="mt-3 space-y-2">
              {hadronChecklist.slice(0, 8).map((item) => (
                <label key={item[0]} className="flex items-center justify-between gap-3 text-xs">
                  <span>{item[2]}</span>
                  <input
                    type="checkbox"
                    checked={item[4]}
                    readOnly
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="border-t pt-4 text-xs text-muted-foreground">
            <p>
              Responsável:{" "}
              <span className="text-foreground">{option.owner || "Não informado"}</span>
            </p>
            <p className="mt-2">
              Formulário: <span className="text-foreground">{option.form || "Não informado"}</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function OptionHeaderMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium" title={value || "Não informado"}>
        {value || "Não informado"}
      </p>
    </div>
  );
}

function joinOptionMeta(date: string, owner: string) {
  return [date !== "-" ? date : "", owner].filter(Boolean).join(" · ");
}

function getOptionModuleName(option: HadronOption) {
  const moduleName = HADRON_OPTION_MODULES.find(([id]) => id === option.moduleId)?.[1]
    .replace(/^\d+\s*:\s*/, "")
    .replace("BÁSICO", "BASICO");
  return moduleName
    ? moduleName
    : option.moduleId
      ? `Módulo ${option.moduleId}`
      : "Módulo não informado";
}

function getOptionSubmoduleName(option: HadronOption) {
  const legacyNames: Record<string, string> = {
    "1:20": "CADASTROS BÁSICOS",
  };
  const legacyName = legacyNames[`${option.moduleId}:${option.submoduleId}`];
  if (legacyName) return legacyName;
  const submodules = modulesMap[getOptionModuleName(option)] || [];
  const index = Number(option.submoduleId) / 10 - 2;
  return Number.isInteger(index) && submodules[index]
    ? submodules[index]
    : option.submoduleId
      ? `Submódulo ${option.submoduleId}`
      : "Submódulo não informado";
}

function OptionEditDialog({
  option,
  onClose,
  onSave,
}: {
  option: HadronOption | null;
  onClose: () => void;
  onSave: (option: HadronOption) => void;
}) {
  const [draft, setDraft] = useState<HadronOption | null>(option);
  const { collaborators } = useCollaborators();
  useEffect(() => setDraft(option), [option]);
  const tagSuggestions = useMemo(
    () =>
      [
        ...new Set(
          hadronOptions
            .flatMap((item) => item.tags.split(/[,;]+/))
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [],
  );
  if (!draft) return null;
  const update = (field: keyof HadronOption, value: string) =>
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  const selectedModule = getOptionModuleName(draft);
  const availableSubmodules = modulesMap[selectedModule] || [];
  return (
    <Dialog open={!!option} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[calc(100vh-2rem)] max-h-[760px] w-[calc(100vw-2rem)] max-w-[940px] flex-col gap-0 overflow-hidden rounded-2xl border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&>button]:hidden">
        <DialogTitle className="sr-only">Alterar opção Hádron</DialogTitle>
        <DetailModalHeader
          dense
          icon={Pencil}
          title={draft.description || "Opção Hádron"}
          protocol={draft.option}
          meta="Alterar opção Hádron"
          onClose={onClose}
        />
        <Tabs defaultValue="opcao" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className="mx-6 mt-2 shrink-0 justify-start bg-transparent p-0">
            <TabsTrigger value="opcao">OPÇÃO</TabsTrigger>
            <TabsTrigger value="checklist">CHECKLIST</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
            <TabsContent value="opcao" className="mt-3 space-y-4 pb-2">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
                <label className="space-y-2 text-[12.5px] font-medium text-foreground">
                  Nome da opção
                  <Input
                    className="font-normal text-foreground"
                    value={draft.description}
                    onChange={(event) => update("description", event.target.value)}
                  />
                </label>
                <div>
                  <p className="mb-2 text-[12.5px] font-medium text-foreground">Prioridade</p>
                  <HadronPrioritySegmented
                    value={draft.priority}
                    onChange={(value) => update("priority", value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <OptionField
                  label="Opção"
                  value={draft.option}
                  onChange={(value) => update("option", value)}
                />
                <OptionField
                  label="Formulário"
                  value={draft.form}
                  onChange={(value) => update("form", value)}
                />
                <OptionField
                  label="DLL/EXE"
                  value={draft.executable}
                  onChange={(value) => update("executable", value)}
                />
                <OptionField
                  label="Chamada"
                  value={draft.call}
                  onChange={(value) => update("call", value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <OptionSelect
                  label="Responsável"
                  value={draft.owner}
                  onChange={(value) => update("owner", value)}
                  options={collaborators.map((item) => ({
                    value: item.acronym || item.id,
                    label: collaboratorLabel(item),
                  }))}
                />
                <OptionSelect
                  label="Tester"
                  value={draft.tester}
                  onChange={(value) => update("tester", value)}
                  options={collaborators.map((item) => ({
                    value: item.acronym || item.id,
                    label: collaboratorLabel(item),
                  }))}
                />
                <OptionSelect
                  label="Característica"
                  value={draft.characteristic || "cadastro"}
                  onChange={(value) => update("characteristic", value)}
                  options={HADRON_OPTION_CHARACTERISTICS.slice(1).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
                <label className="flex items-end gap-2 pb-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={draft.listView === "1"}
                    onChange={(event) => update("listView", event.target.checked ? "1" : "0")}
                    className="h-4 w-4 accent-primary"
                  />
                  Grids/List View
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <OptionSelect
                  label="Módulo"
                  value={draft.moduleId}
                  onChange={(value) => {
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            moduleId: value,
                            submoduleId: "20",
                          }
                        : current,
                    );
                  }}
                  options={HADRON_OPTION_MODULES.slice(1).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
                <OptionSelect
                  label="Submódulo"
                  value={getOptionSubmoduleName(draft)}
                  onChange={(value) =>
                    update("submoduleId", String((availableSubmodules.indexOf(value) + 2) * 10))
                  }
                  options={availableSubmodules.map((value) => ({ value, label: value }))}
                />
              </div>
              <label className="block space-y-2 text-[12.5px] font-medium text-foreground">
                Tags
                <Input
                  list="hadron-option-tags"
                  className="font-normal text-foreground"
                  value={draft.tags}
                  onChange={(event) => update("tags", event.target.value)}
                  placeholder="Digite ou selecione uma tag"
                />
                <datalist id="hadron-option-tags">
                  {tagSuggestions.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </label>
              <label className="block space-y-2 text-[12.5px] font-medium text-foreground">
                Descrição da opção
                <textarea
                  value={draft.observation}
                  onChange={(event) => update("observation", event.target.value)}
                  className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </TabsContent>
            <TabsContent value="checklist" className="mt-4 pb-2">
              <div className="divide-y rounded-md border">
                {hadronChecklist.map((item) => (
                  <label
                    key={item[0]}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 text-sm"
                  >
                    <span>
                      <strong className="font-medium">{item[2]}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">{item[3]}</span>
                    </span>
                    <input
                      type="checkbox"
                      defaultChecked={item[4]}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <DialogFooter className="shrink-0 gap-2 border-t bg-card px-5 py-2.5 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={() => onSave(draft)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-2 text-[12.5px] font-medium text-foreground">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full cursor-pointer text-[13px] font-normal text-foreground">
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function OptionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2 text-[12.5px] font-medium text-foreground">
      {label}
      <Input
        className="font-normal text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function HadronPrioritySegmented({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const priorities = [
    {
      value: "0",
      label: "Baixa",
      icon: ChevronDown,
      base: "border-success/25 bg-success/10 dark:bg-success/15",
      active: "border-success/70 bg-success/15 ring-2 ring-success/40 shadow-sm",
      iconClass: "bg-success text-success-foreground",
      textClass: "text-success",
    },
    {
      value: "1",
      label: "Média",
      icon: Minus,
      base: "border-warning/30 bg-warning/12 dark:bg-warning/15",
      active: "border-warning/70 bg-warning/20 ring-2 ring-warning/40 shadow-sm",
      iconClass: "bg-warning text-warning-foreground",
      textClass: "text-warning-foreground",
    },
    {
      value: "2",
      label: "Alta",
      icon: ArrowUp,
      base: "border-destructive/25 bg-destructive/10 dark:bg-destructive/15",
      active: "border-destructive/70 bg-destructive/15 ring-2 ring-destructive/40 shadow-sm",
      iconClass: "bg-destructive text-destructive-foreground",
      textClass: "text-destructive",
    },
  ];
  return (
    <div role="radiogroup" aria-label="Prioridade" className="grid grid-cols-3 gap-2">
      {priorities.map((priority) => {
        const Icon = priority.icon;
        const active = value === priority.value;
        return (
          <button
            key={priority.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(priority.value)}
            className={cn(
              "flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              priority.base,
              active && priority.active,
            )}
          >
            <span
              className={cn("grid h-4 w-4 place-items-center rounded-full", priority.iconClass)}
            >
              <Icon className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <span className={priority.textClass}>{priority.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function openImportedOccurrence(
  occurrence: HadronOccurrence,
  option: HadronOption | undefined,
  onOpen: (detail: Detail) => void,
) {
  const optionLabel = option
    ? `${option.option}/${option.form || option.option}`
    : occurrence.optionLegacyId;
  onOpen({
    title: "Ocorrência",
    subtitle: `Opção: ${optionLabel}`,
    body: occurrence.occurrenceText || "Sem descrição.",
    meta: [],
    hadronOccurrence: {
      id: occurrence.id,
      option: option?.option || occurrence.optionLegacyId,
      form: option?.form || option?.option || "-",
      kind: occurrence.reviewedAt
        ? "revisado"
        : occurrence.kind === "ocorrencia"
          ? "problema"
          : "solicitacao",
      reporter: occurrence.reporter || "Não informado",
      openedAt: occurrence.occurredAt || "",
      solver: occurrence.solver || "Não informado",
      solvedAt: occurrence.solvedAt,
      description: occurrence.occurrenceHtml || occurrence.occurrenceText,
      solution:
        occurrence.solutionHtml || occurrence.solutionText || "Solução ainda não registrada.",
      status: occurrence.status || occurrence.kind,
      reviewedAt: occurrence.reviewedAt,
      version: occurrence.versionLegacyId,
      baseAddress: occurrence.baseAddress || occurrence.testBase,
    },
  });
}

function OptionImportedOccurrences({
  option,
  latestOnly = false,
}: {
  option: HadronOption;
  latestOnly?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<HadronOccurrence[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const reload = () => setReloadKey((current) => current + 1);
    window.addEventListener("hadron-occurrence-reviewed", reload);
    return () => window.removeEventListener("hadron-occurrence-reviewed", reload);
  }, []);
  const [solutionOccurrence, setSolutionOccurrence] = useState<HadronOccurrence | null>(null);
  const { allCollaborators } = useCollaborators({ onlyActive: false });

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listHadronOccurrences({
      page: latestOnly ? 1 : page,
      pageSize: latestOnly ? 1 : pageSize,
      optionIds: [option.id],
    })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        toast.error("Não foi possível carregar as ocorrências desta opção.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [latestOnly, option.id, page, pageSize, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const collaboratorName = (operator: string) => {
    const collaborator = findCollaborator(allCollaborators, operator);
    return collaborator ? collaboratorLabel(collaborator) : operator || "Não informado";
  };
  return (
    <>
      <div>
        <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {latestOnly
              ? "Última atualização"
              : `${total.toLocaleString("pt-BR")} ocorrências vinculadas`}
          </span>
        </div>
        <div className="py-4">
          {!loading && rows.length > 0 && (
            <ol className="mx-auto max-w-full">
              {rows.map((occurrence, index) => (
                <HadronOccurrenceTimelineItem
                  key={occurrence.id}
                  occurrence={occurrence}
                  reporter={collaboratorName(occurrence.reporter)}
                  solver={collaboratorName(occurrence.solver)}
                  isLast={index === rows.length - 1}
                  onInformSolution={setSolutionOccurrence}
                />
              ))}
            </ol>
          )}
          {!loading && rows.length === 0 && (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              Nenhuma ocorrência vinculada a esta opção.
            </p>
          )}
          {loading && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Carregando ocorrências...
            </p>
          )}
        </div>
        {!latestOnly && !loading && total > 0 && (
          <TablePagination
            noun="ocorrências"
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        )}
      </div>
      <HadronSolutionDialog
        occurrence={solutionOccurrence}
        option={option}
        onClose={() => setSolutionOccurrence(null)}
        onSaved={() => {
          setSolutionOccurrence(null);
          setReloadKey((current) => current + 1);
        }}
      />
    </>
  );
}

function HadronOccurrenceTimelineItem({
  occurrence,
  reporter,
  solver,
  isLast,
  onInformSolution,
}: {
  occurrence: HadronOccurrence;
  reporter: string;
  solver: string;
  isLast: boolean;
  onInformSolution: (occurrence: HadronOccurrence) => void;
}) {
  const reviewed = Boolean(occurrence.reviewedAt);
  const solved = Boolean(
    occurrence.solvedAt && (occurrence.solutionHtml || occurrence.solutionText),
  );
  const color = reviewed ? "#20ad74" : solved ? "#d79531" : "#e43d55";
  const softColor = reviewed
    ? "rgba(32,173,116,.24)"
    : solved
      ? "rgba(215,149,49,.24)"
      : "rgba(228,61,85,.22)";
  const Icon = reviewed ? CheckCircle2 : solved ? Wrench : Bug;
  const openedAt = occurrence.occurredAt || occurrence.sourceCreatedAt;

  return (
    <li className="relative grid min-h-[120px] grid-cols-[60px_minmax(0,1fr)] gap-3">
      {!isLast && (
        <span
          aria-hidden
          className="absolute left-[29px] top-[52px] h-[calc(100%-32px)] w-[3px] -translate-x-1/2 rounded-full"
          style={{ backgroundColor: softColor }}
        />
      )}
      <div className="relative flex justify-center pt-1">
        <span
          aria-hidden
          className="absolute top-0 h-[58px] w-[58px] rounded-full border-[5px]"
          style={{ borderColor: softColor }}
        />
        <span
          aria-hidden
          className="absolute left-1/2 top-[6px] h-2 w-2 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative mt-[13px] grid h-8 w-8 place-items-center rounded-full text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span
          aria-hidden
          className="absolute left-1/2 top-[54px] h-2 w-2 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <article className="min-w-0 pb-7 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span
            className="inline-flex min-w-[96px] items-center justify-center rounded-full px-2.5 py-0.5 font-medium text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            {formatOccurrenceDate(openedAt)}
          </span>
          <span className="font-medium text-foreground">{reporter}</span>
          {occurrence.sourceModifiedAt && (
            <span className="text-muted-foreground">
              Atualizada em {formatOccurrenceDate(occurrence.sourceModifiedAt)}
            </span>
          )}
          {occurrence.reviewedAt && (
            <span className="text-muted-foreground">
              Revisado em {formatOccurrenceDate(occurrence.reviewedAt)} por {reporter}
            </span>
          )}
        </div>
        <h3 className="mt-2 text-[11px] font-semibold uppercase" style={{ color }}>
          {reviewed ? "Ocorrência revisada" : solved ? "Solução informada" : "Ocorrência aberta"}
        </h3>
        <div className="mt-1 text-[13px] leading-5 text-foreground">
          <LegacyRichContent value={occurrence.occurrenceHtml || occurrence.occurrenceText} />
        </div>
        {!solved && (
          <Button
            type="button"
            size="sm"
            className="mt-3 cursor-pointer"
            onClick={() => onInformSolution(occurrence)}
          >
            <Wrench className="mr-2 h-4 w-4" />
            Informar solução
          </Button>
        )}
        {(occurrence.testBase || occurrence.operatingSystem) && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {[
              occurrence.testBase && `Base: ${occurrence.testBase}`,
              occurrence.operatingSystem && `Sistema: ${occurrence.operatingSystem}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {solved && (
          <div className="mt-3 rounded-md border bg-muted/25 p-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{solver}</span>
              <span className="text-muted-foreground">
                {formatOccurrenceDate(occurrence.solvedAt)}
              </span>
            </div>
            <div className="mt-2 text-[13px] leading-5">
              <LegacyRichContent value={occurrence.solutionHtml || occurrence.solutionText} />
            </div>
          </div>
        )}
        {(occurrence.approvedAt ||
          occurrence.hadronAt ||
          occurrence.status ||
          occurrence.modifiedBy) && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-muted-foreground">
            {occurrence.approvedAt && (
              <span>Aprovada em {formatOccurrenceDate(occurrence.approvedAt)}</span>
            )}
            {occurrence.hadronAt && (
              <span>Liberada em {formatOccurrenceDate(occurrence.hadronAt)}</span>
            )}
            {occurrence.status && <span>Status: {hadronOptionStatusLabel(occurrence.status)}</span>}
            {occurrence.modifiedBy && (
              <span>Alterada por {collaboratorNameFallback(occurrence.modifiedBy)}</span>
            )}
          </p>
        )}
      </article>
    </li>
  );
}

function HadronSolutionDialog({
  occurrence,
  option,
  onClose,
  onSaved,
}: {
  occurrence: HadronOccurrence | null;
  option: HadronOption;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [solution, setSolution] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setSolution(""), [occurrence?.id]);
  if (!occurrence) return null;
  const operator = currentUser.operator || currentUser.name;
  const save = async () => {
    if (!solution.trim()) {
      toast.error("Informe a solução da ocorrência.");
      return;
    }
    setSaving(true);
    try {
      await updateHadronOccurrenceSolution({ id: occurrence.id, solution, operator });
      toast.success("Solução registrada com sucesso.");
      onSaved();
    } catch {
      toast.error("Não foi possível registrar a solução.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[940px] flex-col gap-0 overflow-hidden rounded-2xl border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&>button]:hidden">
        <DialogTitle className="sr-only">Informar solução</DialogTitle>
        <DetailModalHeader
          dense
          icon={Wrench}
          protocol={option.option}
          title={option.description}
          meta="Informar solução"
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/20 p-4">
            <p className="mb-2 text-[12.5px] font-medium text-foreground">Ocorrência</p>
            <LegacyRichContent value={occurrence.occurrenceHtml || occurrence.occurrenceText} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SolutionMeta label="Tipo" value="Ocorrência" />
            <SolutionMeta label="Operador" value={operator} />
            <SolutionMeta
              label="Cliente ou caminho da base"
              value={occurrence.baseAddress || occurrence.testBase || "Não informado"}
            />
            <SolutionMeta label="Versão" value={occurrence.versionLegacyId || "Não informada"} />
          </div>
          <label className="block space-y-2 text-[12.5px] font-medium text-foreground">
            Solução
            <textarea
              value={solution}
              onChange={(event) => setSolution(event.target.value)}
              rows={7}
              placeholder="Descreva a correção realizada, testes e orientações necessárias..."
              className="w-full resize-y rounded-md border bg-background p-3 text-[13px] font-normal text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t bg-card px-5 py-3 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !solution.trim()}>
            <Wrench className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar solução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SolutionMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-foreground">{label}</p>
      <p className="mt-1 min-h-9 rounded-md border bg-muted/15 px-3 py-2 text-[13px] text-foreground">
        {value}
      </p>
    </div>
  );
}

function collaboratorNameFallback(operator: string) {
  return operator || "Não informado";
}

function hadronOptionStatusLabel(status: string) {
  return (
    {
      "4": "Correções",
      "8": "Aprovada",
      "9": "Testes",
      "10": "Hádron",
      "90": "Desativada",
    }[status] ||
    status ||
    "Desenvolvimento"
  );
}

function OptionOccurrencesPreviewDialog({
  option,
  onClose,
}: {
  option: HadronOption | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!option} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden p-0">
        {option && (
          <>
            <div className="border-b px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-lg font-medium">
                Ocorrências <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              </DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Opção: {option.option}</span>
                <Badge className="bg-rose-600 text-white hover:bg-rose-600">CORREÇÕES</Badge>
              </div>
            </div>
            <div className="max-h-[68vh] overflow-y-auto px-5 py-4">
              <OptionImportedOccurrences option={option} latestOnly />
            </div>
            <div className="flex justify-end border-t px-6 py-4">
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportedOccurrencesTable({ query, onOpen }: TableProps) {
  const [optionQuery, setOptionQuery] = useState("");
  const [formQuery, setFormQuery] = useState("");
  const [kind, setKind] = useState("todos");
  const [operator, setOperator] = useState("todos");
  const [userType, setUserType] = useState("todos");
  const [dateType, setDateType] = useState("ocorrencia");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<HadronOccurrence[]>([]);
  const [total, setTotal] = useState(0);
  const [operators, setOperators] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [removingOccurrence, setRemovingOccurrence] = useState<HadronOccurrence | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const reload = () => setReloadKey((current) => current + 1);
    window.addEventListener("hadron-occurrence-reviewed", reload);
    return () => window.removeEventListener("hadron-occurrence-reviewed", reload);
  }, []);

  const optionIds = useMemo(() => {
    const optionTerm = normalizeOccurrenceText(optionQuery);
    const formTerm = normalizeOccurrenceText(formQuery);
    const ownerTerm = userType === "responsavel" && operator !== "todos" ? operator : "";
    if (!optionTerm && !formTerm && !ownerTerm) return undefined;
    const ids = hadronOptions
      .filter(
        (option) =>
          (!optionTerm ||
            normalizeOccurrenceText(`${option.option} ${option.description}`).includes(
              optionTerm,
            )) &&
          (!formTerm || normalizeOccurrenceText(option.form).includes(formTerm)) &&
          (!ownerTerm || option.owner === ownerTerm),
      )
      .map((option) => option.id);
    return ids.length ? ids : ["__none__"];
  }, [formQuery, operator, optionQuery, userType]);

  useEffect(() => {
    void listHadronOccurrenceOperators()
      .then(setOperators)
      .catch(() => setOperators([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void listHadronOccurrences({
        page,
        pageSize,
        optionIds,
        kind,
        operator,
        operatorField:
          userType === "responsavel"
            ? "owner"
            : userType === "ocorrencia"
              ? "reporter"
              : userType === "solucao"
                ? "solver"
                : undefined,
        dateField:
          dateType === "solucao"
            ? "solved_at"
            : dateType === "revisao"
              ? "reviewed_at"
              : "occurred_at",
        dateFrom,
        dateTo,
        query,
      })
        .then((result) => {
          if (!active) return;
          setRows(result.rows);
          setTotal(result.total);
        })
        .catch(() => {
          if (!active) return;
          setRows([]);
          setTotal(0);
          toast.error("Não foi possível carregar as ocorrências do Hádron.");
        })
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    dateFrom,
    dateTo,
    dateType,
    kind,
    operator,
    optionIds,
    page,
    pageSize,
    query,
    reloadKey,
    userType,
  ]);

  const clearFilters = () => {
    setOptionQuery("");
    setFormQuery("");
    setKind("todos");
    setOperator("todos");
    setUserType("todos");
    setDateType("ocorrencia");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="border-b px-4 py-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-medium">Ocorrências</h2>
          <span className="text-xs text-muted-foreground">
            {total.toLocaleString("pt-BR")} registros
          </span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[.8fr_.7fr_.85fr_.85fr_.85fr_.8fr_1.35fr_auto]">
          <Input
            value={optionQuery}
            onChange={(event) => {
              setOptionQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Opção"
          />
          <Input
            value={formQuery}
            onChange={(event) => {
              setFormQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Formulário"
          />
          <OccurrenceSelect
            value={kind}
            onValueChange={(value) => {
              setKind(value);
              setPage(1);
            }}
            items={[
              ["todos", "Todos os tipos"],
              ["ocorrencia", "Ocorrência"],
              ["aprovacao", "Aprovação"],
              ["sugestao", "Sugestão"],
              ["solucao", "Solução"],
              ["revisada", "Revisada"],
              ["aviso", "Aviso"],
            ]}
          />
          <OccurrenceSelect
            value={userType}
            onValueChange={(value) => {
              setUserType(value);
              setPage(1);
            }}
            items={[
              ["todos", "Tipo de usuário"],
              ["responsavel", "Responsável"],
              ["ocorrencia", "Ocorrência"],
              ["solucao", "Solução"],
            ]}
          />
          <OccurrenceSelect
            value={operator}
            onValueChange={(value) => {
              setOperator(value);
              setPage(1);
            }}
            items={[
              ["todos", "Todos os operadores"],
              ...operators.map((item) => [item, item] as [string, string]),
            ]}
          />
          <OccurrenceSelect
            value={dateType}
            onValueChange={(value) => {
              setDateType(value);
              setPage(1);
            }}
            items={[
              ["ocorrencia", "Data da ocorrência"],
              ["solucao", "Data da solução"],
              ["revisao", "Data da revisão"],
            ]}
          />
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onChange={(start, end) => {
              setDateFrom(start);
              setDateTo(end);
              setPage(1);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 cursor-pointer"
          >
            Limpar
          </Button>
        </div>
      </div>
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-left text-[11px] xl:text-xs">
          <thead className="border-b bg-muted/20 text-primary">
            <tr>
              <th className="w-[4%] px-2 py-3 text-center font-medium">Tipo</th>
              <th className="w-[8%] px-2 py-3 font-medium">Opção/Form.</th>
              <th className="w-[14%] px-2 py-3 font-medium">Descrição</th>
              <th className="px-3 py-3 font-medium">Detalhes</th>
              <th className="w-[7%] px-2 py-3 font-medium">Responsável</th>
              <th className="w-[10%] px-2 py-3 font-medium">Ocorrência / Operador</th>
              <th className="w-[10%] px-2 py-3 font-medium">Solução / Operador</th>
              <th className="w-[8%] px-2 py-3 font-medium">Revisão</th>
              <th className="w-[13%] px-2 py-3 text-center font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((occurrence) => {
              const option = hadronOptionsById.get(occurrence.optionLegacyId);
              return (
                <tr key={occurrence.id} className="align-top hover:bg-muted/25">
                  <td className="px-3 py-3 text-center">
                    <ImportedOccurrenceTypeIcon occurrence={occurrence} />
                  </td>
                  <td className="break-words px-2 py-3 font-medium">
                    {option
                      ? `${option.option}/${option.form || option.option}`
                      : occurrence.optionLegacyId}
                  </td>
                  <td className="px-2 py-3 font-medium text-primary">
                    <p className="line-clamp-2 break-words">
                      {option?.description || "Descrição não informada"}
                    </p>
                  </td>
                  <td className="max-w-lg px-3 py-3">
                    <p className="line-clamp-3 leading-5">
                      {occurrence.occurrenceText || "Sem descrição"}
                    </p>
                  </td>
                  <td className="px-3 py-3">{option?.owner || "-"}</td>
                  <td className="px-3 py-3">
                    <OccurrenceDate value={occurrence.occurredAt} operator={occurrence.reporter} />
                  </td>
                  <td className="px-3 py-3">
                    <OccurrenceDate value={occurrence.solvedAt} operator={occurrence.solver} />
                  </td>
                  <td className="px-3 py-3 text-emerald-600">
                    {occurrence.reviewedAt ? formatOccurrenceDate(occurrence.reviewedAt) : "-"}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-nowrap items-center justify-center gap-0.5 whitespace-nowrap">
                      {occurrence.solvedAt && !occurrence.reviewedAt && (
                        <Button
                          size="sm"
                          className="h-8 shrink-0 cursor-pointer px-2 text-[10px]"
                          onClick={() => openImportedOccurrence(occurrence, option, onOpen)}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Revisar
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 cursor-pointer"
                        title="Ver ocorrência"
                        onClick={() => openImportedOccurrence(occurrence, option, onOpen)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 cursor-pointer text-destructive hover:text-destructive"
                        title="Remover ocorrência"
                        onClick={() => setRemovingOccurrence(occurrence)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Carregando ocorrências...
          </p>
        )}
        {!loading && !rows.length && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma ocorrência encontrada.
          </p>
        )}
      </div>
      {!loading && total > 0 && (
        <TablePagination
          noun="ocorrências"
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      )}
      <AlertDialog
        open={Boolean(removingOccurrence)}
        onOpenChange={(open) => !open && !removing && setRemovingOccurrence(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ocorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá definitivamente a ocorrência selecionada do Hádron.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (event) => {
                event.preventDefault();
                if (!removingOccurrence) return;
                setRemoving(true);
                try {
                  await deleteHadronOccurrence(removingOccurrence.id);
                  setRemovingOccurrence(null);
                  setReloadKey((current) => current + 1);
                  toast.success("Ocorrência removida com sucesso.");
                } catch {
                  toast.error("Não foi possível remover a ocorrência.");
                } finally {
                  setRemoving(false);
                }
              }}
            >
              {removing ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function OccurrencesTable({ query, onOpen }: TableProps) {
  const tickets = useTickets();
  const { session } = usePortalAuth();
  const [reviews, setReviews] = useState<
    Record<string, { reviewed_at: string; reviewer_operator: string }>
  >({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const ticketsWithOptions = useMemo(
    () => tickets.map((ticket) => ({ ticket, option: findTicketOption(ticket) })),
    [tickets],
  );
  const [optionQuery, setOptionQuery] = useState("");
  const [formQuery, setFormQuery] = useState("");
  const [occurrenceType, setOccurrenceType] = useState("todos");
  const [userType, setUserType] = useState("todos");
  const [operator, setOperator] = useState("todos");
  const [dateType, setDateType] = useState("abertura");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const operators = useMemo(
    () => [...new Set(tickets.map((ticket) => ticket.owner).filter(Boolean))].sort(),
    [tickets],
  );
  useEffect(() => {
    if (!session?.user.id) return;
    void supabase
      .from("hadron_occurrence_reviews")
      .select("occurrence_id, reviewed_at, reviewer_operator")
      .eq("reviewer_id", session.user.id)
      .then(({ data, error }) => {
        if (error) return;
        setReviews(
          Object.fromEntries((data || []).map((review) => [review.occurrence_id, review])),
        );
      });
  }, [session?.user.id]);
  const reviewOccurrence = async (ticket: TicketRow) => {
    if (!session?.user.id) return;
    setReviewingId(ticket.id);
    const reviewedAt = new Date().toISOString();
    const reviewerOperator = currentUser.operator || currentUser.name;
    const { error } = await supabase.from("hadron_occurrence_reviews").upsert(
      {
        occurrence_id: ticket.id,
        reviewer_id: session.user.id,
        reviewer_operator: reviewerOperator,
        reviewed_at: reviewedAt,
      },
      { onConflict: "occurrence_id,reviewer_id" },
    );
    setReviewingId(null);
    if (error) {
      toast.error("Não foi possível registrar a revisão.");
      return;
    }
    setReviews((current) => ({
      ...current,
      [ticket.id]: { reviewed_at: reviewedAt, reviewer_operator: reviewerOperator },
    }));
    toast.success("Ocorrência marcada como revisada.");
  };
  const rows = useMemo(() => {
    const global = normalizeOccurrenceText(query);
    const optionFilter = normalizeOccurrenceText(optionQuery);
    const formFilter = normalizeOccurrenceText(formQuery);
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return ticketsWithOptions
      .filter(({ ticket, option }) => {
        const date = new Date(
          dateType === "solucao" ? ticket.closedAt || ticket.updatedAt : ticket.openedAt,
        ).getTime();
        const searchable = normalizeOccurrenceText(
          [
            ticket.protocol,
            ticket.subject,
            ticket.description,
            ticket.module,
            ticket.owner,
            option?.label,
          ]
            .filter(Boolean)
            .join(" "),
        );
        return (
          (!global || searchable.includes(global)) &&
          (!optionFilter || searchable.includes(optionFilter)) &&
          (!formFilter || normalizeOccurrenceText(option?.form).includes(formFilter)) &&
          (occurrenceType === "todos" || occurrenceKind(ticket) === occurrenceType) &&
          (userType === "todos" ||
            (userType === "cliente"
              ? ticket.source === "Portal do cliente"
              : ticket.source !== "Portal do cliente")) &&
          (operator === "todos" || ticket.owner === operator) &&
          (from === null || date >= from) &&
          (to === null || date <= to)
        );
      })
      .sort((a, b) => b.ticket.updatedAt.localeCompare(a.ticket.updatedAt));
  }, [
    dateFrom,
    dateTo,
    dateType,
    formQuery,
    occurrenceType,
    operator,
    optionQuery,
    query,
    ticketsWithOptions,
    userType,
  ]);
  const clearFilters = () => {
    setOptionQuery("");
    setFormQuery("");
    setOccurrenceType("todos");
    setUserType("todos");
    setOperator("todos");
    setDateType("abertura");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="border-b px-4 py-4">
        <h2 className="text-lg font-medium">Ocorrências</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_.7fr_.75fr_.75fr_.8fr_.8fr_.75fr_.75fr_auto]">
          <Input
            value={optionQuery}
            onChange={(event) => setOptionQuery(event.target.value)}
            placeholder="Opção/descrição"
          />
          <Input
            value={formQuery}
            onChange={(event) => setFormQuery(event.target.value)}
            placeholder="Formulário"
          />
          <OccurrenceSelect
            value={occurrenceType}
            onValueChange={setOccurrenceType}
            items={[
              ["todos", "Tipo Oco."],
              ["problema", "Problema"],
              ["solicitacao", "Solicitação"],
              ["revisado", "Revisado"],
            ]}
          />
          <OccurrenceSelect
            value={userType}
            onValueChange={setUserType}
            items={[
              ["todos", "Tipo Usu."],
              ["cliente", "Cliente"],
              ["interno", "Interno"],
            ]}
          />
          <OccurrenceSelect
            value={operator}
            onValueChange={setOperator}
            items={[
              ["todos", "Operador"],
              ...operators.map((item) => [item, item] as [string, string]),
            ]}
          />
          <OccurrenceSelect
            value={dateType}
            onValueChange={setDateType}
            items={[
              ["abertura", "Ocorrência"],
              ["solucao", "Solução"],
            ]}
          />
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onChange={(start, end) => {
              setDateFrom(start);
              setDateTo(end);
            }}
          />
          <Button type="button" className="cursor-pointer px-6">
            Buscar
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="mt-3 cursor-pointer"
        >
          Limpar
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] text-left text-xs">
          <thead className="border-b bg-muted/20 text-primary">
            <tr>
              <th className="w-14 px-3 py-3 font-medium">Tipo</th>
              <th className="w-28 px-3 py-3 font-medium">Opção/Formulário</th>
              <th className="w-72 px-3 py-3 font-medium">Descrição</th>
              <th className="px-3 py-3 font-medium">Detalhes</th>
              <th className="w-24 px-3 py-3 font-medium">Responsável</th>
              <th className="w-28 px-3 py-3 font-medium">Ocorrência</th>
              <th className="w-28 px-3 py-3 font-medium">Solução</th>
              <th className="w-24 px-3 py-3 font-medium">Revisado</th>
              <th className="w-20 px-3 py-3 text-center font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pagedRows.map(({ ticket, option }) => {
              const solved = ["Finalizado", "Cancelado"].includes(ticket.status);
              const review = reviews[ticket.id];
              const isAssignedToCurrentUser =
                normalizeOccurrenceText(ticket.owner) ===
                normalizeOccurrenceText(currentUser.operator);
              return (
                <tr key={ticket.id} className="align-top hover:bg-muted/25">
                  <td className="px-3 py-3">
                    <OccurrenceTypeIcon ticket={ticket} />
                  </td>
                  <td className="px-3 py-3 font-medium">
                    {option ? `${option.option}/${option.form || option.option}` : "-"}
                  </td>
                  <td className="px-3 py-3 font-medium">{option?.description || ticket.module}</td>
                  <td className="max-w-md px-3 py-3 leading-5 text-muted-foreground">
                    {ticket.description || ticket.subject}
                  </td>
                  <td className="px-3 py-3">{ticket.owner || "-"}</td>
                  <td className="px-3 py-3">
                    <OccurrenceDate value={ticket.openedAt} operator={ticket.owner} />
                  </td>
                  <td className="px-3 py-3">
                    <OccurrenceDate
                      value={ticket.closedAt || ticket.updatedAt}
                      operator={solved ? ticket.owner : ""}
                    />
                  </td>
                  <td className="px-3 py-3">
                    {review ? (
                      <span className="text-emerald-600">
                        {formatOccurrenceDate(review.reviewed_at)}
                        <br />
                        {review.reviewer_operator}
                      </span>
                    ) : isAssignedToCurrentUser ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-10 cursor-pointer"
                        disabled={reviewingId === ticket.id}
                        onClick={() => void reviewOccurrence(ticket)}
                      >
                        {reviewingId === ticket.id ? "Salvando..." : "Revisar"}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Ver ocorrência"
                      className="cursor-pointer"
                      onClick={() => openOccurrence(ticket, option, onOpen)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma ocorrência encontrada com os filtros aplicados.
          </p>
        )}
      </div>
      {!!rows.length && (
        <TablePagination
          noun="ocorrências"
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      )}
    </section>
  );
}

function TablePagination({
  noun,
  page,
  pageCount,
  pageSize = 25,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  noun: string;
  page: number;
  pageCount: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  return (
    <div className="relative z-10 -mx-px -mb-px mt-4 border-t-[14px] border-background bg-background">
      <ListPaginationFooter
        page={page - 1}
        pageCount={pageCount}
        pageSize={pageSize}
        total={total}
        noun={noun}
        onPageChange={(nextPage) => onPageChange(nextPage + 1)}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

function OccurrenceSelect({
  value,
  onValueChange,
  items,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full cursor-pointer">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(([itemValue, label]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function normalizeOccurrenceText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

type TicketRow = ReturnType<typeof useTickets>[number];

function normalizeOptionPriority(value: string | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (["alta", "2"].includes(normalized)) {
    return {
      label: "Alta",
      icon: ArrowUp,
      className: "border-destructive/20 bg-destructive/12 text-destructive",
    };
  }
  if (["media", "média", "1"].includes(normalized)) {
    return {
      label: "Média",
      icon: Minus,
      className:
        "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
    };
  }
  return {
    label: "Baixa",
    icon: CheckCircle2,
    className:
      "border-[#bfdcff] bg-[#eaf4ff] text-[#246cb5] dark:border-[#24527d] dark:bg-[#17314e] dark:text-[#9dcaff]",
  };
}
const hadronOptionByTerm = new Map<string, (typeof hadronOptions)[number]>();
hadronOptions.forEach((option) => {
  normalizeOccurrenceText(option.label)
    .split(/\s+/)
    .filter((term) => term.length > 3)
    .forEach((term) => {
      if (!hadronOptionByTerm.has(term)) hadronOptionByTerm.set(term, option);
    });
});
function findTicketOption(ticket: TicketRow) {
  const terms = normalizeOccurrenceText(`${ticket.subject} ${ticket.module}`)
    .split(/\s+/)
    .filter((term) => term.length > 3);
  return terms.map((term) => hadronOptionByTerm.get(term)).find(Boolean);
}
function occurrenceKind(ticket: TicketRow) {
  if (["Finalizado", "Cancelado"].includes(ticket.status)) return "revisado";
  return ticket.priority === "Alta" ? "problema" : "solicitacao";
}
function OccurrenceTypeIcon({ ticket }: { ticket: TicketRow }) {
  const kind = occurrenceKind(ticket);
  const Icon = kind === "revisado" ? CheckCircle2 : kind === "problema" ? Bug : Wrench;
  return (
    <span
      className={cn(
        "grid h-6 w-6 place-items-center rounded-full",
        kind === "revisado"
          ? "bg-emerald-500/10 text-emerald-600"
          : kind === "problema"
            ? "bg-rose-500/10 text-rose-600"
            : "bg-amber-500/10 text-amber-600",
      )}
      title={kind === "revisado" ? "Revisada" : kind === "problema" ? "Problema" : "Solicitação"}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
function ImportedOccurrenceTypeIcon({ occurrence }: { occurrence: HadronOccurrence }) {
  const reviewed = Boolean(occurrence.reviewedAt) || occurrence.kind === "revisada";
  const solved = Boolean(occurrence.solvedAt) || occurrence.kind === "solucao";
  const Icon = reviewed ? CheckCircle2 : solved ? Wrench : Bug;
  const label = reviewed ? "Revisada" : solved ? "Solução" : occurrence.kind || "Ocorrência";
  return (
    <span
      title={label}
      className={cn(
        "mx-auto grid h-7 w-7 place-items-center rounded-full",
        reviewed
          ? "bg-emerald-500/10 text-emerald-600"
          : solved
            ? "bg-amber-500/10 text-amber-600"
            : "bg-rose-500/10 text-rose-600",
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
function formatOccurrenceDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function OccurrenceDate({
  value,
  operator,
}: {
  value: string | null | undefined;
  operator: string;
}) {
  return (
    <span>
      {formatOccurrenceDate(value)}
      {operator && (
        <>
          <br />
          <span className="text-[10px] text-muted-foreground">{operator}</span>
        </>
      )}
    </span>
  );
}
function openOccurrence(
  ticket: TicketRow,
  option: ReturnType<typeof findTicketOption>,
  onOpen: (detail: Detail) => void,
) {
  const events = ticketsStore.getEvents(ticket.id);
  const solutionEvent = [...events]
    .reverse()
    .find((event) => ["solution", "closed"].includes(event.kind));
  onOpen({
    title: "Ocorrência",
    subtitle: `Opção: ${option ? `${option.option}/${option.form || option.option}` : ticket.protocol}`,
    body: ticket.description || "Sem detalhes informados para esta ocorrência.",
    meta: [],
    hadronOccurrence: {
      option: option?.option || ticket.protocol,
      form: option?.form || option?.option || "-",
      kind: occurrenceKind(ticket),
      reporter: ticket.owner || "Não informado",
      openedAt: ticket.openedAt,
      solver: solutionEvent?.actor || (ticket.closedAt ? ticket.owner : "Não informado"),
      solvedAt: solutionEvent?.when || ticket.closedAt,
      description: ticket.description || ticket.subject || "Sem detalhes informados.",
      solution:
        solutionEvent?.description ||
        (ticket.closedAt
          ? "Ocorrência concluída sem descrição de solução."
          : "Solução ainda não registrada."),
      status: ticket.status,
      events,
    },
  });
}

function HadronOccurrenceDetailView({ occurrence }: { occurrence: HadronOccurrenceDetail }) {
  const reviewed = occurrence.kind === "revisado";
  return (
    <div className="relative pl-12">
      <span className="absolute bottom-2 left-5 top-2 w-px bg-border" />
      <span
        className={cn(
          "absolute left-0 top-1 grid h-10 w-10 place-items-center rounded-full border-4 border-card",
          reviewed
            ? "bg-emerald-500 text-white"
            : occurrence.kind === "problema"
              ? "bg-rose-500 text-white"
              : "bg-amber-500 text-white",
        )}
      >
        {reviewed ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : occurrence.kind === "problema" ? (
          <Bug className="h-5 w-5" />
        ) : (
          <Wrench className="h-5 w-5" />
        )}
      </span>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-3 text-xs">
          <span className="font-medium text-foreground">{occurrence.reporter}</span>
          <span className="text-muted-foreground">{formatOccurrenceDate(occurrence.openedAt)}</span>
          {occurrence.solvedAt && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-emerald-600">{occurrence.solver}</span>
              <span className="text-muted-foreground">
                {formatOccurrenceDate(occurrence.solvedAt)}
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </>
          )}
        </div>
        <LegacyRichContent value={occurrence.description} />
        <p className="text-xs text-muted-foreground">
          {occurrence.option}/{occurrence.form}
        </p>
        <div
          className={cn(
            "rounded-md border p-4",
            reviewed ? "border-emerald-500/25 bg-emerald-500/5" : "bg-muted/30",
          )}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CheckCircle2
              className={cn("h-4 w-4", reviewed ? "text-emerald-600" : "text-muted-foreground")}
            />
            <span>{occurrence.solver}</span>
            {occurrence.solvedAt && <span>{formatOccurrenceDate(occurrence.solvedAt)}</span>}
          </div>
          <div className="mt-3">
            <LegacyRichContent value={occurrence.solution} />
          </div>
        </div>
        {occurrence.events && occurrence.events.length > 2 && (
          <div className="border-t pt-4">
            <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">
              Histórico da ocorrência
            </p>
            <TicketTimelineList
              events={occurrence.events}
              variant="compact"
              emptyLabel="Nenhum histórico adicional."
            />
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>
            Situação: <strong className="font-medium text-foreground">{occurrence.status}</strong>
          </span>
          <span>Registrada em {formatOccurrenceDate(occurrence.openedAt)}</span>
          {occurrence.solvedAt && (
            <span>Solucionada em {formatOccurrenceDate(occurrence.solvedAt)}</span>
          )}
          {occurrence.reviewedAt && (
            <span>Revisada em {formatOccurrenceDate(occurrence.reviewedAt)}</span>
          )}
          {occurrence.version && <span>Versão: {occurrence.version}</span>}
          {occurrence.baseAddress && <span>Base: {occurrence.baseAddress}</span>}
        </div>
      </div>
    </div>
  );
}

function createReleaseDetail(
  release: (typeof cvsArticles)[number],
  option: ReturnType<typeof findReleaseOption>,
): ReleaseDetail {
  return {
    id: release.id,
    title: release.title,
    content: release.description,
    option: option?.option || release.id,
    form: option?.form || option?.option || release.id,
    owner: release.owner || option?.owner || "Não informado",
    version: release.status || "Não informada",
    date: release.updatedAt || release.createdAt,
    module: option?.moduleId
      ? `Módulo ${option.moduleId}`
      : release.moduleId
        ? `Módulo ${release.moduleId}`
        : "Não informado",
    submodule: option?.submoduleId
      ? `Submódulo ${option.submoduleId}`
      : release.submoduleId
        ? `Submódulo ${release.submoduleId}`
        : "Não informado",
    clicks: release.clicks,
  };
}

function ReleaseDetailView({ release }: { release: ReleaseDetail }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:border-r lg:pr-5">
        <ReleaseMeta label="Opção/Formulário" value={`${release.option}/${release.form}`} />
        <ReleaseMeta label="Data do release" value={formatCatalogDate(release.date)} />
        <ReleaseMeta label="Versão Hádron" value={release.version} />
        <ReleaseMeta
          label="Módulo e submódulo"
          value={`${release.module} · ${release.submodule}`}
        />
        <ReleaseMeta label="Responsável" value={release.owner} />
        <ReleaseMeta label="Cliques" value={String(release.clicks)} />
      </aside>
      <section className="min-w-0">
        <h3 className="mb-4 text-base font-medium text-foreground">Detalhes</h3>
        <LegacyRichContent
          value={
            release.content || "Este release não possui descrição detalhada no JSON importado."
          }
        />
      </section>
    </div>
  );
}

function ReleaseMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b pb-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value || "Não informado"}</p>
    </div>
  );
}

function LegacyRichContent({ value }: { value: string }) {
  const images = [...value.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => normalizeLegacyUrl(match[1]))
    .filter(Boolean);
  const links = [...value.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis)]
    .map((match) => ({ href: normalizeLegacyUrl(match[1]), label: htmlToText(match[2]) }))
    .filter((link) => link.href);
  const paragraphs = value
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<a[^>]*>(.*?)<\/a>/gis, "$1")
    .split(/<\/?(?:p|div|h[1-6]|li|ul|ol|br)[^>]*>/gi)
    .map(htmlToText)
    .filter(Boolean);

  return (
    <div className="space-y-3 text-sm leading-6 text-foreground">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
      ))}
      {images.map((src) => (
        <img
          key={src}
          src={src}
          alt="Imagem vinculada ao registro"
          loading="lazy"
          className="max-h-[520px] w-auto max-w-full rounded-md border bg-white object-contain"
        />
      ))}
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="block break-all text-primary hover:underline"
        >
          {link.label || link.href}
        </a>
      ))}
    </div>
  );
}

function normalizeLegacyUrl(value: string) {
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `https://crm.procion.com${url}`;
  return "";
}

function htmlToText(value: string) {
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

function formatCatalogDate(value: string) {
  if (!value) return "Não informada";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function normalizeLegacyOccurrenceTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : value;
}

function ParametersTable({ query, onOpen }: TableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [option, setOption] = useState("");
  const [form, setForm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const normalizedSearch = normalizeOccurrenceText(`${query} ${search}`);
  const rows = useMemo(
    () =>
      hadronParameters.filter((parameter) => {
        if (
          normalizedSearch &&
          !normalizeOccurrenceText(
            `${parameter.id} ${parameter.title} ${parameter.description}`,
          ).includes(normalizedSearch)
        )
          return false;
        if (
          option &&
          !normalizeOccurrenceText(parameter.option).includes(normalizeOccurrenceText(option))
        )
          return false;
        if (
          form &&
          !normalizeOccurrenceText(parameter.form).includes(normalizeOccurrenceText(form))
        )
          return false;
        const updatedAt = parameterDateValue(parameter.updatedAt);
        if (dateFrom && updatedAt < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
        if (dateTo && updatedAt > new Date(`${dateTo}T23:59:59`).getTime()) return false;
        return true;
      }),
    [dateFrom, dateTo, form, normalizedSearch, option],
  );

  const clearFilters = () => {
    setSearch("");
    setOption("");
    setForm("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="border-b p-4">
        <h2 className="text-lg font-medium">Parâmetros</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_.6fr_.6fr_.9fr_.9fr_auto]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisa"
          />
          <Input
            value={option}
            onChange={(event) => setOption(event.target.value)}
            placeholder="Opção"
          />
          <Input
            value={form}
            onChange={(event) => setForm(event.target.value)}
            placeholder="Formulário"
          />
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onChange={(start, end) => {
              setDateFrom(start);
              setDateTo(end);
            }}
          />
          <Button type="button" className="cursor-pointer px-8">
            Buscar
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearFilters}
          disabled={!search && !option && !form && !dateFrom && !dateTo}
          className="mt-3 cursor-pointer"
        >
          Limpar
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b bg-muted/25 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-16 px-4 py-3">ID</th>
              <th className="px-4 py-3">Título</th>
              <th className="w-[34%] px-4 py-3">Descrição</th>
              <th className="w-44 px-4 py-3">Datas</th>
              <th className="w-28 px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.slice((page - 1) * pageSize, page * pageSize).map((parameter, index) => (
              <tr
                key={parameter.id}
                className={cn(
                  "transition-colors hover:bg-muted/35",
                  index % 2 === 0 && "bg-muted/15",
                )}
              >
                <td className="px-4 py-3 text-muted-foreground">{parameter.id}</td>
                <td className="px-4 py-3">{parameter.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{parameter.description}</td>
                <td className="px-4 py-3 text-xs text-primary">
                  <span>{parameter.createdAt}</span>
                  <br />
                  <span>{parameter.updatedAt}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Ver parâmetro"
                      className="cursor-pointer"
                      onClick={() =>
                        onOpen({
                          title: parameter.title,
                          subtitle: `Parâmetro ${parameter.id}`,
                          body: parameter.description,
                          meta: [
                            `Opção: ${parameter.option}`,
                            `Formulário: ${parameter.form}`,
                            `Criado em: ${parameter.createdAt}`,
                            `Atualizado em: ${parameter.updatedAt}`,
                          ],
                        })
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edição indisponível para registros legados"
                      disabled
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Exclusão indisponível para registros legados"
                      disabled
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum parâmetro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        noun="parâmetros"
        page={page}
        pageCount={Math.max(1, Math.ceil(rows.length / pageSize))}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </section>
  );
}

function parameterDateValue(value: string) {
  const [date, time] = value.split(" ");
  const [day, month, year] = date.split("/").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function ModulesTable({ query, onOpen }: TableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const normalizedQuery = normalizeOccurrenceText(`${query} ${search}`);
  const rows = useMemo(
    () =>
      Object.entries(modulesMap)
        .map(([module, submodules], moduleIndex) => ({
          id: String(moduleIndex + 1),
          module,
          submodules: submodules.map((submodule) => ({
            name: submodule,
            options: hadronOptions
              .filter((option) => {
                const optionText = normalizeOccurrenceText(option.description);
                const terms = normalizeOccurrenceText(submodule)
                  .split(/\s+/)
                  .filter((term) => term.length > 3);
                return terms.some((term) => optionText.includes(term));
              })
              .slice(0, 12),
          })),
        }))
        .filter(
          (row) =>
            !normalizedQuery ||
            normalizeOccurrenceText(
              [
                row.id,
                row.module,
                ...row.submodules.flatMap((submodule) => [
                  submodule.name,
                  ...submodule.options.map((option) => option.label),
                ]),
              ].join(" "),
            ).includes(normalizedQuery),
        ),
    [normalizedQuery],
  );

  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">Módulos e Submódulos</h2>
          <p className="text-sm text-muted-foreground">
            Estrutura do Hádron carregada do catálogo importado.
          </p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar módulo, submódulo ou opção"
          className="sm:w-80"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b bg-muted/25 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-20 px-4 py-3">ID</th>
              <th className="px-4 py-3">Nome</th>
              <th className="w-28 px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.slice((page - 1) * pageSize, page * pageSize).map((row) => (
              <tr key={row.id} className="align-top hover:bg-muted/20">
                <td className="px-4 py-4 text-muted-foreground">{row.id}</td>
                <td className="px-4 py-4">
                  <p className="font-medium uppercase">{row.module}</p>
                  <div className="mt-3 space-y-3 border-l pl-5">
                    {row.submodules.map((submodule) => (
                      <div key={submodule.name}>
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          {submodule.name}
                        </p>
                        {submodule.options.length > 0 && (
                          <div className="mt-1 divide-y rounded-md border">
                            {submodule.options.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  onOpen({
                                    title: option.description,
                                    subtitle: `${row.module} / ${submodule.name}`,
                                    body: "Opção pertencente ao catálogo oficial importado do Hádron.",
                                    meta: [
                                      `Opção: ${option.option}`,
                                      `Formulário: ${option.form || option.option}`,
                                    ],
                                  })
                                }
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/40"
                              >
                                <span className="font-mono text-muted-foreground">
                                  {option.option} | {option.form || option.option}
                                </span>
                                <span>{option.description}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Ver módulo"
                      className="cursor-pointer"
                      onClick={() =>
                        onOpen({
                          title: row.module,
                          subtitle: `${row.submodules.length} submódulos`,
                          body: row.submodules.map((item) => item.name).join(", "),
                          meta: [`ID: ${row.id}`, `Submódulos: ${row.submodules.length}`],
                        })
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edição indisponível para o catálogo importado"
                      disabled
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum módulo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        noun="módulos"
        page={page}
        pageCount={Math.max(1, Math.ceil(rows.length / pageSize))}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </section>
  );
}

function SerialsTable({ query }: TableProps) {
  const [serial, setSerial] = useState("");
  const [acronym, setAcronym] = useState("");
  const [operator, setOperator] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const hasFilter = Boolean(
    query || serial || acronym || operator !== "todos" || dateFrom || dateTo,
  );
  const clearFilters = () => {
    setSerial("");
    setAcronym("");
    setOperator("todos");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="border-b p-4">
        <h2 className="text-lg font-medium">Seriais</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_.6fr_.8fr_.8fr_.8fr_auto]">
          <Input
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
            placeholder="Número de série"
          />
          <Input
            value={acronym}
            onChange={(event) => setAcronym(event.target.value.toUpperCase())}
            placeholder="Sigla"
          />
          <OccurrenceSelect
            value={operator}
            onValueChange={setOperator}
            items={[
              ["todos", "Operador"],
              ...operatorStats.map(([item]) => [item, item] as [string, string]),
            ]}
          />
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onChange={(start, end) => {
              setDateFrom(start);
              setDateTo(end);
            }}
          />
          <Button type="button" className="cursor-pointer px-8">
            Buscar
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearFilters}
          disabled={!hasFilter}
          className="mt-3 cursor-pointer"
        >
          Limpar
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b bg-muted/25 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-20 px-4 py-3">ID</th>
              <th className="px-4 py-3">Número de série</th>
              <th className="w-64 px-4 py-3">Operador</th>
              <th className="w-40 px-4 py-3">Cliente</th>
              <th className="w-44 px-4 py-3">Datas</th>
              <th className="w-24 px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-16 text-center">
                <KeyRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum serial importado.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O projeto ainda não possui um JSON de seriais para preencher esta tabela.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination
        noun="seriais"
        page={1}
        pageCount={1}
        pageSize={25}
        total={0}
        onPageChange={() => undefined}
      />
    </section>
  );
}

function ChecklistTable({ query, onOpen }: TableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filter, setFilter] = useState("");
  const normalizedQuery = normalizeOccurrenceText(`${query} ${filter}`);
  const rows = useMemo(
    () =>
      hadronChecklist.filter(
        (item) =>
          !normalizedQuery || normalizeOccurrenceText(item.join(" ")).includes(normalizedQuery),
      ),
    [normalizedQuery],
  );

  return (
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Checklist</h2>
          <p className="text-sm text-muted-foreground">
            Itens de validação utilizados nas opções e formulários do Hádron.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Buscar característica, título ou descrição"
            className="sm:w-80"
          />
          <Button
            variant="outline"
            onClick={() => setFilter("")}
            disabled={!filter}
            className="cursor-pointer"
          >
            Limpar
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-36 px-4 py-3">Característica</th>
              <th className="w-64 px-4 py-3">Título</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="w-20 px-4 py-3 text-center">Salvo</th>
              <th className="w-44 px-4 py-3">Datas</th>
              <th className="w-24 px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice((page - 1) * pageSize, page * pageSize)
              .map(
                ([id, characteristic, title, description, saved, createdAt, updatedAt], index) => (
                  <tr
                    key={id}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/40",
                      index % 2 === 0 && "bg-muted/20",
                    )}
                  >
                    <td className="px-4 py-3">{characteristic}</td>
                    <td className="px-4 py-3 font-medium">{title}</td>
                    <td className="px-4 py-3">{description}</td>
                    <td className="px-4 py-3 text-center">
                      {saved ? (
                        <Flag className="mx-auto h-4 w-4 text-muted-foreground" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-primary">
                      <span>{createdAt}</span>
                      <br />
                      <span>{updatedAt}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver detalhes"
                          className="cursor-pointer"
                          onClick={() =>
                            onOpen({
                              title,
                              subtitle: characteristic,
                              body: description,
                              meta: [
                                `Criado em: ${createdAt}`,
                                `Atualizado em: ${updatedAt}`,
                                `Salvo: ${saved ? "Sim" : "Não"}`,
                              ],
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Exclusão indisponível para registros legados"
                          disabled
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum item de checklist encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        noun="itens"
        page={page}
        pageCount={Math.max(1, Math.ceil(rows.length / pageSize))}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </section>
  );
}

function ReleasesTable({ query, onOpen }: TableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const normalizedQuery = normalizeOccurrenceText(query);
  const rows = useMemo(
    () =>
      cvsArticles
        .map((release) => ({
          release,
          option: findReleaseOption(release.title),
        }))
        .filter(
          ({ release, option }) =>
            !normalizedQuery ||
            normalizeOccurrenceText(
              [
                release.id,
                release.title,
                release.status,
                option?.option,
                option?.form,
                option?.description,
              ]
                .filter(Boolean)
                .join(" "),
            ).includes(normalizedQuery),
        ),
    [normalizedQuery],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Releases</h2>
        <p className="text-sm text-muted-foreground">
          Histórico de publicações carregado do catálogo oficial importado.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="border-b bg-muted/35 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="w-14 px-4 py-3">Tipo</th>
              <th className="w-40 px-4 py-3">Opção/Formulário</th>
              <th className="min-w-[360px] px-4 py-3">Descrição</th>
              <th className="w-44 px-4 py-3">Módulo/Submódulo</th>
              <th className="w-32 px-4 py-3">Responsável</th>
              <th className="w-20 px-4 py-3 text-center">Cliques</th>
              <th className="w-24 px-4 py-3">Versão</th>
              <th className="w-32 px-4 py-3">Data</th>
              <th className="w-20 px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pagedRows.map(({ release, option }) => (
              <tr key={release.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Sparkles
                    className={cn(
                      "h-4 w-4",
                      release.status === "publish" ? "text-amber-500" : "text-muted-foreground",
                    )}
                  />
                </td>
                <td className="px-4 py-3 font-medium">
                  {option ? `${option.option}/${option.form || option.option}` : "Não informado"}
                </td>
                <td className="px-4 py-3">{release.title}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {release.moduleId ? `Módulo ${release.moduleId}` : "Não informado"}
                  {release.submoduleId && (
                    <>
                      <br />
                      <span className="text-xs">Submódulo {release.submoduleId}</span>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {release.owner || "Não informado"}
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{release.clicks}</td>
                <td className="px-4 py-3 text-muted-foreground">{release.status}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatCatalogDate(release.updatedAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      title="Abrir release na Base de Conhecimento"
                    >
                      <Link to="/base-de-conhecimento" search={{ release: release.id }}>
                        <Globe2 className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Visualizar release"
                      onClick={() =>
                        onOpen({
                          title: release.title,
                          subtitle: option
                            ? `${option.option}/${option.form || option.option}`
                            : `Release ${release.id}`,
                          body: "",
                          meta: [],
                          release: createReleaseDetail(release, option),
                        })
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum release encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        noun="releases"
        page={currentPage}
        pageCount={pageCount}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </div>
  );
}

function findReleaseOption(title: string) {
  const normalizedTitle = normalizeOccurrenceText(title);
  const leadingCode = normalizedTitle.match(/^([a-z0-9]+)(?:\s*[-/]|\s)/)?.[1];
  if (leadingCode) {
    const exact = hadronOptions.find(
      (option) =>
        normalizeOccurrenceText(option.option) === leadingCode ||
        normalizeOccurrenceText(option.form) === leadingCode,
    );
    if (exact) return exact;
  }
  return normalizedTitle
    .split(/\s+/)
    .filter((term) => term.length > 3)
    .map((term) => hadronOptionByTerm.get(term))
    .find(Boolean);
}

function VersionsTable({ query, onOpen }: TableProps) {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const rows = erpVersions.filter((version) =>
    Object.values(version).some((value) =>
      value.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
    ),
  );

  return (
    <DataCard
      title="Versões do ERP"
      subtitle="Histórico oficial das versões liberadas do Hadron."
      headers={["Versão", "Liberação", "Runtime", "Arquivos", "Base", "Alteração"]}
    >
      {rows.map((version) => (
        <DataRow
          key={version.id}
          onClick={() =>
            onOpen({
              title: `Versão ${version.versao}`,
              subtitle: `Liberada em ${formatVersionDate(version.data_versao)}`,
              body: "Registro técnico da versão liberada do ERP Hadron.",
              meta: [
                `Runtime: ${formatVersionDate(version.data_runtime)}`,
                `Arquivos: ${formatVersionDate(version.data_arq)}`,
                `Base: ${formatVersionDate(version.data_arq_bas)}`,
                `Alteração: ${formatVersionDate(version.data_alterar)}`,
              ],
            })
          }
          cells={[
            version.versao,
            formatVersionDate(version.data_versao),
            formatVersionDate(version.data_runtime),
            formatVersionDate(version.data_arq),
            formatVersionDate(version.data_arq_bas),
            formatVersionDate(version.data_alterar),
          ]}
        />
      ))}
    </DataCard>
  );
}

function ArticlesTable({ query, onOpen }: TableProps) {
  const statusById = useMemo(
    () => new Map(cvsArticles.map((article) => [article.id, article.status])),
    [],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const rows = useMemo(
    () =>
      kbArticlesFull.filter((article) =>
        [
          article.id,
          article.title,
          article.author,
          article.module,
          getCategory(article.category).name,
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedQuery),
      ),
    [normalizedQuery],
  );

  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">Artigos</h2>
          <p className="text-xs text-muted-foreground">{rows.length} artigos do catálogo Hádron.</p>
        </div>
        <Badge variant="secondary">Fonte: cvs_articles.json</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-xs">
          <thead className="border-b bg-muted/35 text-[11px] text-muted-foreground">
            <tr>
              {[
                "Permissão",
                "Título",
                "Categoria",
                "Responsável",
                "Módulo / Submódulo",
                "Status",
                "Cliques",
                "Datas",
                "Ações",
              ].map((header) => (
                <th key={header} className="whitespace-nowrap px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((article, index) => {
              const published = statusById.get(article.id) === "1";
              return (
                <tr
                  key={article.id}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/35",
                    index % 2 === 1 && "bg-muted/20",
                  )}
                >
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                  </td>
                  <td className="max-w-[420px] px-3 py-2.5 font-medium">
                    <span className="mr-1 text-muted-foreground">{article.id} -</span>
                    {article.title}
                  </td>
                  <td className="px-3 py-2.5">{getCategory(article.category).name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{article.author}</td>
                  <td className="px-3 py-2.5">
                    <span className="block">{article.module}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {article.tags.slice(0, 2).join(" / ") || "Não informado"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={published ? "default" : "secondary"}>
                      {published ? "Publicado" : "Em análise"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">-</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-primary">
                    {formatHadronArticleDate(article.updatedAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Visualizar artigo"
                        onClick={() =>
                          onOpen({
                            title: article.title,
                            subtitle: `${getCategory(article.category).name} - ${article.module}`,
                            body: article.summary,
                            meta: [
                              `Responsável: ${article.author}`,
                              `Atualizado: ${formatHadronArticleDate(article.updatedAt)}`,
                              `Status: ${published ? "Publicado" : "Em análise"}`,
                              `Artigo: ${article.id}`,
                            ],
                          })
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar artigo">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Artigos importados não podem ser excluídos"
                        disabled
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          Nenhum artigo encontrado.
        </div>
      )}
    </section>
  );
}

function formatHadronArticleDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

type TableProps = { query: string; onOpen: (d: Detail) => void };
function useFiltered<T>(rows: T[], query: string) {
  return useMemo(
    () => rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  );
}
function optionDetail(o: (typeof options)[number]): Detail {
  return {
    title: o.title,
    subtitle: `Opção ${o.id}`,
    body: o.description,
    meta: [
      `Status: ${o.status}`,
      `Prioridade: ${o.priority}`,
      `Responsável: ${o.owner}`,
      "Origem: CRM Hadron",
    ],
  };
}
function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Rocket;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
function StatusDot({ tone }: { tone: string }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full",
        tone === "Alta" ? "bg-rose-500" : tone === "Media" ? "bg-amber-500" : "bg-emerald-500",
      )}
    />
  );
}
function Priority({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <StatusDot tone={value} />
      {value}
    </span>
  );
}
function DataCard({
  title,
  subtitle,
  headers,
  children,
}: {
  title: string;
  subtitle: string;
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b p-5">
        <div>
          <h2 className="text-base font-medium">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="text-xs text-muted-foreground">Clique em uma linha para abrir</span>
      </div>
      <div className="app-scrollbar overflow-x-auto">
        <div className="min-w-[850px]">
          <div
            className="grid border-b bg-muted/30 px-4 py-2.5 text-[11px] uppercase text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}
          >
            {headers.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
          <div className="divide-y">{children}</div>
        </div>
      </div>
    </section>
  );
}
function DataRow({ cells, onClick }: { cells: React.ReactNode[]; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full cursor-pointer items-center px-4 py-3 text-left text-xs transition hover:bg-muted/35"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((c, i) => (
        <div key={i} className="min-w-0 pr-3">
          {c}
        </div>
      ))}
    </button>
  );
}
