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
  const [showCloseDealDialog, setShowCloseDealDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [inactivationReason, setInactivationReason] = useState("");
  const [inactivationNotes, setInactivationNotes] = useState("");
  const [conversionForm, setConversionForm] = useState<Record<string, string>>({});

  // Edit form state
  const [editForm, setEditForm] = useState({
    trade_name: "",
    phone: "",
    email: "",
    website: "",
    notes: "",
    stage: "novo",
    priority: "baixa",
    activities: "",
    branch: "",
    company_size: "",
    terminals: "",
    address: "",
    address_number: "",
    neighborhood: "",
    city: "",
    state: "",
    postal_code: "",
  });

  const loadLead = async () => {
    try {
      setLoading(true);
      const data = await companyLeadsApi.details(leadId);
      setLead(data);
      setEditForm({
        trade_name: data.trade_name || "",
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        notes: "", // Assuming notes isn't in lead details yet but we provide the field
        stage: data.stage,
        priority: String(data.commercial_data?.priority || "baixa"),
        activities: String(data.commercial_data?.activities || data.notes || ""),
        branch: String(data.commercial_data?.branch || ""),
        company_size: data.company_size || "",
        terminals: String(data.commercial_data?.terminals || ""),
        address: data.address || "",
        address_number: String(data.commercial_data?.address_number || ""),
        neighborhood: data.neighborhood || "",
        city: data.city || "",
        state: data.state || "",
        postal_code: data.postal_code || "",
      });
      setConversionForm((data.conversion_data || {}) as Record<string, string>);
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

  const handleCloseDeal = async () => {
    setActionLoading(true);
    try {
      await companyLeadsApi.saveAction(leadId, "close_deal", conversionForm, true, currentOperator);
      toast.success("Negócio fechado com sucesso!");
      await loadLead();
      setShowCloseDealDialog(false);
    } catch (err) {
      toast.error("Erro ao atualizar etapa.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDealDraft = async () => {
    setActionLoading(true);
    try {
      await companyLeadsApi.saveAction(
        leadId,
        "close_deal",
        conversionForm,
        false,
        currentOperator,
      );
      toast.success("Rascunho do negócio salvo.");
      await loadLead();
      setShowCloseDealDialog(false);
    } catch {
      toast.error("Erro ao salvar o negócio.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await companyLeadsApi.saveAction(leadId, "edit", editForm, false, currentOperator);
      toast.success("Dados atualizados com sucesso.");
      await loadLead();
      setShowEditDialog(false);
    } catch (err) {
      toast.error("Erro ao atualizar dados.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell fullWidth>
        <div className="p-8 space-y-4">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
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

              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 border-none"
                onClick={() => setShowCloseDealDialog(true)}
                disabled={actionLoading}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Negócio fechado
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-primary text-primary hover:bg-primary/5"
                onClick={() => setShowEditDialog(true)}
                disabled={actionLoading}
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
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

        <Dialog open={showCloseDealDialog} onOpenChange={setShowCloseDealDialog}>
          <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle>Negócio fechado</DialogTitle>
              <DialogDescription>
                Preencha os dados para converter este contato em cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-2">
              <FormSection title="Cliente e empresa">
                {closeDealCompanyFields.map(([label, key]) => (
                  <Field
                    key={key}
                    label={label}
                    value={conversionForm[key] || closeDealFallback(lead, key)}
                    onChange={(v) => setConversionFormField(setConversionForm, key, v)}
                  />
                ))}
              </FormSection>
              <FormSection title="Endereço e contatos">
                {closeDealContactFields.map(([label, key]) => (
                  <Field
                    key={key}
                    label={label}
                    value={conversionForm[key] || closeDealFallback(lead, key)}
                    onChange={(v) => setConversionFormField(setConversionForm, key, v)}
                  />
                ))}
              </FormSection>
              <FormSection title="Responsável e contabilidade">
                {closeDealResponsibleFields.map(([label, key]) => (
                  <Field
                    key={key}
                    label={label}
                    value={conversionForm[key] || ""}
                    onChange={(v) => setConversionFormField(setConversionForm, key, v)}
                  />
                ))}
              </FormSection>
              <FormSection title="Implantação do Hádron">
                {closeDealHadronFields.map(([label, key]) => (
                  <Field
                    key={key}
                    label={label}
                    value={conversionForm[key] || ""}
                    onChange={(v) => setConversionFormField(setConversionForm, key, v)}
                  />
                ))}
              </FormSection>
              <Field
                label="Observação"
                value={conversionForm.notes || ""}
                onChange={(v) => setConversionFormField(setConversionForm, "notes", v)}
                textarea
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseDealDialog(false)}>
                Voltar
              </Button>
              <Button variant="secondary" onClick={handleSaveDealDraft}>
                Salvar
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleCloseDeal}
              >
                Salvar e finalizar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Form Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto modal-scrollbar">
            <form onSubmit={handleEdit}>
              <DialogHeader>
                <DialogTitle>Editar dados comerciais</DialogTitle>
                <DialogDescription>
                  Altere apenas campos comerciais permitidos. Dados da Receita Federal não podem ser
                  editados por aqui.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
                <FieldSelect
                  label="Etapa"
                  value={editForm.stage}
                  onChange={(stage) => setEditForm((current) => ({ ...current, stage }))}
                  options={Object.keys(stageLabels)}
                  labels={stageLabels}
                />
                <FieldSelect
                  label="Prioridade"
                  value={editForm.priority}
                  onChange={(priority) => setEditForm((current) => ({ ...current, priority }))}
                  options={["baixa", "media", "alta"]}
                />
                <div className="grid gap-2">
                  <Label htmlFor="trade_name">Nome Fantasia</Label>
                  <Input
                    id="trade_name"
                    value={editForm.trade_name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, trade_name: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={editForm.website}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, website: e.target.value }))}
                  />
                </div>
                <Field
                  label="Ramo"
                  value={editForm.branch}
                  onChange={(branch) => setEditForm((current) => ({ ...current, branch }))}
                />
                <Field
                  label="Porte"
                  value={editForm.company_size}
                  onChange={(company_size) =>
                    setEditForm((current) => ({ ...current, company_size }))
                  }
                />
                <Field
                  label="Terminais"
                  value={editForm.terminals}
                  onChange={(terminals) => setEditForm((current) => ({ ...current, terminals }))}
                />
                <Field
                  label="CEP"
                  value={editForm.postal_code}
                  onChange={(postal_code) =>
                    setEditForm((current) => ({ ...current, postal_code }))
                  }
                />
                <Field
                  label="Endereço"
                  value={editForm.address}
                  onChange={(address) => setEditForm((current) => ({ ...current, address }))}
                />
                <Field
                  label="Número"
                  value={editForm.address_number}
                  onChange={(address_number) =>
                    setEditForm((current) => ({ ...current, address_number }))
                  }
                />
                <Field
                  label="Bairro"
                  value={editForm.neighborhood}
                  onChange={(neighborhood) =>
                    setEditForm((current) => ({ ...current, neighborhood }))
                  }
                />
                <Field
                  label="Cidade"
                  value={editForm.city}
                  onChange={(city) => setEditForm((current) => ({ ...current, city }))}
                />
                <Field
                  label="UF"
                  value={editForm.state}
                  onChange={(state) =>
                    setEditForm((current) => ({ ...current, state: state.toUpperCase() }))
                  }
                />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field
                    label="Atividades"
                    value={editForm.activities}
                    onChange={(activities) =>
                      setEditForm((current) => ({ ...current, activities }))
                    }
                    textarea
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    className="resize-none"
                    value={editForm.notes}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading ? "Salvando..." : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <main className="p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
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
                <div className="p-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="p-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

                    <SideInfoItem label="Primeiro Contato" value="—" />
                    <SideInfoItem label="Quantidade de Ligações" value="0" />
                    <SideInfoItem label="Quantidade de E-mails" value="0" />
                    <SideInfoItem label="Quantidade de Solicitações" value="0" />
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

const closeDealCompanyFields = [
  ["Nome (apelido)", "nickname"],
  ["Sigla", "acronym"],
  ["E-mail do responsável (Admin.)", "admin_email"],
  ["Nome (Admin.)", "admin_name"],
  ["Sigla do grupo", "group_acronym"],
  ["Unidade de atendimento", "service_unit"],
  ["CNPJ", "cnpj"],
  ["Razão social", "legal_name"],
  ["Nome fantasia", "trade_name"],
  ["Inscrição estadual", "state_registration"],
  ["Inscrição municipal", "city_registration"],
  ["CNAE", "cnae"],
  ["ANTT (transportadora)", "antt"],
  ["Regime de apuração", "tax_regime"],
  ["Ramo", "branch"],
  ["Porte", "company_size"],
  ["Site", "website"],
] as const;
const closeDealContactFields = [
  ["CEP", "postal_code"],
  ["Endereço", "address"],
  ["Número", "address_number"],
  ["Complemento", "address_complement"],
  ["Bairro", "neighborhood"],
  ["Cidade", "city"],
  ["UF", "state"],
  ["Telefone", "phone"],
  ["Contato do telefone", "phone_contact"],
  ["E-mail", "email"],
  ["Contato do e-mail", "email_contact"],
] as const;
const closeDealResponsibleFields = [
  ["Responsável", "responsible_name"],
  ["CPF", "responsible_cpf"],
  ["RG", "responsible_rg"],
  ["CEP do responsável", "responsible_postal_code"],
  ["Endereço do responsável", "responsible_address"],
  ["Número", "responsible_number"],
  ["Complemento", "responsible_complement"],
  ["Bairro", "responsible_neighborhood"],
  ["Cidade", "responsible_city"],
  ["UF", "responsible_state"],
  ["Escritório", "accounting_office"],
  ["Contador", "accountant_name"],
  ["Telefone do contador", "accountant_phone"],
  ["E-mail do contador", "accountant_email"],
] as const;
const closeDealHadronFields = [
  ["Responsável PRC 1", "hadron_responsible_1"],
  ["Responsável PRC 2", "hadron_responsible_2"],
  ["Tempo de instalação", "installation_time"],
  ["Terminais", "terminals"],
  ["Configuração de rede", "network"],
  ["Módulos contratados", "modules"],
  ["Documentos fiscais", "fiscal_documents"],
  ["Homologação de NF-e", "nfe_validation"],
  ["Importação de dados", "data_import"],
  ["Boleto bancário", "bank_slip"],
  ["Bancos para cobrança", "banks"],
  ["Aplicativos web", "web_apps"],
] as const;

function closeDealFallback(lead: CompanyLeadDetails, key: string) {
  const values: Record<string, string> = {
    cnpj: lead.cnpj,
    legal_name: lead.legal_name,
    trade_name: lead.trade_name || "",
    cnae: lead.cnae_code || "",
    company_size: lead.company_size || "",
    website: lead.website || "",
    postal_code: lead.postal_code || "",
    address: lead.address || "",
    neighborhood: lead.neighborhood || "",
    city: lead.city,
    state: lead.state,
    phone: lead.phone || "",
    email: lead.email || "",
  };
  return values[key] || "";
}

function setConversionFormField(
  setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  key: string,
  value: string,
) {
  setter((current) => ({ ...current, [key]: value }));
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-3">
      <legend className="px-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

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
    <label className={cn("grid gap-1.5", textarea && "sm:col-span-2 lg:col-span-3")}>
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
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function Timeline({ lead, fallbackActor }: { lead: CompanyLeadDetails; fallbackActor: string }) {
  const items = [
    {
      id: "1",
      kind: "created",
      title: "Lead Criado",
      description: "Empresa identificada via prospecção ativa.",
      at: lead.discovered_at || new Date().toISOString(),
      actor: lead.source,
      status: "Concluído",
    },
    {
      id: "2",
      kind: "stage",
      title: "Alteração de Etapa",
      description: `Etapa comercial definida como ${stageLabels[lead.stage]}.`,
      at: new Date().toISOString(),
      actor: lead.last_modified_by || fallbackActor,
      status: "Concluído",
    },
  ];

  return (
    <div className="space-y-8 relative before:absolute before:inset-0 before:left-[17px] before:w-0.5 before:bg-muted">
      {items.map((item) => (
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
            <p className="text-sm">{item.description}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-muted-foreground">
                <User className="h-3 w-3 inline mr-1" />
                {item.actor}
              </span>
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] uppercase font-bold">
                {item.status}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
