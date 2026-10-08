import { CommercialActivityDialog } from "@/components/portal/CommercialActivityDialog";
import {
  contactActivities,
  activityStatus,
  activityTypes,
  finishActivity,
  type ContactActivity,
} from "@/lib/commercial-activities";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Building2,
  ChevronLeft,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  User,
  Calendar,
  History,
  FileText,
  MessageSquare,
  AlertCircle,
  Plus,
  ArrowLeft,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Pencil,
  MapPinned,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePortalAuth } from "@/lib/portal-auth";
import {
  companyLeadsApi,
  type CompanyLeadDetails,
  type CompanyLeadStage,
} from "@/lib/company-leads-api";

export const Route = createFileRoute("/comercial/contatos/$leadId")({
  component: LeadDetailsPage,
});

const stageLabels: Record<CompanyLeadStage, string> = {
  novo: "Novo",
  prospeccao: "Prospecção",
  relacionamento: "Relacionamento",
  proposta: "Proposta",
  negociacao: "Negociação",
  demonstracao: "Demonstração",
  negocio_fechado: "Negócio fechado",
  sem_interesse: "Sem interesse",
};

const stageColors: Record<CompanyLeadStage, string> = {
  novo: "bg-blue-500/10 text-blue-600 border-blue-200",
  prospeccao: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  relacionamento: "bg-purple-500/10 text-purple-600 border-purple-200",
  proposta: "bg-amber-500/10 text-amber-600 border-amber-200",
  negociacao: "bg-orange-500/10 text-orange-600 border-orange-200",
  demonstracao: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  negocio_fechado: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  sem_interesse: "bg-rose-500/10 text-rose-600 border-rose-200",
};

