import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUp,
  Building2,
  ChevronDown,
  FileText,
  Info,
  ImagePlus,
  Mail,
  MessageSquarePlus,
  Minus,
  Phone,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { ClientPicker } from "@/components/portal/ClientPicker";
import { CollaboratorSelect } from "@/components/portal/CollaboratorPicker";
import { findCollaborator, useCollaborators } from "@/lib/collaborators-store";
import { currentUser } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SmartInput, SmartTextarea } from "@/components/ui/smart-text";
import { ticketsStore } from "@/lib/tickets-store";
import type { SupportTicket, TicketPriority } from "@/lib/support-tickets-data";
import type { ClosurePayload } from "@/lib/tickets-store";
import { loadClients } from "@/lib/clients-store";
import {
  fetchClientGroupCompanies,
  formatPhoneDisplay,
  type ClientContact,
  type ClientCompanySummary,
} from "@/lib/client-contacts";
import type { ClientRow } from "@/routes/clientes.index";
import { cn } from "@/lib/utils";
import { modulesMap, moduleOptions } from "@/lib/modules-map";

export const Route = createFileRoute("/chamados/novo")({
  validateSearch: (search: Record<string, unknown>) => ({
    cliente: typeof search.cliente === "string" ? search.cliente : undefined,
    empresa: typeof search.empresa === "string" ? search.empresa : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Novo chamado — CRM Prócion" },
      {
        name: "description",
        content: "Abertura de chamado no CRM de suporte da Prócion.",
      },
    ],
  }),
  component: NewTicketPage,
});

// -----------------------------------------------------------------------------
// Metadados fixos do formulário (não são dados de cliente).
// -----------------------------------------------------------------------------

const ticketTypes: ClosurePayload["type"][] = [
  "Não definido",
  "Dúvida",
  "Configuração",
  "Atualização do Hádron",
  "Problema Hádron",
  "Problema Externo",
  "Treinamento",
  "Solicitação/Sugestão",
  "Outros",
];

const sourceOptions: SupportTicket["source"][] = [
  "Portal do cliente",
  "Telefone",
  "WhatsApp",
  "Email",
];

const priorityTone: Record<TicketPriority, string> = {
  Alta: "border-destructive/25 bg-destructive/8 text-destructive",
  Media: "border-warning/35 bg-warning/12 text-warning-foreground",
  Baixa: "border-success/30 bg-success/10 text-success",
};

const priorityOptions: {
  value: TicketPriority;
  label: string;
  icon: typeof ArrowUp;
  baseClass: string;
  activeClass: string;
  iconWrapClass: string;
  textClass: string;
}[] = [
  {
    value: "Baixa",
    label: "Baixa",
    icon: ChevronDown,
    baseClass: "border-success/25 bg-success/10 dark:bg-success/15",
    activeClass:
      "border-success/70 ring-2 ring-success/40 shadow-sm bg-success/15 dark:bg-success/20",
    iconWrapClass: "bg-success text-success-foreground",
    textClass: "text-success",
  },
  {
    value: "Media",
    label: "Média",
    icon: Minus,
    baseClass: "border-warning/30 bg-warning/12 dark:bg-warning/15",
    activeClass:
      "border-warning/70 ring-2 ring-warning/40 shadow-sm bg-warning/20 dark:bg-warning/25",
    iconWrapClass: "bg-warning text-warning-foreground",
    textClass: "text-warning-foreground",
  },
  {
    value: "Alta",
    label: "Alta",
    icon: ArrowUp,
    baseClass: "border-destructive/25 bg-destructive/10 dark:bg-destructive/15",
    activeClass:
      "border-destructive/70 ring-2 ring-destructive/40 shadow-sm bg-destructive/15 dark:bg-destructive/20",
    iconWrapClass: "bg-destructive text-destructive-foreground",
    textClass: "text-destructive",
  },
];

// -----------------------------------------------------------------------------

