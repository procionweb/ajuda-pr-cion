export type TicketStatus =
  | "Atrasado"
  | "Em Aberto"
  | "Ocupado"
  | "Em andamento"
  | "Aguardando cliente"
  | "Com especialista"
  | "Agendamento"
  | "Finalizado"
  | "Cancelado";

export type TicketPriority = "Alta" | "Media" | "Baixa";

export type SupportTicket = {
  id: string;
  protocol: string;
  status: TicketStatus;
  priority: TicketPriority;
  openedAt: string;
  updatedAt: string;
  /** Data/hora exata da finalização. Congela o cálculo de SLA. */
  closedAt?: string | null;
  /** Primeiro instante em que o atendimento foi iniciado. Congela o SLA de espera. */
  attendanceStartedAt?: string | null;
  /** Início do trecho ativo atual do atendimento. Nulo enquanto pausado. */
  attendanceRunningSince?: string | null;
  /** Tempo ativo acumulado antes do trecho atual, em segundos. */
  attendanceElapsedSeconds?: number;

  attendant: string;
  owner: string;
  /** ID real do colaborador responsável (tab_colaboradores). */
  ownerId?: string | null;
  clientCode: string;
  clientName: string;
  contact: string;
  contactPhone?: string | null;
  subject: string;
  module: string;
  source: "Telefone" | "Portal do cliente" | "WhatsApp" | "Email";
  lockedBy?: string;
  description?: string;
  /** Resumo técnico da descrição gerado por IA no backend (nunca substitui a descrição). */
  descriptionSummary?: string | null;
  // Empresa/subempresa escolhida no momento da abertura.
  companyId?: string | null;
  companyNumber?: number | null;
  companyName?: string;
  companyDocument?: string;
  hadronOption?: string;
  permission?: "Público" | "Clientes" | "Empresa";
  relatedArticles?: string[];
  relatedForms?: string[];
};

export const ticketStatuses: TicketStatus[] = [
  "Atrasado",
  "Em Aberto",
  "Ocupado",
  "Em andamento",
  "Aguardando cliente",
  "Com especialista",
  "Agendamento",
  "Finalizado",
  "Cancelado",
];