const googleMapsAddressUrl = (lead: CompanyLeadDetails) => {
  const address = [lead.address, lead.neighborhood, lead.city, lead.state, lead.postal_code]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

export function LeadDetailsPage() {
  const { leadId } = useParams({ strict: false });
  const { operator } = usePortalAuth();
  const currentOperator = operator || "PRCREN";
  const [lead, setLead] = useState<CompanyLeadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [showInactivateDialog, setShowInactivateDialog] = useState(false);

  const [inactivationReason, setInactivationReason] = useState("");
  const [inactivationNotes, setInactivationNotes] = useState("");

  const loadLead = async () => {
    try {
      setLoading(true);
      const data = await companyLeadsApi.details(leadId);
      setLead(data);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar os detalhes do lead.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLead();
  }, [leadId]);

  const handleInactivate = async () => {
    setActionLoading(true);
    try {
      await companyLeadsApi.saveAction(
        leadId,
        "inactivate",
        { reason: inactivationReason, notes: inactivationNotes },
        false,
        currentOperator,
      );
      toast.success("Lead inativado com sucesso.");
      await loadLead();
      setShowInactivateDialog(false);
    } catch (err) {
      toast.error("Erro ao inativar lead.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell fullWidth>
        <div className="p-8 space-y-4">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
            <Skeleton className="h-[600px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!lead) {
    return (
      <AppShell fullWidth>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Lead não encontrado</h2>
          <Button asChild variant="outline">
            <Link to="/comercial/contatos">Voltar para listagem</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell fullWidth>
      <div className="min-h-screen bg-background">
        <DetailModalHeader
          icon={Briefcase}
          title={lead.trade_name || lead.legal_name}
          protocol={lead.cnpj}
          chips={
            <Badge
              variant="outline"
              className={cn("text-[10px] font-semibold uppercase", stageColors[lead.stage])}
            >
              {stageLabels[lead.stage]}
            </Badge>
          }
          meta={
            <>
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {lead.legal_name}
              </span>
              <span className="mx-1">•</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {lead.city} - {lead.state}
              </span>
            </>
          }
          trailing={
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" asChild variant="outline" className="h-8 text-xs gap-1.5">
                <a href={googleMapsAddressUrl(lead)} target="_blank" rel="noreferrer">
                  <MapPinned className="h-3.5 w-3.5" />
                  Google Maps
                </a>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowInactivateDialog(true)}
                disabled={actionLoading}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Inativar
              </Button>

              <CommercialActivityDialog
                leadId={lead.id}
                actor={currentOperator}
                onSaved={loadLead}
              />
              {!lead.converted_client_id && (
                <Button
                  size="sm"
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 border-none"
                  asChild
                  disabled={actionLoading}
                >
                  <Link to="/comercial/negocio-fechado/$leadId" params={{ leadId: leadId! }}>
                    <CheckCircle className="h-3.5 w-3.5" />
                    Negócio fechado
                  </Link>
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-primary text-primary hover:bg-primary/5"
                asChild
                disabled={actionLoading}
              >
                <Link to="/comercial/editar-contato/$leadId" params={{ leadId: leadId! }}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Link>
              </Button>

              <Button
                size="sm"
                asChild
                variant="ghost"
                className="h-8 text-xs gap-1.5 border border-input hover:bg-accent"
              >
                <Link to="/comercial/contatos">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </Link>
              </Button>
            </div>
          }
        />

        <Dialog open={showInactivateDialog} onOpenChange={setShowInactivateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Inativar contato</DialogTitle>
              <DialogDescription>
                Registre o motivo sem excluir o histórico comercial.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <FieldSelect
                label="Motivo"
                value={inactivationReason}
                onChange={setInactivationReason}
                options={inactivationReasons}
              />
              <Field
                label="Observação"
                value={inactivationNotes}
                onChange={setInactivationNotes}
                textarea
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInactivateDialog(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleInactivate}
                disabled={actionLoading || !inactivationReason}
              >
                Inativar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <main className="p-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* Coluna Principal - Timeline e Dados */}
            <div className="flex min-w-0 flex-col gap-6">
              {/* Timeline de Atividades */}
              <section className="rounded-xl border bg-card shadow-sm overflow-hidden flex-shrink-0">
                <div className="border-b px-5 py-3 bg-muted/30">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <History className="h-4 w-4 text-primary" />
                    Timeline de Atividades
                  </h3>
                </div>
                <div className="p-6">
                  <Timeline lead={lead} fallbackActor={currentOperator} />
                </div>
              </section>

              {/* Dados da Empresa */}
              <section className="rounded-xl border bg-card shadow-sm flex-shrink-0">
                <div className="border-b px-5 py-3 bg-muted/30">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-primary" />
                    Dados da Empresa
                  </h3>
                </div>
                <div className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  <InfoItem label="Razão Social" value={lead.legal_name} />
                  <InfoItem label="Nome Fantasia" value={lead.trade_name} />
                  <InfoItem label="CNPJ" value={lead.cnpj} />
                  <InfoItem label="Situação Cadastral" value={lead.registration_status} />
                  <InfoItem label="Porte" value={lead.company_size} />
                  <InfoItem label="Natureza Jurídica" value={lead.legal_nature} />
                  <InfoItem
                    label="CNAE Principal"
                    value={`${lead.cnae_code} - ${lead.cnae_description}`}
                  />
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      Quadro Societário
                    </dt>
                    <dd className="text-sm">
                      {lead.partners?.length > 0
                        ? lead.partners.map((p) => p.name).join(", ")
                        : "Não informado"}
                    </dd>
                  </div>
                </div>
              </section>

              {/* Localização e Contato */}
              <section className="rounded-xl border bg-card shadow-sm flex-shrink-0">
                <div className="border-b px-5 py-3 bg-muted/30">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="h-4 w-4 text-primary" />
                    Localização e Contato
                  </h3>
                </div>
                <div className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  <InfoItem label="Endereço" value={lead.address} />
                  <InfoItem label="Bairro" value={lead.neighborhood} />
                  <InfoItem label="Cidade / UF" value={`${lead.city} - ${lead.state}`} />
                  <InfoItem label="CEP" value={lead.postal_code} />
                  <InfoItem label="Telefone Principal" value={lead.phone} />
                  <InfoItem label="Telefone Adicional" value={lead.phone_secondary} />
                  <InfoItem label="E-mail" value={lead.email} />
                  <InfoItem label="Site" value={lead.website} />
                </div>
              </section>
            </div>

            {/* Painel Lateral */}
            <aside>
              <div className="flex flex-col gap-6">
                <section className="rounded-xl border bg-card p-5 shadow-sm space-y-6">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider border-b pb-2">
                    Status do Lead
                  </h3>

                  <div className="space-y-4">
                    <SideInfoItem label="Etapa Comercial" value={stageLabels[lead.stage]} />
                    <SideInfoItem
                      label="Prioridade"
                      value={
                        lead.relevance_score >= 8
                          ? "Alta"
                          : lead.relevance_score >= 5
                            ? "Média"
                            : "Baixa"
                      }
                    />
                    <SideInfoItem label="Data de Retorno" value="Não agendada" />

                    <div className="h-px bg-border my-2" />

                    <SideInfoItem
                      label="Data de Cadastro"
                      value={
                        lead.discovered_at
                          ? new Date(lead.discovered_at).toLocaleDateString("pt-BR")
                          : "—"
                      }
                    />
                    <SideInfoItem label="Última Atualização" value="Hoje" />
                    <SideInfoItem label="Operador de Registro" value={lead.source} />
                    <SideInfoItem
                      label="Operador da Última Alteração"
                      value={lead.last_modified_by || currentOperator}
                    />

                    <div className="h-px bg-border my-2" />

                    <SideInfoItem
                      label="Primeiro Contato"
                      value={
                        lead.commercial_data?.first_contact_at
                          ? new Date(String(lead.commercial_data.first_contact_at)).toLocaleString(
                              "pt-BR",
                            )
                          : "—"
                      }
                    />
                    <SideInfoItem
                      label="Quantidade de Ligações"
                      value={String(lead.commercial_data?.calls_count ?? 0)}
                    />
                    <SideInfoItem
                      label="Quantidade de E-mails"
                      value={String(lead.commercial_data?.emails_count ?? 0)}
                    />
                    <SideInfoItem
                      label="Quantidade de Solicitações"
                      value={String(lead.commercial_data?.requests_count ?? 0)}
                    />
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </AppShell>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase text-muted-foreground mb-1">{label}</dt>
      <dd className="text-sm font-medium truncate" title={value || "Não informado"}>
        {value || "Não informado"}
      </dd>
    </div>
  );
}

const inactivationReasons = [
  "Preço fora do mercado",
  "Sem investimento no momento",
  "Problema(s) financeiro(s)",
  "Não irá trocar de sistema",
  "Problemas de conversão de dados, sem compatibilidade",
  "Optou por outro sistema",
  "Empresa fechou",
  "Outro (descreva)",
];

function Field({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className={cn("grid min-w-0 gap-1.5", textarea && "sm:col-span-2 lg:col-span-3")}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {textarea ? (
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels?.[option] || option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function SideInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 break-words">
      <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function Timeline({ lead, fallbackActor }: { lead: CompanyLeadDetails; fallbackActor: string }) {
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [finishing, setFinishing] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof companyLeadsApi.history>>>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryFailed(false);
    Promise.all([companyLeadsApi.history(lead.id), contactActivities(lead.id)])
      .then((data) => {
        if (active) {
          setHistory(data[0]);
          setActivities(data[1]);
        }
      })
      .catch(() => {
        if (active) {
          setHistoryFailed(true);
          setHistory([]);
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lead, revision]);
  const labels: Record<string, string> = {
    stage: "Etapa",
    terminals: "Terminais",
    name: "Nome",
    acronym: "Sigla",
    trade_name: "Nome fantasia",
    phone: "Telefone",
    email: "E-mail",
    website: "Site",
    priority: "Prioridade",
    branch: "Ramo",
    company_size: "Porte",
    address: "Endereço",
    address_number: "Número",
    address_complement: "Complemento",
    postal_code: "CEP",
    neighborhood: "Bairro",
    city: "Cidade",
    state: "UF",
    activities: "Atividades",
    notes: "Observações",
    conversion_status: "Fechamento",
    registration_status: "Situação cadastral",
    inactivation_reason: "Motivo da inativação",
    first_contact_at: "Primeiro contato",
    calls_count: "Quantidade de ligações",
    emails_count: "Quantidade de e-mails",
    requests_count: "Quantidade de solicitações",
  };
  const formatValue = (key: string, value: unknown) => {
    if (
      ["calls_count", "emails_count", "requests_count"].includes(key) &&
      (value === null || value === undefined || value === "")
    )
      return "0";
    if (value === null || value === undefined || value === "") return "Não informado";
    if (key === "first_contact_at") {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
    }
    if (key === "stage") return stageLabels[String(value) as CompanyLeadStage] || String(value);
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  };
  const items = [
    {
      id: "1",
      kind: "created",
      title: "Lead Criado",
      description:
        lead.source === "crm-manual"
          ? "Contato cadastrado no CRM."
          : lead.source === "crm-import"
            ? "Contato importado para o CRM."
            : "Empresa identificada via prospecção ativa.",
      at: lead.discovered_at,
      actor: lead.source,
      status: "Concluído",
    },
    ...activities.map((activity) => ({
      id: `activity-${activity.id}`,
      kind: "activity",
      title:
        activityTypes.find((type) => type.value === activity.type)?.label || "Atividade comercial",
      description:
        activity.description +
        (activity.return_at
          ? `\nRetorno: ${new Date(activity.return_at).toLocaleString("pt-BR")}`
          : ""),
      at: activity.occurred_at,
      actor: activity.actor,
      status: activityStatus(activity),
    })),
    ...history.map((event) => ({
      id: event.id,
      kind: "edit",
      title:
        event.changes.stage && Object.keys(event.changes).length === 1
          ? "Alteração de etapa"
          : "Dados comerciais atualizados",
      description: Object.entries(event.changes)
        .map(([key, value]) =>
          key === "conversion_data"
            ? "Dados do fechamento atualizados."
            : key === "first_contact_at" && !value.old && value.new
              ? `Primeiro contato registrado em ${formatValue(key, value.new)}.`
              : `${labels[key] || key}: ${formatValue(key, value.old)} → ${formatValue(key, value.new)}`,
        )
        .join("\n"),
      at: event.created_at,
      actor: event.actor || fallbackActor,
      status: "Concluído",
    })),
  ];

  const orderedItems = [...items].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  const renderTimeline = (visibleItems: typeof items) => (
    <div className="space-y-8 relative before:absolute before:inset-0 before:left-[17px] before:w-0.5 before:bg-muted">
      {visibleItems.map((item) => (
        <div key={item.id} className="relative pl-10">
          <div className="absolute left-0 top-0 h-9 w-9 rounded-full bg-background border-2 border-primary flex items-center justify-center z-10">
            {item.kind === "created" ? (
              <Plus className="h-4 w-4 text-primary" />
            ) : (
              <History className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-primary uppercase">{item.title}</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {new Date(item.at).toLocaleString("pt-BR")}
              </span>
            </div>
            <p className="whitespace-pre-line break-words text-sm">{item.description}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-muted-foreground">
                <User className="h-3 w-3 inline mr-1" />
                {item.actor}
              </span>
              {item.kind === "activity" &&
                activities.find((activity) => `activity-${activity.id}` === item.id)?.status ===
                  "pendente" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!!finishing}
                    onClick={async () => {
                      const id = item.id.replace("activity-", "");
                      setFinishing(id);
                      try {
                        await finishActivity(id);
                        setRevision((value) => value + 1);
                        toast.success("Retorno concluído.");
                      } catch {
                        toast.error("Não foi possível concluir o retorno.");
                      } finally {
                        setFinishing(null);
                      }
                    }}
                  >
                    Concluir retorno
                  </Button>
                )}
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] uppercase font-bold">
                {item.status}
              </Badge>
            </div>
          </div>
        </div>
      ))}
      {historyLoading && (
        <p className="pl-10 text-xs text-muted-foreground">Carregando histórico...</p>
      )}
      {historyFailed && (
        <p className="pl-10 text-xs text-destructive">
          Não foi possível carregar o histórico. Atualize a página para tentar novamente.
        </p>
      )}
    </div>
  );
  return (
    <>
      {renderTimeline(orderedItems.slice(0, 3))}
      {orderedItems.length > 3 && (
        <div className="mt-5 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            Ver todos ({orderedItems.length})
          </Button>
        </div>
      )}
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Timeline de atividades</DialogTitle>
            <DialogDescription>
              Histórico completo do contato, do mais recente ao mais antigo.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-3 py-4">
            {renderTimeline(orderedItems)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