type FormState = {
  clientId: string;
  companyId: string; // subempresa selecionada (id do client_companies)
  contactName: string;
  emailContactId: string;
  emailValue: string;
  phoneContactId: string;
  phoneValue: string;
  module: string;
  submodule: string;
  /** Sigla real do colaborador responsável. */
  operator: string;
  /** ID real do colaborador responsável. */
  operatorId: string;
  type: ClosurePayload["type"];
  priority: TicketPriority;
  subject: string;
  description: string;
  source: SupportTicket["source"];
};

const initialForm: FormState = {
  clientId: "",
  companyId: "",
  contactName: "",
  emailContactId: "",
  emailValue: "",
  phoneContactId: "",
  phoneValue: "",
  module: "VENDAS",
  submodule: "NFE",
  operator: "",
  operatorId: "",
  type: "Não definido",
  priority: "Media",
  subject: "",
  description: "",
  source: "Portal do cliente",
};

function NewTicketPage() {
  const navigate = useNavigate();
  const { cliente: prefillClientCode, empresa: prefillCompanyId } = Route.useSearch();
  const [form, setForm] = useState<FormState>(initialForm);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<
    Array<{ name: string; type: string; dataUrl: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contatos vinculados ao cliente (carregados do Supabase).
  const [clientUuid, setClientUuid] = useState<string | null>(null);
  const [emails, setEmails] = useState<ClientContact[]>([]);
  const [phones, setPhones] = useState<ClientContact[]>([]);
  const [companies, setCompanies] = useState<ClientCompanySummary[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Garante que a fonte única de clientes esteja carregada.
  useEffect(() => {
    void loadClients().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!prefillClientCode || client) return;
    let cancelled = false;
    void loadClients()
      .then((rows) => {
        if (cancelled) return;
        const code = prefillClientCode.trim().toUpperCase();
        const found = rows.find((row) => row.acronym.trim().toUpperCase() === code);
        if (!found) return;
        setClient(found);
        setForm((prev) => ({ ...prev, clientId: found.id, companyId: "" }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [prefillClientCode, client]);

  const submodules = modulesMap[form.module] ?? [];
  // Somente colaboradores ativos (sem rescisão) podem ser escolhidos como responsável.
  const { collaborators: activeCollaborators } = useCollaborators();
  const selectedOwner = findCollaborator(activeCollaborators, form.operator);
  const operatorObj = form.operator ? { code: form.operator } : null;

  // Pré-seleciona o operador autenticado, quando ele estiver ativo.
  useEffect(() => {
    if (form.operator || activeCollaborators.length === 0) return;
    const me = findCollaborator(activeCollaborators, currentUser.operator);
    if (me) {
      setForm((prev) =>
        prev.operator ? prev : { ...prev, operator: me.acronym ?? me.name, operatorId: me.id },
      );
    }
  }, [activeCollaborators, form.operator]);
  const selectedCompany = companies.find((c) => c.id === form.companyId) ?? null;

  useEffect(() => {
    if (!submodules.includes(form.submodule)) {
      setForm((prev) => ({ ...prev, submodule: submodules[0] ?? "" }));
    }
  }, [form.module, form.submodule, submodules]);

  // Carrega contatos + empresas/subempresas ao selecionar/alterar o cliente.
  useEffect(() => {
    if (!client?.acronym) {
      setClientUuid(null);
      setEmails([]);
      setPhones([]);
      setCompanies([]);
      return;
    }
    let cancelled = false;
    setContactsLoading(true);
    setEmails([]);
    setPhones([]);
    setCompanies([]);
    setClientUuid(null);
    // Exibe todas as empresas do grupo, mantendo os contatos do cliente selecionado.
    fetchClientGroupCompanies(client)
      .then((bundle) => {
        if (cancelled) return;
        setClientUuid(bundle.clientId);
        setEmails(bundle.emails);
        setPhones(bundle.phones);
        setCompanies(bundle.companies);
        // Se houver apenas uma empresa, seleciona automaticamente.
        const requestedCompany = prefillCompanyId
          ? bundle.companies.find((company) => company.id === prefillCompanyId)?.id
          : undefined;
        setForm((prev) => ({
          ...prev,
          companyId:
            requestedCompany ?? (bundle.companies.length === 1 ? bundle.companies[0].id : ""),
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[chamados.novo] falha ao carregar contatos", err);
        toast.error("Não foi possível carregar os contatos deste cliente.");
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client?.acronym, prefillCompanyId]);

  const requiredMissing =
    !form.clientId ||
    (companies.length > 0 && !form.companyId) ||
    !form.contactName.trim() ||
    !form.emailValue.trim() ||
    !form.phoneValue.trim() ||
    !form.subject.trim() ||
    !form.description.trim() ||
    // Responsável válido é obrigatório: precisa ser um colaborador ativo.
    !selectedOwner;

  const handleClientSelect = (c: ClientRow) => {
    setClient(c);
    setForm((prev) => ({
      ...prev,
      clientId: c.id,
      companyId: "",
      emailContactId: "",
      emailValue: "",
      phoneContactId: "",
      phoneValue: "",
    }));
  };

  const handleSelectEmail = (id: string) => {
    const found = emails.find((e) => e.id === id);
    setForm((prev) => ({
      ...prev,
      emailContactId: id,
      emailValue: found?.value ?? "",
      contactName: prev.contactName || found?.name || "",
    }));
  };

  const handleSelectPhone = (id: string) => {
    const found = phones.find((p) => p.id === id);
    setForm((prev) => ({
      ...prev,
      phoneContactId: id,
      phoneValue: found?.value ?? "",
      contactName: prev.contactName || found?.name || "",
    }));
  };

  const addImageFiles = (files: File[]) => {
    files
      .filter((file) => file.type.startsWith("image/"))
      .forEach((file) => {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name}: a imagem deve ter no máximo 5 MB.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          if (typeof dataUrl === "string") {
            setAttachments((current) => [
              ...current,
              { name: file.name, type: file.type, dataUrl },
            ]);
          }
        };
        reader.readAsDataURL(file);
      });
  };

  const handlePasteImage = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (files.length) {
      event.preventDefault();
      addImageFiles(files);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requiredMissing || !client) {
      toast.error("Preencha os campos obrigatórios para abrir o chamado.");
      return;
    }
    if (!selectedOwner) {
      toast.error("Selecione um responsável ativo para o chamado.");
      return;
    }

    setSubmitting(true);
    // Se a subempresa selecionada pertence a outro cliente do grupo, o chamado
    // é criado para o cliente real da empresa (não o cliente pesquisado).
    const effectiveClientCode = selectedCompany?.clientAcronym || client.acronym;
    const effectiveClientName =
      selectedCompany?.tradeName ||
      selectedCompany?.legalName ||
      client.fantasia ||
      client.razaoSocial ||
      client.name;
    const ticket = ticketsStore.createTicket({
      priority: form.priority,
      owner: selectedOwner.acronym ?? selectedOwner.name,
      ownerId: selectedOwner.id,
      clientCode: effectiveClientCode,
      clientName: effectiveClientName,
      contact: form.contactName,
      contactPhone: form.phoneValue,
      subject: form.subject,
      module: `${form.module} - ${form.submodule}`,
      source: form.source,
      description:
        `${form.description}\n\n` +
        `Tipo: ${form.type}. Operador: ${form.operator}. ` +
        `Contato: ${form.emailValue} · ${form.phoneValue}.` +
        (selectedCompany
          ? `\nEmpresa: ${selectedCompany.companyNumber ? String(selectedCompany.companyNumber).padStart(3, "0") + " · " : ""}${selectedCompany.tradeName || selectedCompany.legalName}${selectedCompany.document ? " · " + selectedCompany.document : ""}`
          : ""),
      companyId: selectedCompany?.id ?? null,
      companyNumber: selectedCompany?.companyNumber ?? null,
      companyName: selectedCompany?.tradeName || selectedCompany?.legalName || undefined,
      companyDocument: selectedCompany?.document || undefined,
    });
    attachments.forEach((attachment) => ticketsStore.addAttachment(ticket.id, attachment));
    toast.success("Chamado criado", {
      description: `${ticket.protocol} foi adicionado na fila de suporte.`,
    });
    void navigate({ to: "/chamados" });
  };

  return (
    <AppShell>
      <PageHeader
        title="Criar chamado"
        description="Registre uma nova solicitação do cliente e envie para a fila de suporte."
        breadcrumbs={[{ label: "Chamados", to: "/chamados" }, { label: "Criar chamado" }]}
        actions={
          <Button asChild variant="outline" size="sm" className="rounded-xl cursor-pointer">
            <Link to="/chamados">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div className="space-y-5">
          {/* 1. Cliente */}
          <Card className="rounded-[16px] border border-border/70 bg-card p-5">
            <SectionTitle
              icon={Building2}
              title="Cliente"
              description="Selecione o cliente cadastrado no CRM."
            />
            <div className="mt-4 space-y-3">
              <ClientPicker value={client} onSelect={handleClientSelect} required />

              {client && (
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
                  <p className="truncate">
                    <span className="font-semibold text-foreground">{client.razaoSocial}</span>
                    {client.cnpj && ` · ${client.cnpj}`}
                  </p>
                  {client.city && <p className="truncate">{client.city}</p>}
                </div>
              )}

              {/* Empresa / subempresa vinculada ao cliente selecionado */}
              {client && (
                <div>
                  <Label className="mb-1.5 block text-[12px] font-medium text-foreground">
                    Empresa / subempresa
                    {companies.length > 0 && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  {contactsLoading ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-2.5 text-[12px] text-muted-foreground">
                      Carregando empresas…
                    </div>
                  ) : companies.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-2.5 text-[12px] text-muted-foreground">
                      Nenhuma empresa vinculada.
                    </div>
                  ) : (
                    <Select
                      value={form.companyId}
                      onValueChange={(v) => setForm((prev) => ({ ...prev, companyId: v }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl cursor-pointer">
                        <SelectValue placeholder="Selecione a empresa ou filial" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((co) => {
                          const number = co.companyNumber
                            ? String(co.companyNumber).padStart(3, "0")
                            : "—";
                          const name = co.tradeName || co.legalName || "Empresa";
                          const location = [co.city, co.state].filter(Boolean).join(" / ");
                          return (
                            <SelectItem key={co.id} value={co.id} className="cursor-pointer">
                              <span className="inline-flex flex-col">
                                <span className="text-[12.5px]">
                                  <span className="font-semibold">{number}</span>
                                  {" · "}
                                  {name}
                                  {co.document ? ` · ${co.document}` : ""}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {co.isPrincipal ? "Principal" : "Filial"}
                                  {location ? ` · ${location}` : ""}
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* 2. Contato */}
          <Card className="rounded-[16px] border border-border/70 bg-card p-5">
            <SectionTitle
              icon={UserRound}
              title="Contato"
              description="Quem está solicitando o atendimento."
            />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Nome do contato" required>
                <Input
                  value={form.contactName}
                  onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
                  placeholder="Nome completo"
                  className="h-11 rounded-xl"
                />
              </Field>

              <Field label="E-mail do contato" required>
                <ContactSelectField
                  icon={Mail}
                  kind="email"
                  disabled={!client}
                  loading={contactsLoading}
                  options={emails}
                  value={form.emailContactId}
                  placeholder={
                    !client
                      ? "Selecione uma empresa"
                      : contactsLoading
                        ? "Carregando contatos..."
                        : emails.length === 0
                          ? "Nenhum e-mail cadastrado"
                          : "Selecione um e-mail"
                  }
                  onChange={handleSelectEmail}
                />
              </Field>

              <Field label="Telefone" required>
                <ContactSelectField
                  icon={Phone}
                  kind="phone"
                  disabled={!client}
                  loading={contactsLoading}
                  options={phones}
                  value={form.phoneContactId}
                  placeholder={
                    !client
                      ? "Selecione uma empresa"
                      : contactsLoading
                        ? "Carregando contatos..."
                        : phones.length === 0
                          ? "Nenhum telefone cadastrado"
                          : "Selecione um telefone"
                  }
                  onChange={handleSelectPhone}
                />
              </Field>
            </div>
          </Card>

          {/* 3. Classificação */}
          <Card className="rounded-[16px] border border-border/70 bg-card p-5">
            <SectionTitle
              icon={FileText}
              title="Classificação"
              description="Módulo, submódulo e operador responsável."
            />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Módulo">
                <Select
                  value={form.module}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, module: v }))}
                >
                  <SelectTrigger className="h-11 rounded-xl cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Submódulo">
                <Select
                  value={form.submodule}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, submodule: v }))}
                >
                  <SelectTrigger className="h-11 rounded-xl cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {submodules.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Responsável" required>
                <CollaboratorSelect
                  value={form.operator}
                  onChange={(acronym, collaborator) =>
                    setForm((prev) => ({
                      ...prev,
                      operator: acronym,
                      operatorId: collaborator?.id ?? "",
                    }))
                  }
                  placeholder="Selecione o responsável"
                  className="h-11 rounded-xl"
                />
              </Field>
            </div>
          </Card>

          {/* 4. Informações do chamado */}
          <Card className="rounded-[16px] border border-border/70 bg-card p-5">
            <SectionTitle
              icon={MessageSquarePlus}
              title="Informações do chamado"
              description="Assunto, descrição, tipo e prioridade."
            />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-3">
                <Field label="Assunto" required>
                  <SmartInput
                    value={form.subject}
                    onValueChange={(subject) => setForm((prev) => ({ ...prev, subject }))}
                    placeholder="Ex.: Nota em processamento"
                    className="h-11 rounded-xl"
                  />
                </Field>
                <Field label="Descrição" required>
                  <SmartTextarea
                    value={form.description}
                    onValueChange={(description) => setForm((prev) => ({ ...prev, description }))}
                    rows={7}
                    placeholder="Descreva o que o cliente relatou, mensagens de erro, tela onde ocorreu e o que já foi conferido..."
                    className="min-h-[180px] resize-none rounded-xl"
                  />
                </Field>

                <div
                  tabIndex={0}
                  onPaste={handlePasteImage}
                  className="rounded-xl border border-dashed border-border bg-muted/20 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => addImageFiles(Array.from(event.target.files ?? []))}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Imagens do chamado</p>
                      <p className="text-[11px] text-muted-foreground">
                        Cole uma captura aqui ou importe arquivos de até 5 MB.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-1.5 h-4 w-4" />
                      Importar imagem
                    </Button>
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {attachments.map((attachment, index) => (
                        <div
                          key={`${attachment.name}-${index}`}
                          className="relative overflow-hidden rounded-lg border border-border bg-card"
                        >
                          <img
                            src={attachment.dataUrl}
                            alt={attachment.name}
                            className="aspect-video w-full object-cover"
                          />
                          <button
                            type="button"
                            aria-label={`Remover ${attachment.name}`}
                            title="Remover imagem"
                            onClick={() =>
                              setAttachments((current) =>
                                current.filter((_, itemIndex) => itemIndex !== index),
                              )
                            }
                            className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-md bg-background/90 text-foreground shadow-sm"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Field label="Tipo">
                  <Select
                    value={form.type}
                    onValueChange={(v: ClosurePayload["type"]) =>
                      setForm((prev) => ({ ...prev, type: v }))
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ticketTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Prioridade">
                  <div role="radiogroup" aria-label="Prioridade" className="grid grid-cols-3 gap-2">
                    {priorityOptions.map((opt) => {
                      const active = form.priority === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setForm((prev) => ({ ...prev, priority: opt.value }))}
                          className={cn(
                            "relative flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-xs font-medium transition cursor-pointer",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                            opt.baseClass,
                            active && opt.activeClass,
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                              opt.iconWrapClass,
                            )}
                          >
                            <Icon className="h-3 w-3" strokeWidth={3} />
                          </span>
                          <span className={cn("font-medium", opt.textClass)}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Origem">
                  <Select
                    value={form.source}
                    onValueChange={(v: SupportTicket["source"]) =>
                      setForm((prev) => ({ ...prev, source: v }))
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </Card>

          {/* 5. Ações */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl cursor-pointer"
              onClick={() => void navigate({ to: "/chamados" })}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || requiredMissing}
              className="h-11 rounded-xl cursor-pointer shadow-[0_10px_22px_rgba(11,151,196,0.18)]"
            >
              <Send className="mr-1.5 h-4 w-4" />
              {submitting ? "Criando..." : "Criar chamado"}
            </Button>
          </div>
        </div>

        {/* Resumo lateral */}
        <aside>
          <Card className="sticky top-6 rounded-[16px] border border-border/70 bg-card p-5">
            <SectionTitle
              icon={MessageSquarePlus}
              title="Resumo"
              description="Prévia do chamado em tempo real."
            />

            <div className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {form.subject.trim() || "Assunto do chamado"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {client?.acronym ?? "COD"}
                    </span>
                    {" · "}
                    {client?.fantasia || client?.name || "Cliente"}
                  </p>
                  {selectedCompany && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {selectedCompany.companyNumber
                          ? String(selectedCompany.companyNumber).padStart(3, "0")
                          : "—"}
                      </span>
                      {" · "}
                      {selectedCompany.tradeName || selectedCompany.legalName}
                      {selectedCompany.document ? ` · ${selectedCompany.document}` : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <PreviewItem icon={UserRound} label="Contato" value={form.contactName || "-"} />
                <PreviewItem
                  icon={FileText}
                  label="Módulo"
                  value={`${form.module} / ${form.submodule || "-"}`}
                />
                <PreviewItem
                  icon={UserRound}
                  label="Responsável"
                  value={
                    selectedOwner
                      ? `${selectedOwner.acronym ?? ""}${selectedOwner.acronym ? " · " : ""}${selectedOwner.name}`
                      : operatorObj?.code || "-"
                  }
                />
                <PreviewItem icon={FileText} label="Tipo" value={form.type} />
                <PreviewItem icon={Phone} label="Origem" value={form.source} />
                <PreviewItem
                  icon={FileText}
                  label="Prioridade"
                  value={form.priority === "Media" ? "Média" : form.priority}
                />
              </div>

              <Badge
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px]",
                  priorityTone[form.priority],
                )}
              >
                Prioridade {form.priority === "Media" ? "Média" : form.priority}
              </Badge>
            </div>

            <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/6 p-4 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>
                  Clientes carregados diretamente da base do CRM. O chamado é registrado com o ID
                  real do cliente selecionado.
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />O chamado entrará como Em Aberto.
            </div>
          </Card>
        </aside>
      </form>
    </AppShell>
  );
}

// -----------------------------------------------------------------------------
// Auxiliares
// -----------------------------------------------------------------------------

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-[12px] font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function PreviewItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="inline-flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-0.5 truncate font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ContactSelectField({
  icon: Icon,
  kind,
  disabled,
  loading,
  options,
  value,
  placeholder,
  onChange,
}: {
  icon: typeof Mail;
  kind: "email" | "phone";
  disabled?: boolean;
  loading?: boolean;
  options: ClientContact[];
  value: string;
  placeholder: string;
  onChange: (id: string) => void;
}) {
  const hasOptions = options.length > 0;
  return (
    <div className="relative w-full">
      <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Select value={value} onValueChange={onChange} disabled={disabled || loading || !hasOptions}>
        <SelectTrigger className="h-11 w-full rounded-xl pl-9 cursor-pointer">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id} className="cursor-pointer">
              {kind === "email"
                ? `${opt.value} - ${opt.name}`
                : `${formatPhoneDisplay(opt.value)} | ${opt.name}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