export const supportTickets: SupportTicket[] = [
  {
    id: "43730",
    protocol: "PRC-1783455001",
    status: "Em andamento",
    priority: "Alta",
    openedAt: "2026-07-08T09:12:00",
    updatedAt: "2026-07-08T10:05:00",
    attendant: "PRCSUZ",
    owner: "PRCGGC",
    clientCode: "",
    clientName: "",
    contact: "Roberto",
    subject: "Erro ao emitir NFe",
    module: "Vendas - NFE",
    source: "Telefone",
  },
  {
    id: "43705",
    protocol: "PRC-1783445220",
    status: "Finalizado",
    priority: "Media",
    openedAt: "2026-07-04T14:30:00",
    updatedAt: "2026-07-04T16:12:00",
    attendant: "PRCSUZ",
    owner: "PRCROG",
    clientCode: "",
    clientName: "",
    contact: "Roberto",
    subject: "Ajuste de aliquota ICMS",
    module: "Fiscal",
    source: "Portal do cliente",
  },
  {
    id: "43642",
    protocol: "PRC-1783432110",
    status: "Finalizado",
    priority: "Baixa",
    openedAt: "2026-06-28T10:15:00",
    updatedAt: "2026-06-28T11:40:00",
    attendant: "PRCSUZ",
    owner: "PRCLCZ",
    clientCode: "",
    clientName: "",
    contact: "Larissa",
    subject: "Treinamento cadastro de produtos",
    module: "Basico - Terceiros",
    source: "Email",
  },
  {

    id: "43725",
    protocol: "PRC-1783454392",
    status: "Em Aberto",
    priority: "Alta",
    openedAt: "2026-07-08T08:18:00",
    updatedAt: "2026-07-08T08:24:00",
    attendant: "PRCSUZ",
    owner: "PRCGGC",
    clientCode: "",
    clientName: "",
    contact: "Samuel",
    subject: "Nota em processamento",
    module: "Vendas - NFE",
    source: "Telefone",
  },
  {
    id: "43724",
    protocol: "PRC-1783454359",
    status: "Em Aberto",
    priority: "Media",
    openedAt: "2026-07-08T08:03:00",
    updatedAt: "2026-07-08T08:17:00",
    attendant: "PRCSUZ",
    owner: "PRCROG",
    clientCode: "",
    clientName: "",
    contact: "Vanderley",
    subject: "Nota fiscal não autorizada",
    module: "Vendas - NFE",
    source: "Portal do cliente",
  },
  {
    id: "43722",
    protocol: "PRC-1783453236",
    status: "Em andamento",
    priority: "Media",
    openedAt: "2026-07-08T07:44:00",
    updatedAt: "2026-07-08T09:36:00",
    attendant: "PRCSUZ",
    owner: "PRCROG",
    clientCode: "",
    clientName: "",
    contact: "Carla",
    subject: "Cupom não apareceu no financeiro",
    module: "Basico - Terceiros",
    source: "WhatsApp",
  },
  {
    id: "43721",
    protocol: "PRC-1783452521",
    status: "Com especialista",
    priority: "Alta",
    openedAt: "2026-07-08T07:21:00",
    updatedAt: "2026-07-08T09:01:00",
    attendant: "PRCSUZ",
    owner: "PRCPED",
    clientCode: "",
    clientName: "",
    contact: "Elisangela",
    subject: "Alterar endereço do terceiro",
    module: "Basico - Terceiros",
    source: "Telefone",
  },
  {
    id: "43720",
    protocol: "PRC-1783452475",
    status: "Aguardando cliente",
    priority: "Baixa",
    openedAt: "2026-07-08T06:58:00",
    updatedAt: "2026-07-08T08:40:00",
    attendant: "PRCSUZ",
    owner: "PRCLCZ",
    clientCode: "",
    clientName: "",
    contact: "Camila",
    subject: "Configurar impressora",
    module: "Basico - Terceiros",
    source: "Portal do cliente",
  },
  {
    id: "43716",
    protocol: "PRC-1783450423",
    status: "Ocupado",
    priority: "Alta",
    openedAt: "2026-07-07T15:53:00",
    updatedAt: "2026-07-08T08:53:00",
    attendant: "PRCSUZ",
    owner: "PRCGGC",
    clientCode: "",
    clientName: "",
    contact: "Fernanda",
    subject: "Nota fiscal com rejeicao",
    module: "Vendas - NFE",
    source: "Telefone",
    lockedBy: "PRCGGC",
  },
  {
    id: "43698",
    protocol: "PRC-1783442611",
    status: "Agendamento",
    priority: "Media",
    openedAt: "2026-07-07T13:43:00",
    updatedAt: "2026-07-08T07:58:00",
    attendant: "PRCSUZ",
    owner: "PRCTRE",
    clientCode: "",
    clientName: "",
    contact: "Paola",
    subject: "Treinamento Hadron Web",
    module: "Hadron Web",
    source: "Email",
  },
  {
    id: "43691",
    protocol: "PRC-1783441953",
    status: "Atrasado",
    priority: "Alta",
    openedAt: "2026-07-06T13:32:00",
    updatedAt: "2026-07-07T14:17:00",
    attendant: "PRCSUZ",
    owner: "PRCGGC",
    clientCode: "",
    clientName: "",
    contact: "Caio",
    subject: "Carta de correcao",
    module: "Vendas - NFE",
    source: "Telefone",
  },
  {
    id: "43353",
    protocol: "PRC-1783377194",
    status: "Finalizado",
    priority: "Baixa",
    openedAt: "2026-07-05T09:16:00",
    updatedAt: "2026-07-05T11:02:00",
    attendant: "PRCSUZ",
    owner: "PRCGGC",
    clientCode: "",
    clientName: "",
    contact: "Marcos",
    subject: "Dúvida sobre relatório de estoque",
    module: "Estoque",
    source: "Portal do cliente",
  },
  {
    id: "43295",
    protocol: "PRC-1783369781",
    status: "Cancelado",
    priority: "Baixa",
    openedAt: "2026-07-04T10:02:00",
    updatedAt: "2026-07-04T10:21:00",
    attendant: "PRCSUZ",
    owner: "PRCSUZ",
    clientCode: "",
    clientName: "",
    contact: "Bruno",
    subject: "Chamado duplicado",
    module: "Financeiro",
    source: "WhatsApp",
  },
];

export const dailyTicketAnalytics = [
  { day: "Qui", opened: 31, finished: 26, overdue: 7 },
  { day: "Sex", opened: 42, finished: 33, overdue: 9 },
  { day: "Sab", opened: 14, finished: 18, overdue: 4 },
  { day: "Dom", opened: 8, finished: 10, overdue: 3 },
  { day: "Seg", opened: 57, finished: 44, overdue: 12 },
  { day: "Ter", opened: 63, finished: 51, overdue: 15 },
  { day: "Qua", opened: 48, finished: 39, overdue: 11 },
];

export const weeklyTicketAnalytics = [
  { week: "Sem 23", opened: 215, finished: 202, backlog: 74 },
  { week: "Sem 24", opened: 238, finished: 221, backlog: 91 },
  { week: "Sem 25", opened: 251, finished: 248, backlog: 94 },
  { week: "Sem 26", opened: 276, finished: 252, backlog: 118 },
  { week: "Sem 27", opened: 263, finished: 241, backlog: 140 },
  { week: "Sem 28", opened: 287, finished: 259, backlog: 168 },
];
