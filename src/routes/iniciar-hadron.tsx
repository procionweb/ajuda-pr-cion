import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  Building2,
  Bug,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Code2,
  FileCode2,
  FilePenLine,
  Filter,
  Flag,
  GitBranch,
  Globe2,
  History,
  KeyRound,
  ListChecks,
  ClipboardList,
  ListTodo,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  Rocket,
  Search,
  ScanEye,
  SlidersHorizontal,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  Trash2,
  UserRound,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { AppShell } from "@/components/portal/AppShell";
import parametersSource from "@/data/cvs-parameters.json";
import { ListPaginationFooter } from "@/components/portal/ListPaginationFooter";
import { DateRangeFilter } from "@/components/portal/DateRangeFilter";
import { Breadcrumbs } from "@/components/portal/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
import { getHadronOptionChecklist, hadronChecklist } from "@/lib/hadron-checklist";
import {loadOptionChecklist,processOptionChecklist} from "@/lib/hadron-checklist-api";
import { hadronModuleNames, hadronReleases, hadronSubmoduleNames } from "@/lib/hadron-releases";
import {
  acquireHadronOptionLock,
  listHadronOptionLocks,
  releaseHadronOptionLock,
  type HadronOptionLock,
} from "@/lib/hadron-option-locks";
import { moduleOptions, modulesMap } from "@/lib/modules-map";
import { hadronModules, type HadronModule } from "@/lib/hadron-modules";
import { loadHadronModules, saveHadronModule, saveHadronSubmodule, removeHadronModule } from "@/lib/hadron-modules-api";
import { hadronSerials } from "@/lib/hadron-serials";
import { collaboratorLabel, findCollaborator, useCollaborators } from "@/lib/collaborators-store";
import { cvsArticles } from "@/lib/cvs-catalogs-imported";
import { getCategory, kbArticlesFull } from "@/lib/kb-data";
import { ticketsStore, useTickets, type TicketEvent } from "@/lib/tickets-store";
import { currentUser } from "@/lib/mock-data";
import { usePortalAuth } from "@/lib/portal-auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { loadCrmCatalog, useCrmCatalog, trySaveCrmCatalog } from "@/lib/crm-catalog-api";
import {
  formatLogDate,
  listHadronOptionLogs,
  recordHadronOptionLog,
  translateHadronLogTerm,
  type AuthLogRow,
} from "@/lib/auth-logs-api";
import {
  createHadronOccurrence,
  deleteHadronOccurrence,
  getHadronOccurrenceKindCounts,
  getHadronOpenOccurrenceStats,
  getHadronOverview,
  listHadronOccurrences,
  listHadronOccurrenceOperators,
  reviewHadronOccurrence,
  updateHadronOccurrence,
  updateHadronOccurrenceSolution,
  type HadronOccurrence,
} from "@/lib/hadron-occurrences";
            <div className="flex shrink-0 items-center gap-2">

            <Button type="button" className="h-10 w-40 min-w-40 shrink-0 cursor-pointer px-4" onClick={() => setPage(1)}><Search className="mr-2 h-4 w-4" />Buscar</Button>
            </div>
const hadronOptionsById = new Map(hadronOptions.map((option) => [option.id, option]));
type CatalogRelease = (typeof hadronReleases)[number];
type CatalogVersion = (typeof erpVersions)[number];
type CatalogArticle = (typeof cvsArticles)[number];
const releaseOptionSelectItems = [
  ...new Map(
    hadronOptions.map((option) => [
      option.option,
      [
        option.option,
        `${option.option}/${option.form || option.option} - ${option.description}`,
      ] as [string, string],
    ]),
  ).values(),
].sort((a, b) => a[1].localeCompare(b[1], "pt-BR", { numeric: true }));
const releaseModuleSelectItems = [...hadronModuleNames.entries()]
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .map(([id, name]) => [id, `${id} : ${name}`] as [string, string]);

const releaseSubmoduleSelectItems = (moduleId: string) => [
  ["none", "Selecione um submódulo"] as [string, string],
  ...[...hadronSubmoduleNames.entries()]
    .filter(([key]) => key.startsWith(`${moduleId}:`))
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
    .map(([key, name]) => [key.split(":")[1], name] as [string, string]),
];

export const Route = createFileRoute("/iniciar-hadron")({
  head: () => ({ meta: [{ title: "Hadron - CRM Procion" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
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
  tags: string;
};

type HadronOccurrenceDetail = {
  id?: number;
  priority?: string;
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
  approvedAt?: string | null;
  optionStatus?: string;
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
    status: "Correcao",
  },
  {
    id: "1116",
    title: "Cadastro de Operadores",
    description: "Permissões e configurações dos usuários.",
    owner: "PRCEDU",
    status: "Melhoria",
  },
  {
    id: "1243",
    title: "Complementos Gerais N.C.M.",
    description: "Manutencao dos complementos tributarios.",
    owner: "PRCWAG",
    status: "Correcao",
  },
  {
    id: "1398",
    title: "Emissão de Nota Fiscal Eletrônica",
    description: "Validacoes e retorno da SEFAZ.",
    owner: "PRCJUL",
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

type ParameterDraft = {
  id: string; option: string; form: string; title: string; description: string;
  message: string; legends: { title: string; caption: string }[];
  createdAt: string; updatedAt: string;
};
const decodeParameterText = (value: string) =>
  value.replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
const parameterDisplayDate = (value: string) => `${value.slice(0, 10).split("-").reverse().join("/")} ${value.slice(11, 16)}`;
const hadronParameters: ParameterDraft[] = (
  parametersSource.find((entry) => entry.type === "table")?.data || []
).map((row) => ({
  id: row.id, option: row.cvs_options_opcao || "", form: row.cvs_options_formulario || "",
  title: row.par_title, description: row.par_description, message: row.par_text,
  legends: Object.values(JSON.parse(row.par_options_data) as Record<string, { par_tlt: string; par_leg: string }>)
    .map((item) => ({ title: decodeParameterText(item.par_tlt), caption: decodeParameterText(item.par_leg) }))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR", { numeric: true })),
  createdAt: parameterDisplayDate(row.created), updatedAt: parameterDisplayDate(row.modified),
}));

function HadronPage() {
  useEffect(() => {
    document.body.classList.add("hadron-screen");
    return () => document.body.classList.remove("hadron-screen");
  }, []);
  const tickets = useTickets();
  const { department } = usePortalAuth();
  const search = Route.useSearch();
  const hasAdvancedHadronAccess = ["admin", "development", "tester"].includes(department || "");
  useEffect(() => {
    void Promise.all([
      loadCrmCatalog("releases"),
      loadCrmCatalog("options"),
      loadCrmCatalog("versions"),
    ]).catch(() => undefined);
  }, []);
  const [tab, setTab] = useState(search.tab || "visao-geral");
  const query = "";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reviewingOccurrence, setReviewingOccurrence] = useState(false);
  const [viewingOption, setViewingOption] = useState<HadronOption | null>(null);
  useEffect(() => {
    const saved = sessionStorage.getItem("hadron:return-option");
    if (!saved) return;
    setTab("opcoes");
  }, []);
  const [optionDetailOpen, setOptionDetailOpen] = useState(false);
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
      const reviewedAt = await reviewHadronOccurrence(occurrence.id);
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível revisar a ocorrência.",
      );
    } finally {
      setReviewingOccurrence(false);
    }
  };

  return (
    <AppShell>
      <div className="hadron-page space-y-5 [&_table_th]:align-middle [&_table_td]:align-middle">
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
            <TabsList className={cn("h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-card p-1", optionDetailOpen && "hidden")}>
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
              <OptionsTable query={query} onOpen={setDetail} onDetailChange={setOptionDetailOpen} />
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
        onSave={async (option) => {
          if (!await trySaveCrmCatalog("options", [option])) return;
          setViewingOption(option);
          setEditingOption(null);
        }}
      />

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          className={cn(
            detail?.release ? "max-w-5xl" : "max-w-2xl",
            "flex flex-col gap-0 overflow-hidden bg-card p-0 [&>button]:hidden",
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">{detail?.title}</DialogTitle>
          <DetailModalHeader
            icon={Info}
            title={detail?.title ?? ""}
            meta={detail?.subtitle}
            chips={
              detail?.hadronOccurrence?.optionStatus === "9" ? (
                <Badge className="bg-cyan-600 text-white hover:bg-cyan-600">APROVADA</Badge>
              ) : undefined
            }
            onClose={() => setDetail(null)}
          />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
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
              {detail?.hadronOccurrence?.id &&
                detail.hadronOccurrence.solvedAt &&
                !detail.hadronOccurrence.reviewedAt &&
                (department === "admin" ||
                  normalizeOccurrenceText(detail.hadronOccurrence.reporter) ===
                    normalizeOccurrenceText(currentUser.operator)) && (
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
  const { items: hadronOptions } = useCrmCatalog<HadronOption>("options");
  const { items: hadronReleases } = useCrmCatalog<CatalogRelease>("releases");
  const { items: versions } = useCrmCatalog<CatalogVersion>("versions");
  const erpVersions = useMemo(() => [...versions].sort((a,b) => b.data_versao.localeCompare(a.data_versao)), [versions]);
  const hadronOptionsById = useMemo(() => new Map(hadronOptions.map((item) => [item.id,item])), [hadronOptions]);
  const [dashboard,setDashboard] = useState<Awaited<ReturnType<typeof getHadronOverview>> | null>(null);
  const [previewOption,setPreviewOption] = useState<HadronOption | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => getHadronOverview().then((data) => { if (active) setDashboard(data); }).catch(() => { if (active) toast.error("Não foi possível carregar a visão geral do Hádron."); });
    void load();
    window.addEventListener("hadron-occurrence-reviewed",load);
    return () => { active=false; window.removeEventListener("hadron-occurrence-reviewed",load); };
  }, []);
  const latestVersion = erpVersions[0];
  const optionRows = (dashboard?.options || []).map((row) => ({option:hadronOptionsById.get(row.option_legacy_id),count:Number(row.count)}))
    .filter((row): row is {option:HadronOption;count:number} => Boolean(row.option && row.option.status !== "10"))
    .sort((a,b) => a.option.option.localeCompare(b.option.option,"pt-BR",{numeric:true}));
  const overviewOperatorStats = (dashboard?.operators || []).map((row) => [row.reporter,Number(row.count)] as const);
  const cards = [
    [
      "Ag. revisão / ocorrência",
      `${dashboard?.reviewTotal || 0} / ${dashboard?.total || 0}`,
      ClipboardCheck,
      "text-rose-600 bg-rose-500/10",
    ],
    [
      "Opção ocorrência / total",
      `${optionRows.length} / ${hadronOptions.length}`,
      ListChecks,
      "text-cyan-600 bg-cyan-500/10",
    ],
    ["Releases", String(hadronReleases.length), PackageCheck, "text-amber-600 bg-amber-500/10"],
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
          <div className="grid grid-cols-[118px_64px_minmax(190px,1fr)_92px_44px] border-b px-5 pb-2 text-[11px] text-muted-foreground">
            <span>Status</span>
            <span>Opção</span>
            <span>Descrição</span>
            <span>Responsável</span>
            <span className="text-center">Ações</span>
          </div>
          <div className="h-72 overflow-y-auto px-3">
            {optionRows.map(({option,count}) => {
              const openPreview = () => setPreviewOption(option);
              return (
                <div
                  key={option.id}
                  className="grid min-h-9 grid-cols-[118px_64px_minmax(190px,1fr)_92px_44px] items-center border-b bg-background px-2 text-xs transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-1">
                    <Badge className="h-5 rounded-sm bg-rose-500 px-1.5 text-[9px] text-white hover:bg-rose-500">
                      CORREÇÕES
                    </Badge>
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                      {count}
                    </span>
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
                    {option.owner || "-"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={openPreview}
                    className="h-8 w-8 cursor-pointer"
                    title="Prévia das ocorrências"
                  >
                    <ScanEye className="h-4 w-4 text-sky-600" />
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
            rows={dashboard?.review || []}
            onOpen={onOpen}
            empty="Nenhuma ocorrência aguardando revisão."
          />
        </HadronDashboardPanel>
        <HadronDashboardPanel title="Ocorrências" subtitle="Geral">
          <HadronOccurrenceRows
            rows={dashboard?.general || []}
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
          {[...hadronReleases]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 12)
            .map((release) => {
              const option =
                hadronOptionsById.get(release.optionId) || findReleaseOption(release.title);
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
                    <span className="text-muted-foreground">
                      {getReleaseVersionLabel(release.version)}
                    </span>
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
                      <Link
                        to="/base-de-conhecimento"
                        search={{ release: release.id, search: release.title, from: "hadron-release" }}
                      >
                        <Globe2 className="h-4 w-4 text-emerald-600" />
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
                      <ScanEye className="h-4 w-4" />
                    </Button>
                  </span>
                </div>
              );
            })}
        </HadronDashboardPanel>
      </div>
      <OverviewOccurrencePreview option={previewOption} onClose={() => setPreviewOption(null)} />
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

function HadronOccurrenceRows({rows,onOpen,empty,variant="review"}: {
  rows: HadronOccurrence[]; onOpen:(d:Detail) => void; empty:string; variant?:"review" | "general";
}) {
  if (!rows.length) return <p className="p-6 text-center text-xs text-muted-foreground">{empty}</p>;
  return <div className="overflow-x-auto">
    <div className="grid min-w-[640px] grid-cols-[28px_84px_minmax(120px,1fr)_minmax(160px,1.5fr)_100px_32px] gap-2 border-b bg-muted/25 px-3 py-2 text-[10px] uppercase text-muted-foreground"><span>Tipo</span><span>Opção/Form.</span><span>Descrição</span><span>Ocorrência</span><span>{variant === "review" ? "Solução" : "Operador"}</span><span /></div>
    {rows.map((occurrence) => {
      const option = hadronOptionsById.get(occurrence.optionLegacyId);
      return <button key={occurrence.id} type="button" onClick={() => openImportedOccurrence(occurrence,option,onOpen)} className="grid min-w-[640px] w-full grid-cols-[28px_84px_minmax(120px,1fr)_minmax(160px,1.5fr)_100px_32px] items-center gap-2 border-b px-3 py-2 text-left text-[11px] hover:bg-muted/40">
        <ImportedOccurrenceTypeIcon occurrence={occurrence} />
        <span className="font-medium">{option ? `${option.option}/${option.form || option.option}` : occurrence.optionLegacyId}</span>
        <span className="line-clamp-2 font-medium">{option?.description || "Descrição não informada"}</span>
        <span className="line-clamp-2 leading-4 text-muted-foreground">{occurrence.occurrenceText}</span>
        <OccurrenceDate value={variant === "review" ? occurrence.solvedAt : occurrence.occurredAt} operator={variant === "review" ? occurrence.solver : occurrence.reporter} />
        <span title="Visualizar ocorrência" className="grid h-8 w-8 cursor-pointer place-items-center rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-500/15"><ScanEye className="h-4 w-4 text-sky-600" /></span>
      </button>;
    })}
  </div>;
}

function OverviewOccurrencePreview({option,onClose}: {option:HadronOption | null;onClose:() => void}) {
  return <Dialog open={Boolean(option)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
      {option && <><DialogTitle className="sr-only">Ocorrências</DialogTitle><DetailModalHeader icon={ScanEye} title="Ocorrências" meta={`Opção: ${option.option}`} onClose={onClose} /><div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4"><OptionImportedOccurrences option={option} unresolved /></div></>}
    </DialogContent>
  </Dialog>;
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
  if (option.status === "8") return "testes";
  if (option.status === "9") return "aprovada";
  if (option.status === "4" || activeCount > 0) return "correcoes";
  return "desenvolvimento";
}

function getHadronOptionDate(
  option: HadronOption,
  latest: TicketRow | undefined,
  related: TicketRow[],
  dateType: string,
) {
  if (dateType === "criacao") return option.openedAt;
  if (dateType === "liberacao") return option.hadronAt;
  return option.approvedAt;
}

function OptionsTable({ query, onDetailChange }: TableProps & { onDetailChange: (open: boolean) => void }) {
  const tickets = useTickets();
  const { session } = usePortalAuth();
  const optionCatalog = useCrmCatalog<HadronOption>("options", true);
  const optionOverrides = useMemo(() => Object.fromEntries(optionCatalog.items.map((item) => [item.id, item])), [optionCatalog.items]);
  const customOptions = useMemo(() => optionCatalog.items.filter((item) => !hadronOptionsById.has(item.id)), [optionCatalog.items]);
  const disabledOptions = optionCatalog.deletedIds;
  const [viewingOption, setViewingOption] = useState<HadronOption | null>(null);
  const [previewingOption, setPreviewingOption] = useState<HadronOption | null>(null);
  useEffect(() => {
    const saved = sessionStorage.getItem("hadron:return-option");
    if (!saved) return;
    sessionStorage.removeItem("hadron:return-option");
    try {
      setViewingOption(JSON.parse(saved) as HadronOption);
    } catch {
      // Ignore invalid navigation state and keep the options list open.
    }
  }, []);
  useEffect(() => {
    onDetailChange(Boolean(viewingOption));
    return () => onDetailChange(false);
  }, [viewingOption, onDetailChange]);
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
  const [occurrenceSummary, setOccurrenceSummary] = useState<Record<string, number>>({});
  const [openOccurrenceStats, setOpenOccurrenceStats] = useState<Record<string, { count: number; firstOccurrence: string | null }>>({});
  const [optionSort, setOptionSort] = useState<"default" | "occupied" | "priority">("default");
  useEffect(() => {
    void getHadronOccurrenceKindCounts()
      .then(setOccurrenceSummary)
      .catch(() => setOccurrenceSummary({}));
  }, []);
  useEffect(() => {
    const load = () => void getHadronOpenOccurrenceStats().then(setOpenOccurrenceStats).catch(() => setOpenOccurrenceStats({}));
    load();
    window.addEventListener("hadron-occurrence-reviewed", load);
    return () => window.removeEventListener("hadron-occurrence-reviewed", load);
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
    return optionCatalog.items.map((sourceOption) => {
      const option = { ...sourceOption, ...optionOverrides[sourceOption.id] };
      const related = grouped.get(option.id) || [];
      const active = related.filter(
        (ticket) => !["Finalizado", "Cancelado"].includes(ticket.status),
      );
      const latest = related.reduce<TicketRow | undefined>(
        (current, ticket) => (!current || ticket.updatedAt > current.updatedAt ? ticket : current),
        undefined,
      );
      const openStat = openOccurrenceStats[option.id] || { count: 0, firstOccurrence: null };
      return { option, active, latest, related, openStat, disabled: disabledOptions.includes(option.id) };
    });
  }, [customOptions, disabledOptions, openOccurrenceStats, optionOverrides, tickets]);
  const operators = useMemo(
    () => [...new Set(optionsWithTickets.map(({option}) => option.owner.trim()).filter(Boolean))].sort(),
    [optionsWithTickets],
  );
  const rows = useMemo(() => {
    const global = normalizeOccurrenceText(query);
    const optionFilter = normalizeOccurrenceText(optionQuery);
    const formFilter = normalizeOccurrenceText(formQuery);
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    const filtered = optionsWithTickets.filter(({ option, latest, related, openStat, disabled }) => {
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
      const status = getHadronOptionStatus(option, openStat.count, disabled);
      return (
        (!global || searchable.includes(global)) &&
        (!optionFilter ||
          normalizeOccurrenceText(`${option.option} ${option.description}`).includes(
            optionFilter,
          )) &&
        (!formFilter || normalizeOccurrenceText(option.form).includes(formFilter)) &&
        (operator === "todos" || normalizeOccurrenceText(option.owner) === normalizeOccurrenceText(operator)) &&
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
    if (optionSort === "occupied") {
      return [...filtered].sort((a, b) => Number(Boolean(optionLocks[b.option.id] || b.option.occupied)) - Number(Boolean(optionLocks[a.option.id] || a.option.occupied)) || a.option.option.localeCompare(b.option.option, "pt-BR", { numeric: true }));
    }
    if (optionSort === "priority") {
      return [...filtered].sort((a, b) => Number(b.option.priority || 0) - Number(a.option.priority || 0) || a.option.option.localeCompare(b.option.option, "pt-BR", { numeric: true }));
    }
    return filtered;
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
    optionLocks,
    optionSort,
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

    optionsWithTickets.forEach(({ option, openStat, disabled }) => {
      const openedAt = openStat.firstOccurrence ? new Date(openStat.firstOccurrence).getTime() : Number.NaN;
      if (Number.isFinite(openedAt)) activeDates.push(openedAt);

      const status = getHadronOptionStatus(option, openStat.count, disabled);
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
  const persistOverride = async (option: HadronOption) => {
    if (option.id.startsWith("novo-")) {
      const created = { ...option, id: crypto.randomUUID() };
      if (!await trySaveCrmCatalog("options", [created])) return;
      setEditingOption(null);
      toast.success("Opção criada com sucesso.");
      return;
    }
    if (!await trySaveCrmCatalog("options", [option])) return;
    setEditingOption(null);
    if (viewingOption?.id === option.id) setViewingOption(option);
  };
  const deactivateOption = async () => {
    if (!deactivatingOption) return;
    if (!await trySaveCrmCatalog("options", [deactivatingOption], true)) return;
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
      void recordHadronOptionLog(option.id, "view", "occupied");
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
      void recordHadronOptionLog(optionId, "closedOp", "online");
      if (window.history.state?.hadronOptionId === optionId) window.history.back();
    } catch {
      toast.error("Não foi possível liberar esta opção.");
    }
  };
  const releaseOptionToTests = async (option: HadronOption) => {
    const updated = {
      ...option,
      status: "8",
      releaseOwner: currentUser.operator || currentUser.name,
      updatedAt: new Date().toISOString(),
    };
    if (!await trySaveCrmCatalog("options", [updated])) return;
    await releaseHadronOptionLock(option.id);
    setOptionLocks((current) => {
      const next = { ...current };
      delete next[option.id];
      return next;
    });
    setViewingOption(null);
    void recordHadronOptionLog(option.id, "releaseTests", "Opção liberada para testes");
    window.dispatchEvent(new CustomEvent("hadron-occurrence-reviewed"));
    toast.success("Opção liberada para testes.");
  };
  if (viewingOption) {
    const row = optionsWithTickets.find(({ option }) => option.id === viewingOption.id);
    return (
      <>
        <HadronOptionPage
          option={row?.option || viewingOption}
          tickets={row?.related || []}
          unresolvedCount={row?.openStat.count || 0}
          disabled={row?.disabled || false}
          onBack={returnToOptions}
          onExit={() => void leaveOption()}
          onEdit={() => setEditingOption(row?.option || viewingOption)}
          onReleaseTests={() => void releaseOptionToTests(row?.option || viewingOption)}
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Opções</h2>
            <Button
              type="button"
              className="h-10 w-40 min-w-40 shrink-0 cursor-pointer px-4"
              onClick={() =>
                setEditingOption({
                  id: `novo-${Date.now()}`,
                  option: "",
                  form: "",
                  description: "",
                  label: "",
                  status: "0",
                  owner: currentUser.operator,
                  characteristic: "cadastro",
                  observation: "",
                  call: "",
                  executable: "",
                  tester: currentUser.operator,
                  releaseOwner: "",
                  approvalOwner: "",
                  hadronOwner: "",
                  openedAt: new Date().toISOString().slice(0, 10),
                  approvedAt: "",
                  hadronAt: "",
                  tags: "",
                  listView: "0",
                  moduleId: "1",
                  submoduleId: "20",
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar opção
            </Button>
          </div>
          <div className="mt-4 grid items-center gap-2 md:grid-cols-2 xl:grid-cols-[minmax(100px,1fr)_minmax(90px,.8fr)_minmax(90px,.75fr)_minmax(100px,.8fr)_minmax(110px,.8fr)_minmax(100px,.8fr)_minmax(90px,.75fr)_minmax(210px,1.5fr)_auto]">
            <Input
              value={optionQuery}
              onChange={(event) => {
                setOptionQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Opção"
              className="text-sm placeholder:text-sm placeholder:text-muted-foreground"
            />
            <Input
              value={formQuery}
              onChange={(event) => {
                setFormQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Formulário"
              className="text-sm placeholder:text-sm placeholder:text-muted-foreground"
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
                ["criacao", "Tipo data"],
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-10 cursor-pointer bg-transparent px-3 hover:bg-sky-100 dark:hover:bg-sky-500/15"
          >
            Limpar
          </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] table-fixed text-left text-[11px] xl:text-xs">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[3%]" />
              <col className="w-[7%]" />
              <col className="w-[6%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal">
              <tr>
                <th className="break-words px-2 py-3 font-medium">Status</th>
                <th className="px-1 py-3 text-center font-medium">
                  <button type="button" title="Ordenar por prioridade" onClick={() => setOptionSort(optionSort === "priority" ? "default" : "priority")} className="inline-flex cursor-pointer items-center gap-1">P<ArrowUpDown className="h-3 w-3" /></button>
                </th>
                <th className="break-words px-2 py-3 font-medium">
                  <span className="block">Opção</span>
                  <button type="button" onClick={() => setOptionSort(optionSort === "occupied" ? "default" : "occupied")} className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground">Ocupada<ArrowUpDown className="h-3 w-3" /></button>
                </th>
                {[
                  "Formulário",
                  "Descrição",
                  "Chamada",
                  "Data",
                  "DLL EXE",
                  "Módulo / Submódulo",
                  "Responsável",
                  "Ações",
                ].map((header) => (
                  <th key={header} className={cn("break-words px-2 py-3 font-medium", header === "Módulo / Submódulo" && "text-center")}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:nth-child(even)]:bg-sky-50/45 dark:[&_tr:nth-child(even)]:bg-sky-950/15">
              {pagedRows.map(({ option, openStat, disabled }) => {
                const optionLock = optionLocks[option.id];
                const lockedByAnother = Boolean(
                  optionLock && optionLock.userId !== session?.user.id,
                );
                const optionStatus = getHadronOptionStatus(option, openStat.count, disabled);
                const daysOverdue = openStat.firstOccurrence
                  ? Math.max(0, Math.floor((Date.now() - new Date(openStat.firstOccurrence).getTime()) / 86_400_000))
                  : 0;
                const statusDisplay = {
                  desenvolvimento: {
                    label: "DESENVOLVIMENTO",
                    className: "bg-slate-600 text-white hover:bg-slate-600",
                  },
                  correcoes: {
                    label: openStat.count ? `CORREÇÕES ${openStat.count}` : "CORREÇÕES",
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
                return (
                  <tr
                    key={option.id}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/40",
                      disabled && "opacity-55",
                    )}
                  >
                    <td className="px-2 py-3">
                      <Badge className={cn("whitespace-nowrap", statusDisplay.className)}>
                        {statusDisplay.label}
                      </Badge>
                      {optionStatus === "correcoes" && openStat.count > 0 && (
                        <span className="mt-1 block text-[10px] text-rose-700">{daysOverdue} dias de atraso</span>
                      )}
                    </td>
                    <td className="px-1 py-3 text-center">
                      <span className={cn("mx-auto block h-3.5 w-3.5 rounded-full", option.priority === "2" ? "bg-rose-500" : option.priority === "1" ? "bg-amber-500" : option.priority === "0" ? "bg-sky-500" : "bg-muted-foreground")} title={`Prioridade ${option.priority === "2" ? "alta" : option.priority === "1" ? "normal" : option.priority === "0" ? "baixa" : "não informada"}`} aria-label={`Prioridade ${option.priority === "2" ? "alta" : option.priority === "1" ? "normal" : option.priority === "0" ? "baixa" : "não informada"}`} />
                    </td>
                    <td className="break-words px-2 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {option.option}
                        {(optionLock || option.occupied) && (
                          <span
                            className="grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-white"
                            title={`Ocupada por ${optionLock?.operator || option.occupiedBy || "operador não informado"}`}
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
                    <td className="break-words px-2 py-3 text-center">
                      <span title={`${getOptionModuleName(option)} - ${getOptionSubmoduleName(option)}`}>
                        {[option.moduleId, option.submoduleId].filter(Boolean).join(" - ") || "Não informado"}
                      </span>
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
                          <ClipboardList className="h-4 w-4 text-cyan-700" />
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
                          <ScanEye className="h-4 w-4 text-sky-700" />
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
                          <FilePenLine className="h-4 w-4 text-amber-700" />
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
                          <Trash2 className="h-4 w-4" />
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
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <strong className="font-medium text-foreground">Opções:</strong>
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
          <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
            <strong className="font-medium text-foreground">Ocorrências:</strong>
            {[
              ["aviso", "AVISO", Flag, "text-slate-500"],
              ["sugestao", "SUGESTÃO/SOLICITAÇÃO", Sparkles, "text-amber-500"],
              ["aprovacao", "APROVAÇÃO", ClipboardCheck, "text-sky-600"],
              ["solucao", "SOLUÇÃO", Wrench, "text-emerald-600"],
              ["revisada", "REVISADA", CheckCircle2, "text-green-600"],
              ["ocorrencia", "OCORRÊNCIA", Bug, "text-rose-600"],
            ].map(([value, label, Icon, color], index) => (
              <span key={String(value)} className="inline-flex items-center gap-1">
                <Icon className={cn("h-3.5 w-3.5", color)} />
                {String(label)} ({occurrenceSummary[String(value)] || 0})
                {index < 5 && <span aria-hidden="true">|</span>}
              </span>
            ))}
          </div>
        </div>
      </section>
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
        <DialogContent className="max-w-md" autoFooter={false}>
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
  unresolvedCount,
  disabled,
  onBack,
  onExit,
  onEdit,
  onReleaseTests,
}: {
  option: HadronOption;
  tickets: TicketRow[];
  unresolvedCount: number;
  disabled: boolean;
  onBack: () => void;
  onExit: () => void;
  onEdit: () => void;
  onReleaseTests: () => void;
}) {
  const { department } = usePortalAuth();
  const { items: hadronReleases } = useCrmCatalog<CatalogRelease>("releases");
  const { items: versions } = useCrmCatalog<CatalogVersion>("versions");
  const erpVersions = useMemo(() => [...versions].sort((a,b) => b.data_versao.localeCompare(a.data_versao)), [versions]);
  const latestFilledVersion = erpVersions.find((version) => version.versao?.trim() && version.data_versao?.trim());
  const moduleName = getOptionModuleName(option);
  const submoduleName = getOptionSubmoduleName(option);
  const [optionChecklist,setOptionChecklist] = useState(() => getHadronOptionChecklist(option.id));
  const [processingChecks,setProcessingChecks] = useState(false);
  const [releaseTestsReady, setReleaseTestsReady] = useState(false);
  const canManageChecklist = ["admin", "development", "tester"].includes(department || "");
  const canEditFirstChecklist = canManageChecklist && ["0", "4"].includes(option.status) && unresolvedCount === 0;
  const canEditSecondChecklist = canManageChecklist && option.status === "8";
  useEffect(() => {
    let active=true;
    loadOptionChecklist(option.id).then((items) => {if(active) setOptionChecklist(items);}).catch(() => toast.error("Não foi possível carregar as validações do checklist."));
    return () => {active=false;};
  },[option.id]);
  const { allCollaborators } = useCollaborators({ onlyActive: true });
  const [newOccurrenceOpen, setNewOccurrenceOpen] = useState(false);
  const [newReleaseOpen, setNewReleaseOpen] = useState(false);
  const [savingOccurrence, setSavingOccurrence] = useState(false);
  const [savingRelease, setSavingRelease] = useState(false);
  const [releaseOccurrences, setReleaseOccurrences] = useState<HadronOccurrence[]>([]);
  const [optionLogs, setOptionLogs] = useState<AuthLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [occurrenceDraft, setOccurrenceDraft] = useState({
    kind: "ocorrencia",
    priority: "1",
    operator: currentUser.operator,
    baseAddress: "",
    versionLegacyId: latestFilledVersion?.id || "",
    occurrence: "",
  });
  const [releaseDraft, setReleaseDraft] = useState({
    releaseType: "novidade",
    permission: "clientes",
    version: latestFilledVersion?.data_versao || "",
    moduleId: option.moduleId,
    submoduleId: option.submoduleId,
    title: "",
    description: "",
    tags: option.tags || "",
  });
  useEffect(() => {
    if (!latestFilledVersion) return;
    setOccurrenceDraft((current) => current.versionLegacyId ? current : { ...current, versionLegacyId: latestFilledVersion.id });
    setReleaseDraft((current) => current.version ? current : { ...current, version: latestFilledVersion.data_versao });
  }, [latestFilledVersion?.id, latestFilledVersion?.data_versao]);
  const optionReleases = hadronReleases
    .filter(
      (release) =>
        Boolean(release.version) &&
        (release.optionId === option.id ||
          release.option === option.option ||
          release.form === option.form),
    )
    .sort((a, b) => (b.createdAt || b.updatedAt).localeCompare(a.createdAt || a.updatedAt));
  const releaseModuleItems = [...hadronModuleNames.entries()].map(([id, name]) => [
    id,
    `${id} : ${name}`,
  ] as [string, string]);
  const releaseSubmoduleItems = [...hadronSubmoduleNames.entries()]
    .filter(([key]) => key.startsWith(`${releaseDraft.moduleId}:`))
    .map(([key, name]) => [key.split(":")[1], name] as [string, string]);
  useEffect(() => {
    if (!newReleaseOpen) return;
    void listHadronOccurrences({ page: 1, pageSize: 20, optionIds: [option.id], unresolved: true })
      .then((result) => setReleaseOccurrences(result.rows))
      .catch(() => setReleaseOccurrences([]));
  }, [newReleaseOpen, option.id]);
  useEffect(() => {
    const loadLogs = () => {
      setLogsLoading(true);
      void listHadronOptionLogs(option.id)
        .then(setOptionLogs)
        .catch(() => setOptionLogs([]))
        .finally(() => setLogsLoading(false));
    };
    const reloadLogs = (event: Event) => {
      const optionId = (event as CustomEvent<string>).detail;
      if (!optionId || optionId === option.id) loadLogs();
    };
    loadLogs();
    window.addEventListener("hadron-option-log-created", reloadLogs);
    return () => window.removeEventListener("hadron-option-log-created", reloadLogs);
  }, [option.id]);
  return (
    <section className="space-y-4">
      <header className="rounded-md border border-sky-200 bg-sky-50/70 p-4 shadow-sm dark:border-sky-900 dark:bg-sky-950/25">
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
            <Button type="button" variant="outline" onClick={() => { void recordHadronOptionLog(option.id, "edit", "Alteração da opção"); onEdit(); }} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" />
              Alterar
            </Button>
            <Button type="button" className="cursor-pointer bg-amber-500 text-white hover:bg-amber-600" disabled={!releaseTestsReady} onClick={onReleaseTests}>
              Liberar testes
            </Button>
            <Button type="button" variant="destructive" onClick={onExit} className="cursor-pointer">
              Sair
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-x-3 gap-y-2 border-t pt-4 sm:grid-cols-4 xl:grid-cols-8">
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
          <Tabs
            defaultValue="ocorrencias"
            onValueChange={(value) =>
              void recordHadronOptionLog(
                option.id,
                value === "logs" ? "logs" : value === "releases" ? "releases" : "ajaxOccurrences",
                value === "logs" ? "Visualização dos logs" : value === "releases" ? "Visualização dos releases" : "Visualização das ocorrências",
              )
            }
          >
            <TabsList className="justify-start bg-transparent p-0">
              <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
              <TabsTrigger value="releases">Releases</TabsTrigger>
              <TabsTrigger value="logs">Últimos logs</TabsTrigger>
            </TabsList>
            <TabsContent value="ocorrencias" className="mt-5">
              <OptionImportedOccurrences
                option={option}
                onCreate={() => {
                  void recordHadronOptionLog(option.id, "addOccurrence", "Nova ocorrência");
                  setNewOccurrenceOpen(true);
                }}
              />
            </TabsContent>
            <TabsContent
              value="releases"
              className="mt-5 space-y-3"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-xs text-muted-foreground">
                  {optionReleases.length} releases vinculados
                </span>
              </div>
              {optionReleases.map((release) => (
                <article key={release.id} className="space-y-3 border-b py-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Sparkles
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        release.releaseType === "correcao"
                          ? "text-rose-500"
                          : release.releaseType === "alteracao"
                            ? "text-sky-600"
                            : "text-amber-500",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-primary">
                        {release.option}/{release.form || release.option} - {release.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {hadronModuleNames.get(release.moduleId) || "Módulo não informado"}
                        {release.submoduleId
                          ? ` | ${hadronSubmoduleNames.get(`${release.moduleId}:${release.submoduleId}`) || "Submódulo não informado"}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatCatalogDate(release.createdAt)}</span>
                    <span>{release.owner || "Não informado"} - {release.tester || "Não informado"}</span>
                    <span>Versão: {getReleaseVersionLabel(release.version)}</span>
                  </div>
                  <div className="rounded-md border bg-background p-3 text-sm leading-6">
                    <LegacyRichContent value={release.description || "Sem detalhes informados."} />
                  </div>
                </article>
              ))}
              {!optionReleases.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum release vinculado a esta opção.
                </p>
              )}
            </TabsContent>
            <TabsContent value="logs" className="mt-5 space-y-2">
              <div className="flex justify-end border-b pb-2">
                <Button asChild variant="outline" size="sm">
                  <Link
                    to="/configuracoes/logs"
                    onClick={() =>
                      sessionStorage.setItem("hadron:return-option", JSON.stringify(option))
                    }
                  >
                    Ver todos
                  </Link>
                </Button>
              </div>
              <div className="hidden grid-cols-[1fr_1.5fr_1fr_120px] gap-2 border-b bg-muted/20 px-2 py-2 text-xs font-medium text-primary md:grid">
                <span>Controlador/Ação</span><span>URL/Informação extra</span><span>Operador/IP</span><span>Data</span>
              </div>
              {optionLogs.map((log) => (
                <div key={log.id} className="grid gap-2 border-b px-2 py-3 text-xs md:grid-cols-[1fr_1.5fr_1fr_120px]">
                  <span className="font-medium">{translateHadronLogTerm(log.controller)} / {translateHadronLogTerm(log.action)}</span>
                  <span className="truncate text-muted-foreground" title={log.info || log.url || ""}>{log.info || log.url || "Sem informação adicional"}</span>
                  <span>{log.operator || "Não informado"}{log.ipAddress ? ` / ${log.ipAddress}` : ""}</span>
                  <span className="text-muted-foreground">{formatLogDate(log.createdAt)}</span>
                </div>
              ))}
              {logsLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando logs...</p>}
              {!logsLoading && !optionLogs.length && (
                <div className="divide-y">
                  {[
                    ["Atualização", option.updatedAt, option.owner],
                    ["Aprovação", option.approvedAt, option.approvalOwner],
                    ["Liberação Hádron", option.hadronAt, option.hadronOwner],
                  ].filter(([, date]) => Boolean(date)).map(([action, date, operator]) => (
                    <div key={action} className="grid gap-2 px-2 py-3 text-xs md:grid-cols-[1fr_1.5fr_1fr_120px]">
                      <span className="font-medium">CvsOptions/{action}</span>
                      <span className="text-muted-foreground">Opção {option.id} - {option.option}/{option.form}</span>
                      <span>{operator || option.owner || "Não informado"}</span>
                      <span className="text-muted-foreground">{formatCatalogDate(date)}</span>
                    </div>
                  ))}
                </div>
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
            <p className="text-xs font-medium uppercase text-muted-foreground">Checklist</p>
            <div className="mt-3 divide-y">
              {optionChecklist.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_18px_18px] items-center gap-2 py-1.5 text-xs"
                  title={item.description}
                >
                  <span className={cn(item.title === "Processar" && "font-semibold")}>
                    {item.title}
                  </span>
                  <input type="checkbox" checked={item.check1} disabled={processingChecks || !canEditFirstChecklist} aria-label={`${item.title}, primeira validação`} className="h-4 w-4 accent-primary" onChange={(event) => {setReleaseTestsReady(false);setOptionChecklist((items) => items.map((row) => row.id === item.id ? {...row,check1:event.target.checked} : row));}} />
                  <input type="checkbox" checked={item.check2} disabled={processingChecks || !canEditSecondChecklist} aria-label={`${item.title}, segunda validação`} className="h-4 w-4 accent-primary" onChange={(event) => setOptionChecklist((items) => items.map((row) => row.id === item.id ? {...row,check2:event.target.checked} : row))} />
                </div>
              ))}
              {!optionChecklist.length && (
                <p className="py-2 text-xs text-muted-foreground">Nenhum check vinculado.</p>
              )}
            </div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_24px_24px] items-center gap-2 border-t pt-2 text-xs"><span className="font-semibold">Processar</span>{([1,2] as const).map((column) => {const enabled=column===1?canEditFirstChecklist:canEditSecondChecklist;return <Button key={column} size="icon" className="h-6 w-6 bg-emerald-600 hover:bg-emerald-700" title={`Processar ${column === 1 ? "primeira" : "segunda"} validação`} disabled={processingChecks || !enabled} onClick={async () => {const allChecked=optionChecklist.length>0 && optionChecklist.every((item)=>column===1?item.check1:item.check2);setProcessingChecks(true);try{await processOptionChecklist(option.id,column,optionChecklist);setReleaseTestsReady(column===1&&allChecked);toast.success(allChecked?"Checklist processado e salvo.":"Checklist salvo. Revise os itens pendentes.");}catch{toast.error("Não foi possível processar o checklist.");}finally{setProcessingChecks(false);}}}><Check className="h-4 w-4" /></Button>;})}</div>
            {!canEditFirstChecklist && option.status !== "8" && <p className="mt-2 text-[11px] text-muted-foreground">A primeira validação é liberada somente sem ocorrências abertas.</p>}
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
          <div className="border-t pt-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Bug className="h-4 w-4 text-muted-foreground" />
              Releases <span className="font-normal text-muted-foreground">Próxima versão</span>
            </p>
            <Button size="sm" onClick={() => { void recordHadronOptionLog(option.id, "addRelease", "Novo release"); setNewReleaseOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Novo
            </Button>
          </div>
        </aside>
      </div>
      <Dialog open={newOccurrenceOpen} onOpenChange={setNewOccurrenceOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden [&>div:last-child]:shrink-0 [&>div:last-child]:pb-6">
          <DialogTitle className="sr-only">Nova ocorrência</DialogTitle>
          <DetailModalHeader icon={Bug} title="Nova ocorrência" protocol={`Opção ${option.option}`} meta={option.description} onClose={() => setNewOccurrenceOpen(false)} accentClassName="bg-rose-500" iconWrapClassName="bg-rose-500 text-white" />
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-5 md:grid-cols-2 lg:grid-cols-4">
            <label className="min-w-0 space-y-1 text-sm"><span>Tipo</span><OccurrenceSelect value={occurrenceDraft.kind} onValueChange={(kind) => setOccurrenceDraft({...occurrenceDraft, kind})} items={[["sugestao","Sugestão/Solicitação"],["aprovacao","Aprovação"],["ocorrencia","Ocorrência"],["solucao","Solução"],["aviso","Aviso"],["revisada","Revisada"]]} /></label>
            <label className="min-w-0 space-y-1 text-sm"><span>Operador</span><OccurrenceSelect value={occurrenceDraft.operator} onValueChange={(operator) => setOccurrenceDraft({...occurrenceDraft,operator})} items={allCollaborators.map((collaborator) => [collaborator.acronym || collaborator.id, collaborator.acronym || collaboratorLabel(collaborator)] as [string,string])} /></label>
            <label className="min-w-0 space-y-1 text-sm"><span>Cliente ou caminho da base</span><Input value={occurrenceDraft.baseAddress} onChange={(e) => setOccurrenceDraft({...occurrenceDraft, baseAddress:e.target.value})} /></label>
            <label className="min-w-0 space-y-1 text-sm"><span>Versão</span><OccurrenceSelect value={occurrenceDraft.versionLegacyId} onValueChange={(versionLegacyId) => setOccurrenceDraft({...occurrenceDraft, versionLegacyId})} items={erpVersions.map((v) => [v.id, `${v.versao} - ${formatVersionDate(v.data_versao)}`])} /></label>
            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <p className="text-sm font-medium">Prioridade</p>
              <div className="max-w-[580px]">
                <HadronPrioritySegmented
                  value={occurrenceDraft.priority}
                  onChange={(priority) => setOccurrenceDraft({ ...occurrenceDraft, priority })}
                />
              </div>
            </div>
            <div className="space-y-1 text-sm md:col-span-2 lg:col-span-4"><span>Descreva a ocorrência</span><span className="block text-xs text-muted-foreground">Caso necessário, inclua os detalhes e imagens que permitam reproduzir o problema.</span><RichTextEditor value={occurrenceDraft.occurrence} onChange={(occurrence) => setOccurrenceDraft({...occurrenceDraft, occurrence})} minHeight={220} /></div>
          </div>
          <DialogFooter className="border-t px-5 py-4"><Button disabled={savingOccurrence} onClick={async () => { if (!occurrenceDraft.baseAddress.trim() || !occurrenceDraft.occurrence.trim()) { toast.error("Informe a base e descreva a ocorrência."); return; } setSavingOccurrence(true); try { await createHadronOccurrence({optionLegacyId:option.id,...occurrenceDraft}); setNewOccurrenceOpen(false); setOccurrenceDraft({...occurrenceDraft,baseAddress:"",occurrence:""}); window.dispatchEvent(new CustomEvent("hadron-occurrence-reviewed")); toast.success("Ocorrência criada com sucesso."); } catch(error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar a ocorrência."); } finally { setSavingOccurrence(false); } }}>{savingOccurrence ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={newReleaseOpen} onOpenChange={setNewReleaseOpen}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Novo release</DialogTitle>
          <DetailModalHeader icon={Rocket} title="Novo release" protocol={`Opção ${option.option}`} meta={option.description} onClose={() => setNewReleaseOpen(false)} accentClassName="bg-amber-500" iconWrapClassName="bg-amber-500 text-white" />
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <div className="grid content-start gap-3 md:grid-cols-6">
              <label className="min-w-0 space-y-1 text-sm md:col-span-2"><span>Tipo Release</span><OccurrenceSelect value={releaseDraft.releaseType} onValueChange={(releaseType) => setReleaseDraft({...releaseDraft,releaseType})} items={[["correcao","Correção"],["alteracao","Alteração"],["novidade","Novidade"]]} /></label>
              <label className="min-w-0 space-y-1 text-sm md:col-span-2"><span>Permissão</span><OccurrenceSelect value={releaseDraft.permission} onValueChange={(permission) => setReleaseDraft({...releaseDraft,permission})} items={[["clientes","Clientes"],["publico","Público"],["empresa","Empresa"]]} /></label>
              <label className="min-w-0 space-y-1 text-sm md:col-span-2"><span>Versão Hádron</span><OccurrenceSelect value={releaseDraft.version} onValueChange={(version) => setReleaseDraft({...releaseDraft,version})} items={erpVersions.filter((item) => item.versao?.trim() && item.data_versao?.trim()).map((item) => [item.data_versao, `${item.versao} - ${formatVersionDate(item.data_versao)}`])} /></label>
              <label className="min-w-0 space-y-1 text-sm md:col-span-2"><span>Opção</span><Input className="truncate" title={`${option.id} - ${option.option}/${option.form} - ${option.description}`} readOnly value={`${option.id} - ${option.option}/${option.form} - ${option.description}`} /></label>
              <label className="min-w-0 space-y-1 text-sm md:col-span-3"><span>Módulo</span><Input readOnly className="bg-muted/35" value={releaseModuleItems.find(([id]) => id === releaseDraft.moduleId)?.[1] || getOptionModuleName(option)} /></label>
              <label className="min-w-0 space-y-1 text-sm md:col-span-3"><span>Submódulo</span><OccurrenceSelect value={releaseDraft.submoduleId} onValueChange={(submoduleId) => setReleaseDraft({...releaseDraft,submoduleId})} items={releaseSubmoduleItems.length ? releaseSubmoduleItems : [[releaseDraft.submoduleId || "sem-submodulo", "Nenhum submódulo disponível"]]} /></label>
              <label className="space-y-1 text-sm md:col-span-6"><span>Descrição</span><Input value={releaseDraft.title} onChange={(e) => setReleaseDraft({...releaseDraft,title:e.target.value})} /></label>
              <label className="space-y-1 text-sm md:col-span-6"><span>Detalhes do release</span><textarea className="min-h-40 w-full resize-y rounded-md border bg-background p-3 outline-none focus:ring-2 focus:ring-ring" value={releaseDraft.description} onChange={(e) => setReleaseDraft({...releaseDraft,description:e.target.value})} /></label>
              <div className="min-w-0 space-y-1 text-sm md:col-span-6"><span>Tags</span><TagInput value={releaseDraft.tags} onChange={(tags) => setReleaseDraft({...releaseDraft,tags})} suggestions={hadronOptions.flatMap((item) => item.tags.split(/[,;]+/))} /></div>
            </div>
            <section className="min-w-0 space-y-2 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <h3 className="text-sm font-medium">Ocorrências</h3>
              <div className="max-h-[390px] divide-y overflow-y-auto rounded-md border bg-muted/10 px-3">
                {releaseOccurrences.map((occurrence) => (
                  <div key={occurrence.id} className="py-2 text-xs">
                    <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                      <span>{occurrence.reporter || "Não informado"}</span>
                      <span>{formatOccurrenceDay(occurrence.occurredAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-foreground">
                      {occurrence.occurrenceText || "Sem descrição"}
                    </p>
                  </div>
                ))}
                {!releaseOccurrences.length && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Nenhuma ocorrência vinculada a esta opção.
                  </p>
                )}
              </div>
            </section>
          </div>
          <DialogFooter className="shrink-0 border-t bg-card px-5 py-4"><Button disabled={savingRelease} onClick={async () => { if (!releaseDraft.title.trim() || !releaseDraft.description.trim()) { toast.error("Informe a descrição e os detalhes do release."); return; } setSavingRelease(true); const saved = await trySaveCrmCatalog("releases", [{id:crypto.randomUUID(),optionId:option.id,option:option.option,form:option.form,owner:currentUser.operator,tester:option.tester,clicks:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:"",exclusive:"",...releaseDraft}]); setSavingRelease(false); if (!saved) return; setNewReleaseOpen(false); toast.success("Release criado no banco."); }}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
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
  const { items: hadronOptions } = useCrmCatalog<HadronOption>("options");
  const { items: hadronChecklist } = useCrmCatalog<[string,string,string,string,boolean,string,string]>("checklist");
  const [draft, setDraft] = useState<HadronOption | null>(option);
  const [editedChecks, setEditedChecks] = useState<ReturnType<typeof getHadronOptionChecklist>>([]);
  const [openOccurrenceCount, setOpenOccurrenceCount] = useState<number | null>(null);
  const { department } = usePortalAuth();
  useEffect(() => {
    if (!option) return;
    setEditedChecks(option.id.startsWith("novo-") ? hadronChecklist.map((item) => ({id:item[0],checkId:item[0],characteristic:item[1],title:item[2],description:item[3],check1:false,check2:false})) : option.checklist || getHadronOptionChecklist(option.id));
    if (!option.id.startsWith("novo-")) void loadOptionChecklist(option.id).then(setEditedChecks).catch(() => toast.error("Não foi possível carregar o checklist."));
  }, [option, hadronChecklist]);
  useEffect(() => {
    if (!option || option.id.startsWith("novo-")) {
      setOpenOccurrenceCount(0);
      return;
    }
    let active = true;
    setOpenOccurrenceCount(null);
    void getHadronOpenOccurrenceStats()
      .then((stats) => { if (active) setOpenOccurrenceCount(stats[option.id]?.count ?? 0); })
      .catch(() => { if (active) setOpenOccurrenceCount(null); });
    return () => { active = false; };
  }, [option?.id]);
  const { collaborators } = useCollaborators();
  useEffect(() => setDraft(option), [option]);
  const isCreating = Boolean(draft?.id.startsWith("novo-"));
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
    [hadronOptions],
  );
  if (!draft) return null;
  const update = (field: keyof HadronOption, value: string) =>
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  const selectedModule = getOptionModuleName(draft);
  const availableSubmodules = modulesMap[selectedModule] || [];
  const optionChecklist = isCreating
    ? editedChecks.filter((item) => item.characteristic === "geral" || item.characteristic === draft.characteristic || (draft.listView === "1" && item.characteristic === "listview"))
    : editedChecks;
  const canManageChecklist = ["admin", "development", "tester"].includes(department || "");
  const canEditFirstChecklist = canManageChecklist && ["0", "4"].includes(draft.status) && openOccurrenceCount === 0;
  const canEditSecondChecklist = canManageChecklist && draft.status === "8";
  return (
    <Dialog open={!!option} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[calc(100vh-2rem)] max-h-[760px] w-[calc(100vw-2rem)] max-w-[940px] flex-col gap-0 overflow-hidden rounded-2xl border bg-card p-0 shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&>button]:hidden">
        <DialogTitle className="sr-only">
          {isCreating ? "Criar opção Hádron" : "Alterar opção Hádron"}
        </DialogTitle>
        <DetailModalHeader
          dense
          icon={isCreating ? Plus : Pencil}
          title={draft.description || "Opção Hádron"}
          protocol={draft.option}
          meta={isCreating ? "Criar opção Hádron" : "Alterar opção Hádron"}
          onClose={onClose}
        />
        <Tabs defaultValue="opcao" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className="mx-6 mt-2 shrink-0 justify-start bg-transparent p-0">
            <TabsTrigger value="opcao">OPÇÃO</TabsTrigger>
            <TabsTrigger value="checklist">CHECKLIST</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
            <TabsContent value="opcao" className="mt-3 space-y-4 pb-2">
              <div>
                <label className="space-y-2 text-[12.5px] font-medium text-foreground">
                  Nome da opção
                  <Input
                    className="font-normal text-foreground"
                    value={draft.description}
                    onChange={(event) => update("description", event.target.value)}
                  />
                </label>
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
                <OptionSelect
                  label="Prioridade"
                  value={draft.priority || "1"}
                  onChange={(value) => update("priority", value)}
                  options={[
                    { value: "0", label: "Baixa" },
                    { value: "1", label: "Normal" },
                    { value: "2", label: "Alta" },
                  ]}
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
                <TagInput value={draft.tags} onChange={(value) => update("tags", value)} suggestions={tagSuggestions} />
              </label>
              <label className="block space-y-2 text-[12.5px] font-medium text-foreground">
                Descrição da opção
                <RichTextEditor value={normalizeLegacyHtml(draft.observation)} onChange={value => update("observation", value)} />
              </label>
            </TabsContent>
            <TabsContent value="checklist" className="mt-4 pb-2">
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {[...new Set(optionChecklist.map((item) => item.characteristic))].map((characteristic) => <section key={characteristic}><h3 className="mb-2 border-b pb-2 text-sm font-medium capitalize">{characteristic}</h3>
                {optionChecklist.filter((item) => item.characteristic === characteristic).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b py-2 text-sm"
                  >
                    <span>
                      <strong className="font-medium">{item.title}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={item.check1}
                      disabled={!canEditFirstChecklist}
                      onChange={(event) => setEditedChecks((items) => items.map((check) => check.id === item.id ? {...check, check1: event.target.checked} : check))}
                      aria-label={`${item.title}, primeira validação`}
                      className="h-4 w-4 accent-primary"
                    />
                    <input
                      type="checkbox"
                      checked={item.check2}
                      disabled={!canEditSecondChecklist}
                      onChange={(event) => setEditedChecks((items) => items.map((check) => check.id === item.id ? {...check, check2: event.target.checked} : check))}
                      aria-label={`${item.title}, segunda validação`}
                      className="h-4 w-4 accent-primary"
                    />
                  </div>
                ))}</section>)}
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <DialogFooter className="shrink-0 gap-2 border-t bg-card px-5 py-2.5 sm:gap-2">
          <Button
            onClick={async () => {
              if (!draft.description.trim() || !draft.option.trim() || !draft.form.trim()) {
                toast.error("Informe o nome, a opção e o formulário.");
                return;
              }
              if (!isCreating) {
                try {
                  if (canEditFirstChecklist) await processOptionChecklist(draft.id, 1, optionChecklist);
                  if (canEditSecondChecklist) await processOptionChecklist(draft.id, 2, optionChecklist);
                } catch {
                  toast.error("Não foi possível salvar o checklist.");
                  return;
                }
              }
              onSave({ ...draft, checklist: optionChecklist, label: `${draft.description} (${draft.option} - ${draft.form})` });
            }}
          >
            {isCreating ? "Criar opção" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagInput({
  value,
  onChange,
  suggestions = [],
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const tags = value.split(/[,;]+/).map((tag) => tag.trim()).filter(Boolean);
  const normalizedTags = new Set(tags.map(normalizeOccurrenceText));
  const choices = [...new Set(suggestions.map((tag) => tag.trim()).filter(Boolean))]
    .filter((tag) => !normalizedTags.has(normalizeOccurrenceText(tag)))
    .filter((tag) => !query || normalizeOccurrenceText(tag).includes(normalizeOccurrenceText(query)))
    .slice(0, 8);
  const addTag = (tag: string) => {
    const clean = tag.trim().replace(/^[,;]+|[,;]+$/g, "");
    if (!clean) return;
    if (!normalizedTags.has(normalizeOccurrenceText(clean))) onChange([...tags, clean].join(", "));
    setQuery("");
    setOpen(false);
  };
  return (
    <div className="relative mt-1">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-ring">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-1 text-xs text-sky-900 dark:bg-sky-500/20 dark:text-sky-100">
            {tag}
            <button type="button" aria-label={`Remover tag ${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag).join(", "))}><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(choices.find((tag) => normalizeOccurrenceText(tag) === normalizeOccurrenceText(query)) || query);
            }
            if (event.key === "Backspace" && !query && tags.length) onChange(tags.slice(0, -1).join(", "));
          }}
          placeholder={tags.length ? "Adicionar tag" : "Digite ou selecione uma tag"}
          className="min-w-36 flex-1 bg-transparent px-1 py-1.5 text-sm outline-none"
        />
      </div>
      {open && (choices.length > 0 || query.trim()) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
          {choices.map((tag) => <button key={tag} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addTag(tag)} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted">{tag}</button>)}
          {query.trim() && !choices.some((tag) => normalizeOccurrenceText(tag) === normalizeOccurrenceText(query)) && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addTag(query)} className="block w-full rounded px-3 py-2 text-left text-sm font-medium text-primary hover:bg-muted">Criar “{query.trim()}”</button>}
        </div>
      )}
    </div>
  );
}

function RelationPicker({ value, onChange, items, label }: { value: string; onChange: (value: string) => void; items: [string, string][]; label: string }) {
  const [selected, setSelected] = useState("");
  const ids = value.replace(/[\[\]"]/g, "").split(/[,;]+/).map((id) => id.trim()).filter(Boolean);
  const add = () => {
    if (!selected || ids.includes(selected)) return;
    onChange([...ids, selected].join(", "));
    setSelected("");
  };
  return <div className="space-y-2">
    <span className="text-sm">{label}</span>
    <div className="flex gap-2"><div className="min-w-0 flex-1"><OccurrenceSelect value={selected || "none"} onValueChange={setSelected} items={[["none", `Selecione ${label.toLowerCase()}`], ...items.filter(([id]) => !ids.includes(id))]} /></div><Button type="button" variant="outline" onClick={add} disabled={!selected || selected === "none"}><Plus className="mr-1 h-4 w-4" />Adicionar</Button></div>
    {ids.length > 0 && <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/15 p-2">{ids.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded bg-background px-2 py-1 text-xs shadow-sm">{items.find(([itemId]) => itemId === id)?.[1] || `${id} - não encontrado`}<button type="button" onClick={() => onChange(ids.filter((item) => item !== id).join(", "))} aria-label={`Remover ${id}`}><X className="h-3 w-3" /></button></span>)}</div>}
  </div>;
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

function OccurrencePriorityField({occurrence}: {occurrence: Pick<HadronOccurrence,"id" | "priority">}) {
  const display = normalizeOccurrencePriority(occurrence.priority);
  return <Badge variant="outline" title={`Prioridade: ${display.label}`} className={cn("h-5 w-fit shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px] font-medium",display.className)}>{display.label}</Badge>;
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
    title: occurrence.occurrenceText || "Ocorrência sem descrição",
    subtitle: `Opção: ${optionLabel}`,
    body: occurrence.occurrenceText || "Sem descrição.",
    meta: [],
    hadronOccurrence: {
      id: occurrence.id,
      priority: occurrence.priority,
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
      approvedAt: occurrence.approvedAt,
      optionStatus: option?.status,
      version: occurrence.versionLegacyId,
      baseAddress: occurrence.baseAddress || occurrence.testBase,
    },
  });
}

function OptionImportedOccurrences({
  option,
  latestOnly = false,
  unresolved = false,
  onCreate,
}: {
  option: HadronOption;
  latestOnly?: boolean;
  unresolved?: boolean;
  onCreate?: () => void;
}) {
  const [rows, setRows] = useState<HadronOccurrence[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewOccurrence, setReviewOccurrence] = useState<HadronOccurrence | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<HadronOccurrence | null>(null);
  const [removingOccurrence, setRemovingOccurrence] = useState<HadronOccurrence | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const { department } = usePortalAuth();
  const { items: versions } = useCrmCatalog<CatalogVersion>("versions");
  const erpVersions = useMemo(() => [...versions].sort((a, b) => b.data_versao.localeCompare(a.data_versao)), [versions]);
  const latestFilledVersion = erpVersions.find((version) => version.versao?.trim() && version.data_versao?.trim());
  useEffect(() => {
    if (!latestFilledVersion) return;
    setEditingOccurrence((current) => current && !current.versionLegacyId ? { ...current, versionLegacyId: latestFilledVersion.id } : current);
  }, [latestFilledVersion?.id]);

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
    const load = async () => {
      const collected: HadronOccurrence[] = [];
      let total = 0;
      for (let batch = 1; active; batch++) {
        const result = await listHadronOccurrences({page:batch,pageSize:latestOnly ? 1 : 100,optionIds:[option.id],unresolved});
        if (!active) return {rows:[],total:0};
        collected.push(...result.rows);
        total = result.total;
        if (latestOnly || !result.rows.length || collected.length >= total) break;
      }
      return {rows:collected,total};
    };
    void load()
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
  }, [latestOnly, unresolved, option.id, reloadKey]);

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
          {!latestOnly && onCreate && <Button size="sm" onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Nova ocorrência</Button>}
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
                  defaultExpanded={occurrence.kind === "ocorrencia" && !occurrence.solvedAt && !occurrence.reviewedAt}
                  onInformSolution={setSolutionOccurrence}
                  canManage={
                    ["admin", "development", "tester"].includes(department || "") ||
                    normalizeOccurrenceText(occurrence.reporter) === normalizeOccurrenceText(currentUser.operator)
                  }
                  onEdit={(item) => setEditingOccurrence({ ...item, versionLegacyId: item.versionLegacyId || latestFilledVersion?.id || "" })}
                  onDelete={setRemovingOccurrence}
                  canReview={
                    department === "admin" ||
                    normalizeOccurrenceText(occurrence.reporter) ===
                      normalizeOccurrenceText(currentUser.operator)
                  }
                  onInformReview={setReviewOccurrence}
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
      <Dialog open={Boolean(editingOccurrence)} onOpenChange={(open) => !open && setEditingOccurrence(null)}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Editar ocorrência</DialogTitle>
          {editingOccurrence && <>
            <DetailModalHeader icon={Pencil} title="Editar ocorrência" protocol={`Ocorrência ${editingOccurrence.id}`} meta={option.description} onClose={() => setEditingOccurrence(null)} />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm"><span>Cliente ou caminho da base</span><Input value={editingOccurrence.baseAddress} onChange={(event) => setEditingOccurrence({...editingOccurrence,baseAddress:event.target.value})} /></label>
                <label className="space-y-1 text-sm"><span>Versão</span><OccurrenceSelect value={editingOccurrence.versionLegacyId} onValueChange={(versionLegacyId) => setEditingOccurrence({...editingOccurrence,versionLegacyId})} items={erpVersions.map((version) => [version.id, `${version.versao} - ${formatVersionDate(version.data_versao)}`])} /></label>
                <div className="space-y-1 text-sm"><span>Prioridade</span><HadronPrioritySegmented value={editingOccurrence.priority} onChange={(priority) => setEditingOccurrence({...editingOccurrence,priority})} /></div>
              </div>
              <div className="space-y-1 text-sm"><span>Descreva a ocorrência</span><RichTextEditor value={editingOccurrence.occurrenceHtml || editingOccurrence.occurrenceText} onChange={(occurrenceHtml) => setEditingOccurrence({...editingOccurrence,occurrenceHtml})} minHeight={240} /></div>
            </div>
            <DialogFooter className="border-t px-5 py-4"><Button onClick={async () => { await updateHadronOccurrence({id:editingOccurrence.id,occurrence:editingOccurrence.occurrenceHtml || editingOccurrence.occurrenceText,operator:currentUser.operator,baseAddress:editingOccurrence.baseAddress,versionLegacyId:editingOccurrence.versionLegacyId,priority:editingOccurrence.priority}); setEditingOccurrence(null);setReloadKey((value) => value + 1);toast.success("Ocorrência atualizada no banco."); }}>Salvar</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(removingOccurrence)} onOpenChange={(open) => !open && setRemovingOccurrence(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir ocorrência?</AlertDialogTitle><AlertDialogDescription>Esta ocorrência será removida permanentemente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { if (!removingOccurrence) return; await deleteHadronOccurrence(removingOccurrence.id);setRemovingOccurrence(null);setReloadKey((value) => value + 1);window.dispatchEvent(new CustomEvent("hadron-occurrence-reviewed"));toast.success("Ocorrência excluída do banco."); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(reviewOccurrence)}
        onOpenChange={(open) => !open && !reviewing && setReviewOccurrence(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar revisão desta ocorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              A ocorrência será marcada como revisada pelo operador que realizou a abertura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={reviewing}
              onClick={async (event) => {
                event.preventDefault();
                if (!reviewOccurrence) return;
                setReviewing(true);
                try {
                  await reviewHadronOccurrence(reviewOccurrence.id);
                  setReviewOccurrence(null);
                  setReloadKey((current) => current + 1);
                  window.dispatchEvent(new CustomEvent("hadron-occurrence-reviewed"));
                  toast.success("Ocorrência revisada com sucesso.");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Não foi possível revisar a ocorrência.",
                  );
                } finally {
                  setReviewing(false);
                }
              }}
            >
              {reviewing ? "Revisando..." : "Informar revisão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function HadronOccurrenceTimelineItem({
  occurrence,
  reporter,
  solver,
  isLast,
  defaultExpanded,
  onInformSolution,
  canManage,
  onEdit,
  onDelete,
  canReview,
  onInformReview,
}: {
  occurrence: HadronOccurrence;
  reporter: string;
  solver: string;
  isLast: boolean;
  defaultExpanded: boolean;
  onInformSolution: (occurrence: HadronOccurrence) => void;
  canManage: boolean;
  onEdit: (occurrence: HadronOccurrence) => void;
  onDelete: (occurrence: HadronOccurrence) => void;
  canReview: boolean;
  onInformReview: (occurrence: HadronOccurrence) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => setExpanded(defaultExpanded), [defaultExpanded]);
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
          <button type="button" title={expanded ? "Recolher ocorrência" : "Expandir ocorrência"} onClick={() => setExpanded((value) => !value)} className="grid h-7 w-7 cursor-pointer place-items-center rounded hover:bg-muted"><ChevronDown className={cn("h-4 w-4 transition-transform", !expanded && "-rotate-90")} /></button>
          {canManage && <><button type="button" title="Editar ocorrência" onClick={() => onEdit(occurrence)} className="grid h-7 w-7 cursor-pointer place-items-center rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button><button type="button" title="Excluir ocorrência" onClick={() => onDelete(occurrence)} className="grid h-7 w-7 cursor-pointer place-items-center rounded text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /></button></>}
          <span
            className="inline-flex min-w-[96px] items-center justify-center rounded-full px-2.5 py-0.5 font-medium text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            {formatOccurrenceDay(openedAt)}
          </span>
          <span className="font-medium text-foreground">{reporter}</span>
          <OccurrencePriorityField occurrence={occurrence} />
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
        {expanded && <><div className="mt-1 text-[13px] leading-5 text-foreground">
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
        {occurrence.kind === "ocorrencia" && solved && !reviewed && canReview && (
          <Button
            type="button"
            size="sm"
            className="mt-3 cursor-pointer"
            onClick={() => onInformReview(occurrence)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Informar revisão
          </Button>
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
        )}</>}
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
  const [solutionOperator, setSolutionOperator] = useState(currentUser.operator || currentUser.name);
  const [solutionBase, setSolutionBase] = useState("");
  const [solutionVersion, setSolutionVersion] = useState("");
  const { items: versions } = useCrmCatalog<CatalogVersion>("versions");
  const erpVersions = useMemo(() => [...versions].sort((a, b) => b.data_versao.localeCompare(a.data_versao)), [versions]);
  const latestFilledVersion = erpVersions.find((version) => version.versao?.trim() && version.data_versao?.trim());
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSolution(occurrence?.solutionHtml || occurrence?.solutionText || ""); setSolutionOperator(occurrence?.solver || currentUser.operator || currentUser.name); setSolutionBase(occurrence?.baseAddress || occurrence?.testBase || ""); setSolutionVersion(occurrence?.versionLegacyId || latestFilledVersion?.id || ""); }, [occurrence?.id]);
  useEffect(() => { if (latestFilledVersion) setSolutionVersion((current) => current || latestFilledVersion.id); }, [latestFilledVersion?.id]);
  if (!occurrence) return null;
  const operator = solutionOperator || currentUser.operator || currentUser.name;
  const save = async () => {
    if (!solution.trim()) {
      toast.error("Informe a solução da ocorrência.");
      return;
    }
    setSaving(true);
    try {
      await updateHadronOccurrenceSolution({ id: occurrence.id, solution, operator, baseAddress: solutionBase, versionLegacyId: solutionVersion });
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
            <label className="space-y-1 text-sm"><span>Operador</span><Input value={solutionOperator} onChange={(event) => setSolutionOperator(event.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>Cliente ou caminho da base</span><Input value={solutionBase} onChange={(event) => setSolutionBase(event.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>Versão</span><OccurrenceSelect value={solutionVersion} onValueChange={setSolutionVersion} items={erpVersions.map((version) => [version.id, `${version.versao} - ${formatVersionDate(version.data_versao)}`])} /></label>
          </div>
          <div className="block space-y-2 text-[12.5px] font-medium text-foreground">
            Solução
            <RichTextEditor value={solution} onChange={setSolution} minHeight={240} />
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t bg-card px-5 py-3 sm:gap-2">
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
      "8": "Testes",
      "9": "Aprovada",
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
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
        {option && (
          <>
            <DialogTitle className="sr-only">Ocorrências</DialogTitle>
            <DetailModalHeader
              icon={ClipboardCheck}
              title="Ocorrências"
              meta={`Opção: ${option.option}`}
              chips={
                <Badge
                  className={cn(
                    "text-white",
                    option.status === "9"
                      ? "bg-cyan-600 hover:bg-cyan-600"
                      : "bg-rose-600 hover:bg-rose-600",
                  )}
                >
                  {hadronOptionStatusLabel(option.status).toUpperCase()}
                </Badge>
              }
              onClose={onClose}
            />
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <OptionImportedOccurrences option={option} unresolved />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportedOccurrencesTable({ query, onOpen }: TableProps) {
  const { department } = usePortalAuth();
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
  const [kindCounts, setKindCounts] = useState<Record<string, number>>({});
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
          (!ownerTerm || normalizeOccurrenceText(option.owner) === normalizeOccurrenceText(ownerTerm)),
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
    void getHadronOccurrenceKindCounts()
      .then(setKindCounts)
      .catch(() => setKindCounts({}));
  }, [reloadKey]);

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
    <>
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
                ...(userType === "responsavel"
                  ? [...new Set(hadronOptions.map((option) => option.owner.trim()).filter(Boolean))].sort()
                  : operators).map((item) => [item, item] as [string, string]),
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
            <thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal">
              <tr>
                <th className="w-[4%] px-2 py-3 text-center font-medium">Tipo</th>
                <th className="w-28 px-2 py-3 font-medium">Prioridade</th>
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
                    <td className="px-2 py-3"><OccurrencePriorityField occurrence={occurrence} /></td>
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
                      <OccurrenceDate
                        value={occurrence.occurredAt}
                        operator={occurrence.reporter}
                        dateOnly
                      />
                    </td>
                    <td className="px-3 py-3">
                      <OccurrenceDate value={occurrence.solvedAt} operator={occurrence.solver} />
                    </td>
                    <td className="px-3 py-3 text-emerald-600">
                      {occurrence.reviewedAt ? formatOccurrenceDate(occurrence.reviewedAt) : "-"}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-nowrap items-center justify-center gap-0.5 whitespace-nowrap">
                        {occurrence.kind === "ocorrencia" &&
                          occurrence.solvedAt &&
                          !occurrence.reviewedAt &&
                          (department === "admin" ||
                            normalizeOccurrenceText(occurrence.reporter) ===
                              normalizeOccurrenceText(currentUser.operator)) && (
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
                          <ScanEye className="h-4 w-4 text-sky-700" />
                        </Button>
                        {["admin", "development"].includes(department || "") &&
                          !occurrence.reviewedAt &&
                          !occurrence.approvedAt && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 cursor-pointer text-destructive hover:text-destructive"
                              title="Remover ocorrência"
                              onClick={() => setRemovingOccurrence(occurrence)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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
        <div className="border-t bg-muted/15 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              ["aviso", "AVISO", "bg-slate-600"],
              ["sugestao", "SUGESTÃO/SOLICITAÇÃO", "bg-amber-500"],
              ["aprovacao", "APROVAÇÃO", "bg-sky-600"],
              ["solucao", "SOLUÇÃO", "bg-emerald-600"],
              ["revisada", "REVISADA", "bg-green-600"],
              ["ocorrencia", "OCORRÊNCIA", "bg-rose-600"],
            ].map(([value, label, color]) => (
              <button
                type="button"
                key={String(value)}
                onClick={() => {
                  setKind(kind === value ? "todos" : String(value));
                  setPage(1);
                }}
                aria-pressed={kind === value}
                className={cn(
                  "inline-flex cursor-pointer items-center px-2 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  color,
                  kind === value && "ring-2 ring-ring ring-offset-2",
                )}
              >
                {label} ({kindCounts[String(value)] || 0})
              </button>
            ))}
          </div>
        </div>
      </section>
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
    </>
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
          <thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal">
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
                      <ScanEye className="h-4 w-4" />
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
    <div className="border-t [&>footer]:rounded-none [&>footer]:border-0 [&>footer]:shadow-none">
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
      <SelectTrigger className="w-full cursor-pointer text-sm font-normal text-muted-foreground">
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

function normalizeOccurrencePriority(value: string | undefined) {
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
function formatOccurrenceDay(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : parsed.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
}
function OccurrenceDate({
  value,
  operator,
  dateOnly = false,
}: {
  value: string | null | undefined;
  operator: string;
  dateOnly?: boolean;
}) {
  return (
    <span>
      {dateOnly ? formatOccurrenceDay(value) : formatOccurrenceDate(value)}
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
          {occurrence.id && occurrence.priority !== undefined && <OccurrencePriorityField occurrence={{id:occurrence.id,priority:occurrence.priority}} />}
          <span className="text-muted-foreground">{formatOccurrenceDay(occurrence.openedAt)}</span>
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
          <span>Registrada em {formatOccurrenceDay(occurrence.openedAt)}</span>
          {occurrence.solvedAt && (
            <span>Solucionada em {formatOccurrenceDate(occurrence.solvedAt)}</span>
          )}
          {occurrence.reviewedAt && (
            <span>Revisada em {formatOccurrenceDate(occurrence.reviewedAt)}</span>
          )}
          {occurrence.approvedAt && (
            <span className="font-medium text-cyan-700">
              Aprovada em {formatOccurrenceDate(occurrence.approvedAt)}
            </span>
          )}
          {occurrence.version && <span>Versão: {occurrence.version}</span>}
          {occurrence.baseAddress && <span>Base: {occurrence.baseAddress}</span>}
        </div>
      </div>
    </div>
  );
}

function createReleaseDetail(
  release: (typeof hadronReleases)[number] & { version?: string },
  option: ReturnType<typeof findReleaseOption>,
): ReleaseDetail {
  return {
    id: release.id,
    title: release.title,
    content: release.description,
    option: release.option || option?.option || release.id,
    form: release.form || option?.form || option?.option || release.id,
    owner: release.owner || option?.owner || "Não informado",
    version: getReleaseVersionLabel(release.version),
    date: release.createdAt,
    module: release.moduleId
      ? hadronModuleNames.get(release.moduleId) || `Módulo ${release.moduleId}`
      : option?.moduleId
        ? `Módulo ${option.moduleId}`
        : "Não informado",
    submodule: release.submoduleId
      ? hadronSubmoduleNames.get(`${release.moduleId}:${release.submoduleId}`) ||
        `Submódulo ${release.submoduleId}`
      : option?.submoduleId
        ? `Submódulo ${option.submoduleId}`
        : "Não informado",
    clicks: release.clicks,
    tags: release.tags || "",
  };
}

function ReleaseDetailView({ release }: { release: ReleaseDetail }) {
  return (
    <div className="grid gap-5 lg:min-h-[56vh] lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="h-full space-y-4 lg:border-r lg:pr-5">
        <ReleaseMeta label="Opção/Formulário" value={`${release.option}/${release.form}`} />
        <ReleaseMeta label="Data do release" value={formatVersionDate(release.date.split(/[T ]/)[0])} />
        <ReleaseMeta label="Versão Hádron" value={release.version} />
        <ReleaseMeta
          label="Módulo e submódulo"
          value={`${release.module} · ${release.submodule}`}
        />
        <ReleaseMeta label="Responsável" value={release.owner} />
        <ReleaseMeta label="Cliques" value={String(release.clicks)} />
        <ReleaseMeta label="Tags" value={release.tags || "Nenhuma tag"} />
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
  return (
    <div
      className="space-y-3 text-sm leading-6 text-foreground [&_a]:break-all [&_a]:text-primary [&_a]:underline [&_img]:my-4 [&_img]:max-h-[720px] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:bg-white [&_img]:object-contain [&_li]:ml-5 [&_ol]:list-decimal [&_p]:min-h-4 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: sanitizeLegacyHtml(value) }}
    />
  );
}

function normalizeLegacyUrl(value: string) {
  const url = value.trim();
  if (/^(data:|blob:)/i.test(url)) return url;
  try {
    const parsed = new URL(url, "https://crm.procion.com/");
    if (!/^https?:$/.test(parsed.protocol)) return "";
    if (parsed.hostname === "crm.procion.com") {
      parsed.protocol = "https:";
      parsed.pathname = parsed.pathname.replace(/^\/webroot\//, "/");
    }
    return parsed.href;
  } catch { return ""; }
}

function normalizeLegacyHtml(value: string) {
  return value.replace(/(<img\b[^>]*?\ssrc=["'])([^"']+)(["'])/gi, (_match, before, src, after) => {
    const normalized = normalizeLegacyUrl(src);
    return normalized ? `${before}${normalized}${after} referrerpolicy="no-referrer" decoding="async"` : `${before}${src}${after}`;
  });
}

function sanitizeLegacyHtml(value: string) {
  return normalizeLegacyHtml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/javascript:/gi, "");
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

function releaseTimestamp(value: string) {
  const parsed = new Date(value.replace(" ", "T")).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeLegacyOccurrenceTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : value;
}

function ParametersTable({ query, onOpen }: TableProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { items: parameters } = useCrmCatalog<ParameterDraft>("parameters");
  const [editing, setEditing] = useState<ParameterDraft | null>(null);
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
      parameters.filter((parameter) => {
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
    [dateFrom, dateTo, form, normalizedSearch, option, parameters],
  );

  const clearFilters = () => {
    setSearch("");
    setOption("");
    setForm("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <><section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="border-b p-4">
        <h2 className="text-lg font-medium">Parâmetros</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_.6fr_.6fr_1fr_auto_auto]">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="h-10 cursor-pointer border-0 bg-transparent px-3 shadow-none hover:bg-sky-100 dark:hover:bg-sky-500/15"
        >
          Limpar
        </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal">
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
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-500/15" title="Ir para a Base">
                      <Link to="/base-de-conhecimento" search={{search:parameter.title,from:"hadron-parameter"}}><Globe2 className="h-4 w-4 text-emerald-600" /></Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar parâmetro"
                      className="h-8 w-8 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-500/15"
                      onClick={() => setEditing({ ...parameter, legends: parameter.legends.map((item) => ({ ...item })) })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Excluir parâmetro"
                      className="h-8 w-8 cursor-pointer text-destructive hover:bg-rose-50 dark:hover:bg-rose-500/15"
                      onClick={() => setRemovingId(parameter.id)}
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
      </section>
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

      <AlertDialog open={Boolean(removingId)} onOpenChange={(open) => !open && setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir parâmetro?</AlertDialogTitle><AlertDialogDescription>Confirme a remoção deste registro da listagem.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={async () => { const item = parameters.find((row) => row.id === removingId); if (!item || !await trySaveCrmCatalog("parameters", [item], true)) return; setRemovingId(null); setPage(1); toast.success("Registro excluído no banco."); }}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-5xl">
          <DialogTitle className="sr-only">Editar parâmetro</DialogTitle>
          <DetailModalHeader icon={SlidersHorizontal} title="Editar parâmetro" onClose={() => setEditing(null)} />
          {editing && <div className="space-y-4 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Título</span><Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
              <label className="space-y-1 text-sm"><span>Descrição</span><Input value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
            </div>
            <div className="space-y-1 text-sm"><span>Mensagem</span><RichTextEditor key={editing.id} value={normalizeLegacyHtml(editing.message)} onChange={(message) => setEditing({ ...editing, message })} minHeight={256} /></div>
            {editing.legends.map((legend, index) => <div key={index} className="grid items-end gap-3 border-b pb-3 md:grid-cols-[5rem_1fr_auto]">
              <label className="space-y-1 text-sm"><span>Título</span><Input value={legend.title} onChange={(event) => setEditing({ ...editing, legends: editing.legends.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /></label>
              <label className="space-y-1 text-sm"><span>Legenda</span><textarea className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" value={legend.caption} onChange={(event) => setEditing({ ...editing, legends: editing.legends.map((item, i) => i === index ? { ...item, caption: event.target.value } : item) })} /></label>
              <Button variant="ghost" size="icon" title="Remover legenda" onClick={() => setEditing({ ...editing, legends: editing.legends.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4 text-primary" /></Button>
            </div>)}
            <Button variant="outline" size="icon" title="Adicionar legenda" onClick={() => setEditing({ ...editing, legends: [...editing.legends, { title: "", caption: "" }] })}><Plus className="h-4 w-4" /></Button>
          </div>}
          <DialogFooter className="border-t px-5 py-4"><Button onClick={async () => { if (!editing?.title.trim()) { toast.error("Informe o título."); return; } if (!await trySaveCrmCatalog("parameters", [{ ...editing, updatedAt: parameterDisplayDate(new Date().toISOString().replace("T", " ")) }])) return; setEditing(null); toast.success("Parâmetro salvo no banco."); }}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function parameterDateValue(value: string) {
  const [date, time] = value.split(" ");
  const [day, month, year] = date.split("/").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function ModulesTable({ query, onOpen }: TableProps) {
  const [catalog, setCatalog] = useState<HadronModule[]>(hadronModules);
  const [catalogReady, setCatalogReady] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  const [confirmModuleRemoval, setConfirmModuleRemoval] = useState(false);
  useEffect(() => {
    let active = true;
    loadHadronModules().then((modules) => { if (active) { setCatalog(modules); setCatalogReady(true); } }).catch(() => { if (active) toast.error("Não foi possível carregar os módulos do banco. Edição indisponível."); });
    return () => { active = false; };
  }, []);
  const [draft, setDraft] = useState<{ moduleId: string; id: string; name: string; kind: "module" | "submodule"; originalId?: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const normalizedQuery = normalizeOccurrenceText(`${query} ${search}`);
  const rows = useMemo(
    () =>
      catalog
        .map(({id, nome, submodules}) => ({
          id,
          module: nome,
          options: hadronOptions.filter((option) => option.moduleId === id && (!option.submoduleId || option.submoduleId === "0" || !submodules.some((sub) => sub.id === option.submoduleId))),
          submodules: submodules.map((submodule) => ({
            id: submodule.id,
            name: submodule.nome,
            options: hadronOptions
              .filter((option) => option.moduleId === id && option.submoduleId === submodule.id),
          })),
        }))
        .filter(
          (row) =>
            !normalizedQuery ||
            normalizeOccurrenceText(
              [
                row.id,
                row.module,
                ...row.options.map((option) => option.label),
                ...row.submodules.flatMap((submodule) => [
                  submodule.name,
                  ...submodule.options.map((option) => option.label),
                ]),
              ].join(" "),
            ).includes(normalizedQuery),
        ),
    [normalizedQuery, catalog],
  );

  useEffect(() => { setPage(1); }, [normalizedQuery]);

  return (
    <>
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
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal">
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
                  {row.options.map((option) => <button key={option.id} className="mt-2 block text-left text-xs hover:text-primary" onClick={() => onOpen({title: option.description, subtitle: `${option.option} | ${option.form}`, body: option.observation, meta: [`Operador: ${option.owner}`]})}>{option.option} | {option.form} · {option.owner} - {option.description}</button>)}
                  <div className="mt-3 space-y-3 border-l pl-5">
                    {row.submodules.map((submodule) => (
                      <div key={submodule.name}>
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          <button title="Editar submódulo" className="mr-2 text-primary hover:underline" onClick={() => setDraft({moduleId:row.id,id:submodule.id,name:submodule.name,kind:"submodule",originalId:submodule.id})}>{submodule.id}</button>
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
                      title="Editar módulo"
                      onClick={() => setDraft({moduleId:row.id,id:row.id,name:row.module,kind:"module"})}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Adicionar submódulo" onClick={() => setDraft({moduleId:row.id,id:"",name:"",kind:"submodule"})}><Plus className="h-4 w-4" /></Button>
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
    </section>
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
    <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open && !savingModule) setDraft(null); }}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <div className="border-b px-5 py-4"><DialogTitle>{draft?.kind === "module" ? "Editar módulo" : draft?.originalId ? "Editar submódulo" : "Novo submódulo"}</DialogTitle></div>
        {draft && <form onSubmit={async (event) => {
          event.preventDefault();
          if (!catalogReady || savingModule) return;
          if (!draft.name.trim() || !draft.id.trim()) { toast.error("Informe o ID e o nome."); return; }
          const parent = catalog.find((module) => module.id === draft.moduleId)!;
          if (draft.kind === "submodule" && (!/^\d+$/.test(draft.id) || parent.submodules.some((sub) => sub.id === draft.id && sub.id !== draft.originalId))) { toast.error("Informe um ID numérico único neste módulo."); return; }
          setSavingModule(true);
          try {
            if (draft.kind === "module") await saveHadronModule(draft.moduleId, draft.name.trim());
            else await saveHadronSubmodule({id:draft.id,id_modulo:draft.moduleId,nome:draft.name.trim()}, Boolean(draft.originalId));
            setCatalog(await loadHadronModules());
            setDraft(null); toast.success("Cadastro salvo no banco.");
          } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cadastro."); }
          finally { setSavingModule(false); }
        }}>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {draft.kind === "submodule" && <><label className="space-y-1 text-sm">Módulo<Input value={`${draft.moduleId} - ${catalog.find((module) => module.id === draft.moduleId)?.nome}`} readOnly /></label><label className="space-y-1 text-sm">ID<Input value={draft.id} readOnly={Boolean(draft.originalId)} onChange={(event) => setDraft({...draft,id:event.target.value})} /></label></>}
            <label className="space-y-1 text-sm sm:col-span-2">Nome<Input autoFocus value={draft.name} onChange={(event) => setDraft({...draft,name:event.target.value})} /></label>
          </div>
          <DialogFooter className="border-t px-5 py-4">{draft.kind === "module" && <Button type="button" variant="outline" className="mr-auto text-destructive" disabled={!catalogReady || savingModule} onClick={() => setConfirmModuleRemoval(true)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>}<Button type="submit" disabled={!catalogReady || savingModule}>{savingModule ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmModuleRemoval} onOpenChange={setConfirmModuleRemoval}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Excluir módulo?</AlertDialogTitle><AlertDialogDescription>O módulo {draft?.name} será retirado da listagem. Os submódulos e as opções vinculadas serão preservados no banco.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={savingModule}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={savingModule} onClick={async () => {
          if (!draft) return;
          setSavingModule(true);
          try { await removeHadronModule(draft.moduleId); setCatalog(await loadHadronModules()); setConfirmModuleRemoval(false); setDraft(null); toast.success("Módulo excluído."); }
          catch { toast.error("Não foi possível excluir o módulo."); }
          finally { setSavingModule(false); }
        }}>{savingModule ? "Excluindo..." : "Excluir"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function SerialsTable({ query }: TableProps) {
  type SerialRow = (typeof hadronSerials)[number];
  const { items } = useCrmCatalog<SerialRow>("serials");
  const [editingSerial, setEditingSerial] = useState<SerialRow | null>(null);
  const [removingSerial, setRemovingSerial] = useState<SerialRow | null>(null);
  const creatingSerial = editingSerial?.id.startsWith("novo-") || false;
  const saveSerial = async () => {
    if (!editingSerial) return;
    const draft = {...editingSerial,numero_serie:editingSerial.numero_serie.trim(),operador:editingSerial.operador.trim(),cliente:editingSerial.cliente.trim()};
    if (!draft.numero_serie || !draft.operador || !draft.cliente) {toast.error("Preencha o número de série, descrição e sigla.");return;}
    if (items.some(item => item.id !== draft.id && item.numero_serie === draft.numero_serie)) {toast.error("Este número de série já está cadastrado.");return;}
    const now = new Date().toISOString();
    if (!await trySaveCrmCatalog("serials", [creatingSerial ? {...draft,id:crypto.randomUUID(),created:now,modified:now} : {...draft,modified:now}])) return;
    setEditingSerial(null);
    clearFilters();
    setPage(1);
    toast.success(creatingSerial ? "Serial criado no banco." : "Serial atualizado no banco.");
  };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [serial, setSerial] = useState("");
  const [acronym, setAcronym] = useState("");
  const [operator, setOperator] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const rows = items.filter((item) => {
    const text = normalizeOccurrenceText(`${item.id} ${item.numero_serie} ${item.operador} ${item.cliente}`);
    const date = (item.created || item.modified || "").slice(0,10);
    return (!query || text.includes(normalizeOccurrenceText(query))) &&
      (!serial || item.numero_serie.includes(serial.trim())) &&
      (!acronym || normalizeOccurrenceText(item.cliente).includes(normalizeOccurrenceText(acronym))) &&
      (operator === "todos" || item.operador === operator) &&
      (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
  });
  useEffect(() => setPage(1), [query, serial, acronym, operator, dateFrom, dateTo]);
  const formatSerialDate = (value: string | null) => value ? `${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)} ${value.slice(11,16)}` : "—";
  const clearFilters = () => {
    setSerial("");
    setAcronym("");
    setOperator("todos");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <>
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="border-b p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium">Seriais</h2><Button className="h-10 cursor-pointer gap-2" onClick={() => setEditingSerial({id:`novo-${Date.now()}`,numero_serie:"",operador:"",cliente:"PRC",created:null,modified:null})}><Plus className="h-4 w-4" />Novo número de série</Button></div>
        <div className="mt-4 grid items-center gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_.6fr_.8fr_.8fr_auto]">
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
              ...Array.from(new Set(items.map((item) => item.operador))).sort().map((item) => [item,item] as [string,string]),
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-10 cursor-pointer bg-transparent px-3 hover:bg-sky-100 dark:hover:bg-sky-500/15"
        >
          Limpar
        </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal">
            <tr>
              <th className="w-20 px-4 py-3">ID</th>
              <th className="px-4 py-3">Número de série</th>
              <th className="w-64 px-4 py-3">Operador</th>
              <th className="w-40 px-4 py-3">Cliente</th>
              <th className="w-44 px-4 py-3">Datas</th>
              <th className="w-24 px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.slice((page-1)*pageSize,page*pageSize).map((item) => <tr key={item.id} className="hover:bg-muted/20"><td className="px-4 py-3 text-muted-foreground">{item.id}</td><td className="px-4 py-3 font-mono">{item.numero_serie}</td><td className="px-4 py-3">{item.operador}</td><td className="px-4 py-3">{item.cliente}</td><td className="px-4 py-3 whitespace-nowrap"><div>{formatSerialDate(item.created)}</div><div className="text-xs text-muted-foreground">Atualizado {formatSerialDate(item.modified)}</div></td><td className="px-4 py-3"><div className="flex justify-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" title="Editar serial" onClick={() => setEditingSerial({...item})}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-destructive" title="Excluir serial" onClick={() => setRemovingSerial(item)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}
            {rows.length === 0 && <tr>
              <td colSpan={6} className="px-4 py-16 text-center">
                <KeyRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum serial encontrado.</p>
              </td>
            </tr>}
          </tbody>
        </table>
      </div>
    </section>
      <TablePagination
        noun="seriais"
        page={page}
        pageCount={Math.max(1,Math.ceil(rows.length/pageSize))}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
      />
      <Dialog open={Boolean(editingSerial)} onOpenChange={(open) => !open && setEditingSerial(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">{creatingSerial ? "Novo número de série" : "Editar número de série"}</DialogTitle>
          <DetailModalHeader icon={creatingSerial ? Plus : Pencil} title={creatingSerial ? "Novo número de série" : "Editar número de série"} onClose={() => setEditingSerial(null)} />
          {editingSerial && <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <label className="space-y-1 text-sm sm:col-span-2"><span>Número de série</span><Input value={editingSerial.numero_serie} onChange={(e) => setEditingSerial({...editingSerial,numero_serie:e.target.value})} /></label>
            <label className="space-y-1 text-sm"><span>Descrição / operador</span><Input value={editingSerial.operador} onChange={(e) => setEditingSerial({...editingSerial,operador:e.target.value})} /></label>
            <label className="space-y-1 text-sm"><span>Sigla</span><Input value={editingSerial.cliente} onChange={(e) => setEditingSerial({...editingSerial,cliente:e.target.value.toUpperCase()})} /></label>
          </div>}
          <DialogFooter className="shrink-0 border-t px-5 py-4"><Button onClick={saveSerial}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(removingSerial)} onOpenChange={(open) => !open && setRemovingSerial(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir serial?</AlertDialogTitle><AlertDialogDescription>Remover o número de série {removingSerial?.numero_serie}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={async () => {if (!removingSerial || !await trySaveCrmCatalog("serials", [removingSerial], true)) return;setRemovingSerial(null);setPage(1);toast.success("Serial removido no banco.");}}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}

function ChecklistTable({ query, onOpen }: TableProps) {
  void onOpen;
  type CheckRow = [string, string, string, string, boolean, string, string];
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { items } = useCrmCatalog<CheckRow>("checklist");
  const [editing, setEditing] = useState<CheckRow[] | null>(null);
  const [characteristic, setCharacteristic] = useState("todos");
  const label = (value: string) =>
    HADRON_OPTION_CHARACTERISTICS.find(([key]) => key === value)?.[1] || value;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filter, setFilter] = useState("");
  const normalizedQuery = normalizeOccurrenceText(`${query} ${filter}`);
  const rows = useMemo(
    () =>
      items.filter(
        (item) =>
          (characteristic === "todos" || item[1] === characteristic) &&
          (!normalizedQuery ||
            normalizeOccurrenceText(`${item.join(" ")} ${label(item[1])}`).includes(
              normalizedQuery,
            )),
      ),
    [normalizedQuery, characteristic, items],
  );
  rows.sort((a, b) => (Number(b[0]) || 0) - (Number(a[0]) || 0));
  useEffect(() => setPage(1), [normalizedQuery, characteristic]);

  return (
    <>
      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4">
          <div>
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium">Checklist</h2><Button className="h-10 cursor-pointer gap-2" onClick={() => setEditing([[`novo-${Date.now()}`,characteristic === "todos" ? "geral" : characteristic,"","",false,new Date().toISOString(),new Date().toISOString()]])}><Plus className="h-4 w-4" />Criar checklist</Button></div>
          </div>
          <div className="grid w-full gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Descrição"
            />
            <OccurrenceSelect
              value={characteristic}
              onValueChange={setCharacteristic}
              items={HADRON_OPTION_CHARACTERISTICS}
            />
            <Button
              variant="outline"
              onClick={() => {
                setFilter("");
                setCharacteristic("todos");
              }}
              className="h-10 cursor-pointer border-0 bg-transparent px-3 shadow-none hover:bg-sky-100 dark:hover:bg-sky-500/15"
            >
              Limpar
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal">
              <tr>
                <th className="w-36 px-4 py-3">Característica</th>
                <th className="w-64 px-4 py-3">Título</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="w-20 px-4 py-3 text-center">Salvo</th>
                <th className="w-44 px-4 py-3">Datas</th>
                <th className="w-24 px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="[&_tr:nth-child(even)]:bg-sky-50/45 dark:[&_tr:nth-child(even)]:bg-sky-950/15">
              {rows
                .slice((page - 1) * pageSize, page * pageSize)
                .map(
                  (
                    [id, characteristic, title, description, saved, createdAt, updatedAt],
                    index,
                  ) => (
                    <tr
                      key={id}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/40",
                        index % 2 === 0 && "bg-muted/20",
                      )}
                    >
                      <td className="px-4 py-3">{label(characteristic)}</td>
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
                        <span>{formatCatalogDate(createdAt)}</span>
                        <br />
                        <span>{formatCatalogDate(updatedAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar checklist"
                            className="h-8 w-8"
                            onClick={() =>
                              setEditing([
                                [
                                  id,
                                  characteristic,
                                  title,
                                  description,
                                  saved,
                                  createdAt,
                                  updatedAt,
                                ],
                              ])
                            }
                          >
                            <FilePenLine className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir checklist"
                            className="h-8 w-8"
                            onClick={() => setRemovingId(id)}
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
        </section>
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

      <AlertDialog open={Boolean(removingId)} onOpenChange={(open) => !open && setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir checklist?</AlertDialogTitle><AlertDialogDescription>Confirme a remoção deste registro da listagem.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={async () => { const item = items.find((row) => row[0] === removingId); if (!item || !await trySaveCrmCatalog("checklist", [item], true)) return; setRemovingId(null); setPage(1); toast.success("Registro excluído no banco."); }}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-5xl [&>div:last-child]:shrink-0">
          <DialogTitle className="sr-only">{editing?.[0]?.[0].startsWith("novo-") ? "Criar checklist" : "Alterar checklist"}</DialogTitle>
          <DetailModalHeader
            icon={ClipboardCheck}
            title={editing?.[0]?.[0].startsWith("novo-") ? "Criar checklist" : "Alterar checklist"}
            meta="Defina os nomes, descrições e a característica aplicada às opções"
            onClose={() => setEditing(null)}
          />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <label className="block max-w-sm space-y-1 text-sm"><span>Característica</span><OccurrenceSelect value={editing?.[0]?.[1] || "geral"} onValueChange={(value) => setEditing((rows) => rows?.map((row) => { const next: CheckRow = [...row]; next[1] = value; return next; }) || null)} items={HADRON_OPTION_CHARACTERISTICS.filter(([key]) => key !== "todos")} /></label>
            <div className="flex items-center justify-between border-b pb-2"><h3 className="text-sm font-medium">Itens do checklist</h3><span className="text-xs text-muted-foreground">{editing?.length || 0} item(ns)</span></div>
            {editing?.map((row, index) => (
              <div
                key={row[0]}
                className="grid items-end gap-3 rounded-md border bg-muted/15 p-4 md:grid-cols-[1fr_1.4fr_auto_auto]"
              >
                <label className="space-y-1 text-sm">
                  <span>Nome do checklist</span>
                  <Input
                    value={row[2]}
                    onChange={(event) =>
                      setEditing(
                        (rows) =>
                          rows?.map((item, i) =>
                            i === index
                              ? ([
                                  ...item.slice(0, 2),
                                  event.target.value,
                                  ...item.slice(3),
                                ] as CheckRow)
                              : item,
                          ) || null,
                      )
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Descrição</span>
                  <textarea
                    className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                    value={row[3]}
                    onChange={(event) =>
                      setEditing(
                        (rows) =>
                          rows?.map((item, i) => {
                            const next: CheckRow = [...item];
                            if (i === index) next[3] = event.target.value;
                            return next;
                          }) || null,
                      )
                    }
                  />
                </label>
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row[4]}
                    onChange={(event) =>
                      setEditing(
                        (rows) =>
                          rows?.map((item, i) => {
                            const next: CheckRow = [...item];
                            if (i === index) next[4] = event.target.checked;
                            return next;
                          }) || null,
                      )
                    }
                  />
                  Manter salvo
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remover linha"
                  onClick={() =>
                    setEditing((rows) =>
                      rows && rows.length > 1 ? rows.filter((_, i) => i !== index) : rows,
                    )
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="gap-2"
              title="Adicionar outro item"
              onClick={() =>
                setEditing((rows) => [
                  ...(rows || []),
                  [
                    `novo-${Date.now()}`,
                    rows?.[0]?.[1] || "geral",
                    "",
                    "",
                    false,
                    new Date().toISOString(),
                    new Date().toISOString(),
                  ],
                ])
              }
            >
              <Plus className="h-4 w-4" />Adicionar item
            </Button>
          </div>
          <DialogFooter className="border-t px-5 py-4">
            <Button
              onClick={async () => {
                if (!editing || editing.some((row) => !row[2].trim())) {
                  toast.error("Informe o título de todos os itens.");
                  return;
                }
                if (!await trySaveCrmCatalog("checklist", editing.map(
                    (row): CheckRow => [...row.slice(0, 6), new Date().toISOString()] as CheckRow,
                  ))) return;
                setEditing(null);
                toast.success("Checklist salvo no banco.");
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReleasesTable({ query, onOpen }: TableProps) {
  const { items: hadronOptions } = useCrmCatalog<HadronOption>("options");
  const { items: versions } = useCrmCatalog<CatalogVersion>("versions");
  const erpVersions = useMemo(() => [...versions].sort((a,b) => b.data_versao.localeCompare(a.data_versao)), [versions]);
  const latestFilledVersion = erpVersions.find((version) => version.versao?.trim() && version.data_versao?.trim());
  const hadronOptionsById = useMemo(() => new Map(hadronOptions.map((item) => [item.id,item])), [hadronOptions]);
  const releaseOptionSelectItems = useMemo(() => [...new Map(hadronOptions.map((option) => [option.option, [option.option, `${option.option}/${option.form || option.option} - ${option.description}`] as [string,string]])).values()], [hadronOptions]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [optionQuery, setOptionQuery] = useState("");
  const [releaseType, setReleaseType] = useState("todos");
  const [operator, setOperator] = useState("todos");
  const [dateType, setDateType] = useState("release");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { items: customReleases } = useCrmCatalog<(typeof hadronReleases)[number]>("releases");
  const [editingRelease, setEditingRelease] = useState<(ReleaseOverride & { id: string }) | null>(
    null,
  );
  const [removingRelease, setRemovingRelease] = useState<{ id: string; title: string } | null>(
    null,
  );
  useEffect(() => {
    if (!latestFilledVersion) return;
    setEditingRelease((current) => current && (!current.version || current.version === "nao-informada")
      ? { ...current, version: latestFilledVersion.data_versao }
      : current);
  }, [latestFilledVersion?.data_versao]);
  const normalizedQuery = normalizeOccurrenceText(query);
  const normalizedOptionQuery = normalizeOccurrenceText(optionQuery);
  const operators = useMemo(
    () => [...new Set(customReleases.map((release) => release.owner).filter(Boolean))].sort(),
    [customReleases],
  );
  const rows = useMemo(
    () =>
      customReleases
        .map((release) => ({
          release,
          option: hadronOptionsById.get(release.optionId) || findReleaseOption(release.title),
          type: release.releaseType,
        }))
        .filter(({ release, option, type }) => {
          const optionText = normalizeOccurrenceText(
            `${option?.option || ""} ${option?.form || ""} ${release.title}`,
          );
          const searchableText = normalizeOccurrenceText(
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
          );
          const selectedDate = dateType === "versao" ? release.version : release.createdAt;
          const dateValue = selectedDate ? new Date(selectedDate.length === 10 ? `${selectedDate}T00:00:00` : selectedDate.replace(" ", "T")).getTime() : 0;
          if (normalizedQuery && !searchableText.includes(normalizedQuery)) return false;
          if (normalizedOptionQuery && !optionText.includes(normalizedOptionQuery)) return false;
          if (releaseType !== "todos" && type !== releaseType) return false;
          if (operator !== "todos" && release.owner !== operator) return false;
          if ((dateFrom || dateTo) && (!dateValue || Number.isNaN(dateValue))) return false;
          if (dateFrom && dateValue < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
          if (dateTo && dateValue >= new Date(`${dateTo}T00:00:00`).setDate(new Date(`${dateTo}T00:00:00`).getDate() + 1)) return false;
          return true;
        })
        .sort(
          (a, b) =>
            releaseTimestamp(b.release.createdAt || b.release.updatedAt) -
            releaseTimestamp(a.release.createdAt || a.release.updatedAt),
        ),
    [
      dateFrom,
      dateTo,
      customReleases,
      hadronOptionsById,
      dateType,
      normalizedOptionQuery,
      normalizedQuery,
      operator,
      releaseType,
    ],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const clearFilters = () => {
    setOptionQuery("");
    setReleaseType("todos");
    setOperator("todos");
    setDateType("release");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <>
      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-medium">Releases</h2>
            <Button className="ml-auto h-10 cursor-pointer gap-2" onClick={() => setEditingRelease({id:`novo-${Date.now()}`,title:"",owner:operators[0] || "",moduleId:"1",submoduleId:"",description:"",tags:"",createdAt:new Date().toISOString().slice(0,10),version:latestFilledVersion?.data_versao || "",releaseType:"novidade",permission:"clientes",option:""})}><Plus className="h-4 w-4" />Criar release</Button>
            <span className="text-xs text-muted-foreground">
              {rows.length.toLocaleString("pt-BR")} registros
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[1.2fr_.85fr_.85fr_.8fr_1.35fr_auto]">
            <Input
              value={optionQuery}
              onChange={(event) => {
                setOptionQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Opção ou formulário"
            />
            <OccurrenceSelect
              value={releaseType}
              onValueChange={(value) => {
                setReleaseType(value);
                setPage(1);
              }}
              items={[
                ["todos", "Tipo de release"],
                ["correcao", "Correção"],
                ["alteracao", "Alteração"],
                ["novidade", "Novidade"],
                ["outro", "Não classificado"],
              ]}
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
              value={dateType}
              onValueChange={(value) => {
                setDateType(value);
                setPage(1);
              }}
              items={[
                ["release", "Tipo de data"],
                ["versao", "Data da atualização"],
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
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Limpar
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-[11px] xl:text-xs">
            <thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal">
              <tr>
                <th className="w-14 px-4 py-3">Tipo</th>
                <th className="w-40 px-4 py-3">Opção/Formulário</th>
                <th className="min-w-[360px] px-4 py-3">Descrição</th>
                <th className="w-44 px-4 py-3">Módulo/Submódulo</th>
                <th className="w-32 px-4 py-3">Responsável</th>
                <th className="w-20 px-4 py-3 text-center">Cliques</th>
                <th className="w-24 px-4 py-3">Versão</th>
                <th className="w-48 px-4 py-3">Data</th>
                <th className="w-24 px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedRows.map(({ release, option, type }) => (
                <tr key={release.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Sparkles
                      className={cn(
                        "h-4 w-4",
                        type === "correcao"
                          ? "text-rose-500"
                          : type === "alteracao"
                            ? "text-sky-600"
                            : type === "novidade"
                              ? "text-amber-500"
                              : "text-muted-foreground",
                      )}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {release.option || option?.option || "Não informado"}/
                    {release.form || option?.form || release.option || "Não informado"}
                  </td>
                  <td className="px-4 py-3 font-medium text-primary">{release.title}</td>
                  <td className="px-4 py-3">
                    {release.moduleId
                      ? hadronModuleNames.get(release.moduleId) || `Módulo ${release.moduleId}`
                      : "Não informado"}
                    {release.submoduleId && (
                      <>
                        <br />
                        <span className="text-xs">
                          {hadronSubmoduleNames.get(`${release.moduleId}:${release.submoduleId}`) ||
                            `Submódulo ${release.submoduleId}`}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">{release.owner || "Não informado"}</td>
                  <td className="px-4 py-3 text-center">{release.clicks}</td>
                  <td className="px-4 py-3">{getReleaseVersionLabel(release.version)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="block">{formatCatalogDate(release.createdAt)}</span>
                    <span className="block text-xs">
                      Atualizado {formatCatalogDate(release.updatedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="mx-auto grid w-fit grid-cols-2 gap-0.5">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        title="Abrir release na Base de Conhecimento"
                      >
                        <Link
                          to="/base-de-conhecimento/"
                          search={{
                            release: release.id,
                            search: release.title,
                            from: "hadron-release",
                          }}
                        >
                          <Globe2 className="h-4 w-4 text-sky-700" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar release"
                        onClick={() =>
                          setEditingRelease({
                            id: release.id,
                            title: release.title,
                            owner: release.owner,
                            moduleId: release.moduleId,
                            submoduleId: release.submoduleId,
                            description: release.description,
                            tags: release.tags,
                            createdAt: release.createdAt,
                            version: release.version && release.version !== "nao-informada" ? release.version : latestFilledVersion?.data_versao || "",
                            releaseType: type,
                            permission: release.permission,
                            option: release.option || option?.option || release.id,
                          })
                        }
                      >
                        <FilePenLine className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remover release"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRemovingRelease({ id: release.id, title: release.title })}
                      >
                        <Trash2 className="h-4 w-4" />
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
                          <ScanEye className="h-4 w-4 text-sky-700" />
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
      </section>
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
      <Dialog
        open={Boolean(editingRelease)}
        onOpenChange={(open) => !open && setEditingRelease(null)}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden [&>div:last-child]:shrink-0 [&>div:last-child]:pb-6">
          <DialogTitle className="sr-only">Editar release</DialogTitle>
          <DetailModalHeader
            icon={Rocket}
            title={editingRelease?.id.startsWith("novo-") ? "Criar release" : "Editar release"}
            protocol={editingRelease ? `Release ${editingRelease.id}` : undefined}
            meta={editingRelease?.title}
            onClose={() => setEditingRelease(null)}
            accentClassName="bg-amber-500"
            iconWrapClassName="bg-amber-500 text-white"
          />
          {editingRelease && (
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-6">
              <label className="space-y-1 text-sm md:col-span-2">
                <span>Data Release</span>
                <Input
                  type="datetime-local"
                  value={editingRelease.createdAt.replace(" ", "T").slice(0, 16)}
                  onChange={(event) =>
                    setEditingRelease({
                      ...editingRelease,
                      createdAt: event.target.value.replace("T", " "),
                    })
                  }
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-4">
                <span>Versão Hádron</span>
                <OccurrenceSelect
                  value={editingRelease.version}
                  onValueChange={(version) => setEditingRelease({ ...editingRelease, version })}
                  items={[
                    ...erpVersions.map(
                      (version) =>
                        [
                          version.data_versao,
                          `${version.versao} - ${formatVersionDate(version.data_versao)}`,
                        ] as [string, string],
                    ),
                  ]}
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span>Tipo Release</span>
                <OccurrenceSelect
                  value={editingRelease.releaseType}
                  onValueChange={(releaseType) =>
                    setEditingRelease({ ...editingRelease, releaseType })
                  }
                  items={[
                    ["correcao", "Correção"],
                    ["alteracao", "Alteração"],
                    ["novidade", "Novidade"],
                    ["outro", "Não classificado"],
                  ]}
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span>Permissão</span>
                <OccurrenceSelect
                  value={editingRelease.permission}
                  onValueChange={(permission) =>
                    setEditingRelease({ ...editingRelease, permission })
                  }
                  items={[
                    ["publico", "Público"],
                    ["clientes", "Clientes"],
                    ["empresa", "Empresa"],
                  ]}
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span>Opção</span>
                <OccurrenceSelect
                  value={editingRelease.option}
                  onValueChange={(option) =>
                    setEditingRelease({ ...editingRelease, option })
                  }
                  items={releaseOptionSelectItems}
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-3">
                <span>Módulo</span>
                <OccurrenceSelect
                  value={editingRelease.moduleId}
                  onValueChange={(moduleId) =>
                    setEditingRelease({ ...editingRelease, moduleId, submoduleId: "" })
                  }
                  items={releaseModuleSelectItems}
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-3">
                <span>Submódulo</span>
                <OccurrenceSelect
                  value={editingRelease.submoduleId}
                  onValueChange={(submoduleId) =>
                    setEditingRelease({ ...editingRelease, submoduleId })
                  }
                  items={releaseSubmoduleSelectItems(editingRelease.moduleId)}
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-6">
                <span>Descrição</span>
                <Input
                  value={editingRelease.title}
                  onChange={(event) =>
                    setEditingRelease({ ...editingRelease, title: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-6">
                <span>Detalhes do release</span>
                <RichTextEditor
                  key={editingRelease.id}
                  value={normalizeLegacyHtml(editingRelease.description)}
                  onChange={(description) =>
                    setEditingRelease({
                      ...editingRelease,
                      description,
                    })
                  }
                  minHeight={256}
                />
              </label>
              <div className="space-y-1 text-sm md:col-span-6">
                <span>Tags</span>
                <TagInput value={editingRelease.tags} onChange={(tags) => setEditingRelease({ ...editingRelease, tags })} suggestions={customReleases.flatMap((item) => item.tags.split(/[,;]+/))} />
              </div>
            </div>
          )}
          <DialogFooter className="border-t px-5 py-4">
            <Button
              onClick={async () => {
                if (!editingRelease) return;
                if (!editingRelease.title.trim() || !editingRelease.description.trim() || !editingRelease.createdAt) {toast.error("Informe a data, descrição e detalhes do release.");return;}
                const { id, ...changes } = editingRelease;
                if (id.startsWith("novo-")) {
                  const option = hadronOptions.find((item) => item.option === changes.option || item.id === changes.option);
                  if (!option) {toast.error("Selecione uma opção válida.");return;}
                  const created = {...changes,id:crypto.randomUUID(),optionId:option.id,option:option.option,form:option.form,tester:option.tester,status:"",exclusive:false,clicks:0,updatedAt:new Date().toISOString()};
                  if (!await trySaveCrmCatalog("releases", [created])) return;
                  setEditingRelease(null);toast.success("Release criado no banco.");return;
                }
                const previous = customReleases.find((release) => release.id === id);
                if (!previous || !await trySaveCrmCatalog("releases", [{ ...previous, ...changes, id, updatedAt: new Date().toISOString() }])) return;
                setEditingRelease(null);
                toast.success("Release atualizado com sucesso.");
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(removingRelease)}
        onOpenChange={(open) => !open && setRemovingRelease(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover release?</AlertDialogTitle>
            <AlertDialogDescription>
              O release “{removingRelease?.title}” será removido da listagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!removingRelease) return;
                const previous = customReleases.find((release) => release.id === removingRelease.id);
                if (!previous || !await trySaveCrmCatalog("releases", [previous], true)) return;
                setRemovingRelease(null);
                toast.success("Release removido com sucesso.");
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type ReleaseOverride = {
  title: string;
  owner: string;
  moduleId: string;
  submoduleId: string;
  description: string;
  tags: string;
  createdAt: string;
  version: string;
  releaseType: string;
  permission: string;
  option: string;
};

function getReleaseVersionLabel(version: string | undefined) {
  const matched = version && erpVersions.find((item) => item.data_versao === version);
  if (matched) return `${matched.versao} - ${formatVersionDate(matched.data_versao)}`;
  if (version && version !== "nao-informada") return version;
  return "Não informada";
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
  void onOpen;
  type VersionRow = (typeof erpVersions)[number];
  type DateField = Exclude<keyof VersionRow, "id" | "versao">;
  const dateFields: [DateField,string][] = [["data_versao","Data da versão"],["data_runtime","Runtime"],["data_arq","Arquivos"],["data_arq_bas","Arq. Base"],["data_alterar","Alterar"]];
  const { items } = useCrmCatalog<VersionRow>("versions");
  const [draft,setDraft] = useState<VersionRow | null>(null);
  const [removing,setRemoving] = useState<VersionRow | null>(null);
  const [versionQuery,setVersionQuery] = useState("");
  const dateField: DateField = "data_versao";
  const [dateFrom,setDateFrom] = useState("");
  const [dateTo,setDateTo] = useState("");
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(25);
  const creating = Boolean(draft?.id.startsWith("novo-"));
  const rows = items.filter(version => {
    const global = normalizeOccurrenceText(query);
    const term = normalizeOccurrenceText(versionQuery);
    const date = version[dateField]?.slice(0,10);
    return (!global || normalizeOccurrenceText(Object.values(version).join(" ")).includes(global)) &&
      (!term || normalizeOccurrenceText(version.versao).includes(term)) &&
      (!dateFrom || Boolean(date && date >= dateFrom)) && (!dateTo || Boolean(date && date <= dateTo));
  }).sort((a,b) => b.data_versao.localeCompare(a.data_versao) || b.id.localeCompare(a.id));
  useEffect(() => setPage(1),[query,versionQuery,dateField,dateFrom,dateTo]);
  const clearFilters = () => {setVersionQuery("");setDateFrom("");setDateTo("");setPage(1);};
  const pageCount = Math.max(1,Math.ceil(rows.length/pageSize));
  const currentPage = Math.min(page,pageCount);
  const save = async () => {
    if(!draft)return;
    if(!draft.versao.trim() || dateFields.some(([field]) => !/^\d{4}-\d{2}-\d{2}$/.test(draft[field]))) {toast.error("Preencha a versão e todas as datas.");return;}
    if(items.some(item => item.id !== draft.id && item.versao.trim() === draft.versao.trim() && item.data_versao === draft.data_versao)){toast.error("Esta versão já está cadastrada para a data informada.");return;}
    const saved = {...draft,versao:draft.versao.trim(),id:creating ? crypto.randomUUID() : draft.id};
    if (!await trySaveCrmCatalog("versions", [saved])) return;
    setDraft(null);clearFilters();toast.success(creating ? "Versão criada no banco." : "Versão atualizada no banco.");
  };
  return <>
    <section className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="border-b p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium">Versões do ERP</h2><Button className="h-10 cursor-pointer gap-2" onClick={() => {const today=new Date().toISOString().slice(0,10);setDraft({id:`novo-${Date.now()}`,versao:"",data_versao:today,data_runtime:today,data_arq:today,data_arq_bas:today,data_alterar:today});}}><Plus className="h-4 w-4" />Criar versão</Button></div>
        <div className="mt-4 grid items-center gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.5fr_auto]"><Input placeholder="Versão" value={versionQuery} onChange={e => setVersionQuery(e.target.value)} /><DateRangeFilter from={dateFrom} to={dateTo} onChange={(from,to) => {setDateFrom(from);setDateTo(to);}} /><Button variant="ghost" className="h-10 cursor-pointer bg-transparent px-3 hover:bg-sky-100 dark:hover:bg-sky-500/15" onClick={clearFilters}>Limpar</Button></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal"><tr><th className="px-4 py-3">Versão</th>{dateFields.map(([field,label]) => <th key={field} className="px-4 py-3">{label}</th>)}<th className="w-24 px-4 py-3 text-center">Ações</th></tr></thead><tbody className="divide-y">{rows.slice((currentPage-1)*pageSize,currentPage*pageSize).map(version => <tr key={version.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-medium">{version.versao}</td>{dateFields.map(([field]) => <td key={field} className="px-4 py-3">{formatVersionDate(version[field])}</td>)}<td className="px-4 py-3"><div className="flex justify-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" title="Editar versão" onClick={() => setDraft({...version})}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-destructive" title="Excluir versão" onClick={() => setRemoving(version)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhuma versão encontrada.</td></tr>}</tbody></table></div>
    </section>
    <TablePagination noun="versões" page={currentPage} pageCount={pageCount} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={value => {setPageSize(value);setPage(1);}} />
    <Dialog open={Boolean(draft)} onOpenChange={open => !open && setDraft(null)}><DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden"><DialogTitle className="sr-only">{creating ? "Criar versão" : "Editar versão"}</DialogTitle><DetailModalHeader icon={creating ? Plus : Pencil} title={creating ? "Criar versão" : "Editar versão"} onClose={() => setDraft(null)} />{draft && <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2 lg:grid-cols-6"><label className="space-y-1 text-sm"><span>Versão</span><Input value={draft.versao} onChange={e => setDraft({...draft,versao:e.target.value})} /></label>{dateFields.map(([field,label]) => <label key={field} className="min-w-0 space-y-1 text-sm"><span>{label}</span><Input type="date" value={draft[field]} onChange={e => setDraft({...draft,[field]:e.target.value})} /></label>)}</div>}<DialogFooter className="shrink-0 border-t px-5 py-4"><Button onClick={save}>Salvar</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={Boolean(removing)} onOpenChange={open => !open && setRemoving(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir versão?</AlertDialogTitle><AlertDialogDescription>Remover a versão {removing?.versao} de {formatVersionDate(removing?.data_versao || "")}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={async () => {if (!removing || !await trySaveCrmCatalog("versions", [removing], true)) return;setRemoving(null);setPage(1);toast.success("Versão removida no banco.");}}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

function ArticlesTable({ query, onOpen }: TableProps) {
  void onOpen;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("todos");
  const [operator, setOperator] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { items: articleRecords, loaded: articlesLoaded } = useCrmCatalog<CatalogArticle>("articles");
  const [viewingArticle, setViewingArticle] = useState<ArticleDraft | null>(null);
  const [editingArticle, setEditingArticle] = useState<ArticleDraft | null>(null);
  const [removingArticle, setRemovingArticle] = useState<ArticleDraft | null>(null);
  const normalizedQuery = normalizeOccurrenceText(query.trim());
  const normalizedTitle = normalizeOccurrenceText(title.trim());
  const categories = useMemo(
    () => [...new Set(articleRecords.map((article) => article.category).filter(Boolean))].sort(),
    [articleRecords],
  );
  const operators = useMemo(
    () => [...new Set(articleRecords.map((article) => article.owner).filter(Boolean))].sort(),
    [articleRecords],
  );
  const rows = useMemo(
    () =>
      articleRecords
        .map((article) => articleDraft(article))
        .filter((article) => {
          const haystack = normalizeOccurrenceText(
            `${article.id} ${article.title} ${article.owner} ${article.category} ${article.tags}`,
          );
          const date = releaseTimestamp(article.updatedAt || article.createdAt);
          if (normalizedQuery && !haystack.includes(normalizedQuery)) return false;
          if (normalizedTitle && !normalizeOccurrenceText(article.title).includes(normalizedTitle)) return false;
          if (category !== "todos" && article.category !== category) return false;
          if (operator !== "todos" && article.owner !== operator) return false;
          if (status !== "todos" && article.status !== status) return false;
          if ((dateFrom || dateTo) && !date) return false;
          if (dateFrom && date < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
          if (dateTo && date >= new Date(`${dateTo}T00:00:00`).setDate(new Date(`${dateTo}T00:00:00`).getDate() + 1)) return false;
          return true;
        })
        .sort((a, b) => releaseTimestamp(b.updatedAt) - releaseTimestamp(a.updatedAt)),
    [articleRecords, category, dateFrom, dateTo, normalizedQuery, normalizedTitle, operator, status],
  );
  const articleStatusCounts = useMemo(
    () => ({
      unpublished: rows.filter((article) => article.status === "0").length,
      published: rows.filter((article) => article.status === "1").length,
      analysis: rows.filter((article) => article.status === "2").length,
    }),
    [rows],
  );

  const clearFilters = () => {
    setTitle("");
    setCategory("todos");
    setOperator("todos");
    setStatus("todos");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <>
      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-medium">Artigos</h2>
              <span className="text-xs text-muted-foreground">{articlesLoaded ? `${rows.length} registros` : "Carregando..."}</span>
            </div>
            <Button className="h-10 cursor-pointer gap-2" onClick={() => { const now = new Date().toISOString(); setEditingArticle({id:`novo-${Date.now()}`,title:"",status:"0",description:"",category:"guia",owner:currentUser.operator || operators[0] || "",clicks:0,tags:"",permission:"1",emailCopy:"",relatedArticleIds:"",relatedReleaseIds:"",moduleId:"1",submoduleId:"none",createdAt:now,updatedAt:now}); }}><Plus className="h-4 w-4" />Criar artigo</Button>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr_1.35fr_auto]">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" />
            <OccurrenceSelect value={category} onValueChange={setCategory} items={[["todos", "Categoria"], ...categories.map((item) => [item, articleCategoryLabel(item)] as [string, string])]} />
            <OccurrenceSelect value={operator} onValueChange={setOperator} items={[["todos", "Operador"], ...operators.map((item) => [item, item] as [string, string])]} />
            <OccurrenceSelect value={status} onValueChange={setStatus} items={[["todos", "Status"], ["0", "Não publicado"], ["1", "Publicado"], ["2", "Em análise"]]} />
            <DateRangeFilter from={dateFrom} to={dateTo} onChange={(from, to) => { setDateFrom(from); setDateTo(to); }} />
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-xs">
          <thead className="border-b bg-muted/25 text-left font-normal text-primary [&_th]:font-normal">
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
              const published = article.status === "1";
              const baseArticle = findBaseArticle(article.id);
              const PermissionIcon =
                article.permission === "2"
                  ? Building2
                  : article.permission === "1"
                    ? UsersRound
                    : Globe2;
              const permissionLabel =
                article.permission === "2"
                  ? "Empresa"
                  : article.permission === "1"
                    ? "Clientes"
                    : "Público";
              return (
                <tr
                  key={article.id}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/35",
                    index % 2 === 1 && "bg-muted/20",
                  )}
                >
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <PermissionIcon className="h-4 w-4" aria-label={permissionLabel} />
                  </td>
                  <td className="max-w-[420px] px-3 py-2.5 font-medium">
                    <span className="mr-1 text-muted-foreground">{article.id} -</span>
                    {article.title}
                  </td>
                  <td className="px-3 py-2.5">{articleCategoryLabel(article.category)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{article.owner}</td>
                  <td className="px-3 py-2.5">
                    <span className="block">{hadronModuleNames.get(article.moduleId) || `Módulo ${article.moduleId}`}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {hadronSubmoduleNames.get(`${article.moduleId}:${article.submoduleId}`) || `Submódulo ${article.submoduleId}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge className={cn("whitespace-nowrap", article.status === "2" ? "bg-amber-500 text-white hover:bg-amber-500" : article.status === "0" ? "bg-rose-600 text-white hover:bg-rose-600" : undefined)} variant={published ? "default" : "secondary"}>
                      {articleStatusLabel(article.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{article.clicks}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-primary">
                    <span className="block">Criado {formatHadronArticleDate(article.createdAt)}</span>
                    <span className="block text-[10px] text-muted-foreground">Alterado {formatHadronArticleDate(article.updatedAt)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-0.5">
                      {baseArticle && (
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Abrir artigo na Base de Conhecimento">
                          <Link
                            to="/base-de-conhecimento/$slug"
                            params={{ slug: baseArticle.slug }}
                            search={{ from: "hadron-article" }}
                          >
                            <Globe2 className="h-4 w-4 text-sky-700" />
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Visualizar artigo"
                        onClick={() => setViewingArticle(article)}
                      >
                        <ScanEye className="h-4 w-4 text-sky-700" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar artigo" onClick={() => setEditingArticle(article)}>
                        <FilePenLine className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Remover artigo"
                        onClick={() => setRemovingArticle(article)}
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
        <footer className="flex flex-wrap items-center gap-6 border-t bg-muted/15 px-4 py-3 text-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">Status dos artigos</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Não publicados <strong>{articleStatusCounts.unpublished}</strong></span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Publicados <strong>{articleStatusCounts.published}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Em análise <strong>{articleStatusCounts.analysis}</strong>
          </span>
        </footer>
      </section>
      <ArticleViewDialog article={viewingArticle} onClose={() => setViewingArticle(null)} />
      <ArticleEditDialog
        article={editingArticle}
        onClose={() => setEditingArticle(null)}
        onSave={async (article) => {
          const creating = Boolean(editingArticle?.id.startsWith("novo-"));
          if (!await trySaveCrmCatalog("articles", [article])) return;
          setEditingArticle(null);
          toast.success(creating ? "Artigo criado com sucesso." : "Artigo atualizado com sucesso.");
        }}
      />
      <AlertDialog open={Boolean(removingArticle)} onOpenChange={(open) => !open && setRemovingArticle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remover artigo?</AlertDialogTitle><AlertDialogDescription>O artigo “{removingArticle?.title}” será removido da listagem.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => { if (!removingArticle || !await trySaveCrmCatalog("articles", [removingArticle], true)) return; setRemovingArticle(null); toast.success("Artigo removido no banco."); }}>Remover</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type ArticleDraft = {
  id: string;
  title: string;
  status: string;
  description: string;
  category: string;
  owner: string;
  clicks: number;
  tags: string;
  permission: string;
  emailCopy: string;
  relatedArticleIds: string;
  relatedReleaseIds: string;
  moduleId: string;
  submoduleId: string;
  createdAt: string;
  updatedAt: string;
};

function articleDraft(
  article: (typeof cvsArticles)[number],
  override?: ArticleDraft,
): ArticleDraft {
  return override || {
    ...article,
    permission: article.permission,
    emailCopy: "",
    relatedArticleIds: "",
  };
}

function findBaseArticle(id: string) {
  return kbArticlesFull.find((article) => article.id === `AP-${id}`);
}

function articleCategoryLabel(value: string) {
  return ({
    guia: "Guia",
    manual: "Manual",
    erros: "Erros e Correções",
    legislacao: "Legislação",
    comunicacao: "Comunicação",
    novidades: "Novidades",
    atualizacoes: "Atualizações",
  } as Record<string, string>)[value] || value;
}

function articleStatusLabel(value: string) {
  return ({ "0": "Não publicado", "1": "Publicado", "2": "Em análise" } as Record<string, string>)[value] || "Em análise";
}

function ArticleViewDialog({ article, onClose }: { article: ArticleDraft | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(article)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Visualizar artigo</DialogTitle>
        <DetailModalHeader icon={BookOpenText} title={article?.title || "Artigo"} protocol={article ? `Artigo ${article.id}` : undefined} meta={article ? `${articleCategoryLabel(article.category)} · ${article.owner}` : undefined} onClose={onClose} accentClassName="bg-sky-600" iconWrapClassName="bg-sky-600 text-white" />
        {article && (
          <div className="grid min-h-0 flex-1 overflow-y-auto px-5 py-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-5">
            <aside className="space-y-4 border-b pb-4 lg:min-h-[58vh] lg:border-b-0 lg:border-r lg:pr-5">
              <ReleaseMeta label="Categoria" value={articleCategoryLabel(article.category)} />
              <ReleaseMeta label="Permissão" value={article.permission === "1" ? "Clientes" : article.permission === "2" ? "Empresa" : "Público"} />
              <ReleaseMeta label="Status" value={articleStatusLabel(article.status)} />
              <ReleaseMeta label="Módulo e submódulo" value={`${hadronModuleNames.get(article.moduleId) || article.moduleId} · ${hadronSubmoduleNames.get(`${article.moduleId}:${article.submoduleId}`) || article.submoduleId}`} />
              <ReleaseMeta label="Responsável" value={article.owner} />
              <ReleaseMeta label="Visualizações" value={String(article.clicks)} />
              <ReleaseMeta label="Atualizado" value={formatHadronArticleDate(article.updatedAt)} />
            </aside>
            <section className="min-w-0 pt-4 lg:pt-0">
              <h3 className="mb-4 text-sm font-medium">Detalhes</h3>
              <LegacyRichContent value={article.description || "Sem conteúdo informado."} />
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ArticleEditDialog({ article, onClose, onSave }: { article: ArticleDraft | null; onClose: () => void; onSave: (article: ArticleDraft) => void }) {
  const [draft, setDraft] = useState<ArticleDraft | null>(article);
  useEffect(() => setDraft(article), [article]);
  if (!draft) return null;
  const update = <K extends keyof ArticleDraft,>(field: K, value: ArticleDraft[K]) => setDraft((current) => current ? { ...current, [field]: value } : current);
  const submodules = releaseSubmoduleSelectItems(draft.moduleId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">{draft.id.startsWith("novo-") ? "Criar artigo" : "Editar artigo"}</DialogTitle>
        <DetailModalHeader icon={draft.id.startsWith("novo-") ? Plus : FilePenLine} title={draft.id.startsWith("novo-") ? "Criar artigo" : "Editar artigo"} protocol={draft.id.startsWith("novo-") ? undefined : `Artigo ${draft.id}`} meta={draft.title} onClose={onClose} accentClassName="bg-sky-600" iconWrapClassName="bg-sky-600 text-white" />
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 text-foreground md:grid-cols-6 [&_label]:text-foreground [&_span]:text-foreground">
          <label className="space-y-1 text-sm md:col-span-2"><span>Categoria</span><OccurrenceSelect value={draft.category} onValueChange={(value) => update("category", value)} items={[["guia", "Guia"], ["manual", "Manual"], ["erros", "Erros e Correções"], ["legislacao", "Legislação"], ["comunicacao", "Comunicação"], ["novidades", "Novidades"], ["atualizacoes", "Atualizações"]]} /></label>
          <label className="space-y-1 text-sm md:col-span-2"><span>Permissão</span><OccurrenceSelect value={draft.permission} onValueChange={(value) => update("permission", value)} items={[["0", "Público"], ["1", "Clientes"], ["2", "Empresa"]]} /></label>
          <label className="space-y-1 text-sm md:col-span-2"><span>Status</span><OccurrenceSelect value={draft.status} onValueChange={(value) => update("status", value)} items={[["0", "Não publicado"], ["1", "Publicado"], ["2", "Em análise"]]} /></label>
          <label className="space-y-1 text-sm md:col-span-3"><span>Módulo</span><OccurrenceSelect value={draft.moduleId} onValueChange={(moduleId) => setDraft({ ...draft, moduleId, submoduleId: "none" })} items={releaseModuleSelectItems} /></label>
          <label className="space-y-1 text-sm md:col-span-3"><span>Submódulo</span><OccurrenceSelect value={draft.submoduleId} onValueChange={(value) => update("submoduleId", value)} items={submodules} /></label>
          <label className="space-y-1 text-sm md:col-span-6"><span>Título</span><Input value={draft.title} onChange={(event) => update("title", event.target.value)} /></label>
          <div className="space-y-1 text-sm md:col-span-6"><span>Conteúdo do artigo</span><RichTextEditor value={normalizeLegacyHtml(draft.description)} onChange={value => update("description", value)} minHeight={280} /></div>
          <label className="space-y-1 text-sm md:col-span-6"><span>E-mail com cópia</span><Input value={draft.emailCopy} onChange={(event) => update("emailCopy", event.target.value)} placeholder="Separe os endereços por ;" /></label>
          <div className="space-y-1 text-sm md:col-span-6"><span>Tags</span><TagInput value={draft.tags} onChange={(value) => update("tags", value)} suggestions={cvsArticles.flatMap((item) => item.tags.split(/[,;]+/))} /></div>
          <div className="md:col-span-3"><RelationPicker label="Artigos relacionados" value={draft.relatedArticleIds} onChange={(value) => update("relatedArticleIds", value)} items={cvsArticles.filter((item) => item.id !== draft.id).map((item) => [item.id, `${item.id} - ${item.title}`])} /></div>
          <div className="md:col-span-3"><RelationPicker label="Releases relacionados" value={draft.relatedReleaseIds} onChange={(value) => update("relatedReleaseIds", value)} items={hadronReleases.map((item) => [item.id, `${item.id} - ${item.title}`])} /></div>
        </div>
        <DialogFooter className="shrink-0 border-t px-5 py-4"><Button onClick={() => { if (!draft.title.trim()) { toast.error("Informe o título do artigo."); return; } onSave({ ...draft, id: draft.id.startsWith("novo-") ? crypto.randomUUID() : draft.id, updatedAt: new Date().toISOString() }); }}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatHadronArticleDate(value: string) {
  return formatCatalogDate(value);
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
