export type Priority = "Baixa" | "Média" | "Alta" | "Crítica";
export type CardType = "Suporte" | "Melhoria" | "Bug" | "Implantação" | "Documentação";
export type ColumnId = string;

export type KanbanMember = {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl?: string;
};

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  checklistTitle?: string;
};
export type CommentEntry = { id: string; authorId: string; at: string; text: string };
export type ActivityEntry = { id: string; at: string; text: string; authorId?: string };
export type AttachmentItem = {
  id: string;
  name: string;
  size: string;
  kind: string;
  url?: string;
};
export type RelatedArticle = { id: string; title: string; category: string };
export type RelatedVersion = { id: string; version: string; date: string; note: string };

export type KanbanCard = {
  id: string;
  columnId: ColumnId;
  title: string;
  summary: string;
  client: string;
  module: string;
  priority: Priority;
  type: CardType;
  assigneeId: string;
  dueDate: string; // ISO
  dueTime?: string;
  startDate?: string;
  recurrence?: string;
  reminder?: string;
  tags: string[];
  tagColors?: Record<string, string>;
  comments: number;
  attachments: number;
  archived?: boolean;
  description?: string;
  participants?: string[];
  checklist?: ChecklistItem[];
  commentsList?: CommentEntry[];
  activity?: ActivityEntry[];
  attachmentsList?: AttachmentItem[];
  relatedArticles?: RelatedArticle[];
  relatedVersions?: RelatedVersion[];
};

export type KanbanColumn = {
  id: ColumnId;
  title: string;
};

export const kanbanMembers: KanbanMember[] = [
  {
    id: "u-ar",
    name: "PRCGGC",
    initials: "GG",
    color: "bg-primary/15 text-primary",
    avatarUrl: "https://i.pravatar.cc/96?img=47",
  },
  {
    id: "u-bl",
    name: "Bruno Lima",
    initials: "BL",
    color: "bg-accent/20 text-accent-foreground",
    avatarUrl: "https://i.pravatar.cc/96?img=12",
  },
  {
    id: "u-ms",
    name: "Marina Souza",
    initials: "MS",
    color: "bg-success/15 text-success",
    avatarUrl: "https://i.pravatar.cc/96?img=33",
  },
  {
    id: "u-rt",
    name: "Rafael Torres",
    initials: "RT",
    color: "bg-warning/25 text-warning-foreground",
    avatarUrl: "https://i.pravatar.cc/96?img=59",
  },
  {
    id: "u-ca",
    name: "Camila Alves",
    initials: "CA",
    color: "bg-primary/15 text-primary",
    avatarUrl: "https://i.pravatar.cc/96?img=15",
  },
  {
    id: "u-jp",
    name: "João Prado",
    initials: "JP",
    color: "bg-accent/20 text-accent-foreground",
    avatarUrl: "https://i.pravatar.cc/96?img=52",
  },
];

export const kanbanColumnsDef: KanbanColumn[] = [
  { id: "a-fazer", title: "Novo chamado" },
  { id: "em-andamento", title: "Em atendimento" },
  { id: "concluido", title: "Aguardando cliente" },
  { id: "homologacao", title: "Em homologação" },
  { id: "arquivado", title: "Finalizado" },
];

export const kanbanClients = [
  "Vega Distribuidora",
  "Alpha Comércio",
  "Órion Serviços",
  "Nébula Indústria",
  "Cetus Logística",
  "Lyra Farmácias",
] as const;

export const kanbanModules = [
  "ERP - Fiscal",
  "ERP - Financeiro",
  "ERP - Estoque",
  "ERP - Produção",
  "ERP - Compras",
  "NF-e / SPED",
  "Logística",
  "Portal do Cliente",
  "Integrações",
  "Infraestrutura",
] as const;

const today = new Date();
const daysFromNow = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const initialCards: KanbanCard[] = [
  {
    id: "PRC-1024",
    columnId: "a-fazer",
    title: "Rejeição NF-e 539 na filial de Curitiba",
    summary: "Cliente relata rejeição intermitente ao transmitir notas acima de R$ 50 mil.",
    client: "Vega Distribuidora",
    module: "NF-e / SPED",
    priority: "Alta",
    type: "Bug",
    assigneeId: "u-bl",
    dueDate: daysFromNow(3),
    tags: ["fiscal", "nf-e"],
    comments: 4,
    attachments: 2,
  },
  {
    id: "PRC-1025",
    columnId: "a-fazer",
    title: "Novo relatório de curva ABC de estoque",
    summary: "Solicitação de relatório com filtros por CD e período customizado.",
    client: "Nébula Indústria",
    module: "ERP - Estoque",
    priority: "Média",
    type: "Melhoria",
    assigneeId: "u-ms",
    dueDate: daysFromNow(10),
    tags: ["estoque", "relatório"],
    comments: 2,
    attachments: 0,
  },
  {
    id: "PRC-1026",
    columnId: "a-fazer",
    title: "Documentar API pública de pedidos",
    summary: "Endpoints REST v2 de criação, consulta e cancelamento de pedidos.",
    client: "Interno",
    module: "Integrações",
    priority: "Baixa",
    type: "Documentação",
    assigneeId: "u-ca",
    dueDate: daysFromNow(14),
    tags: ["api", "docs"],
    comments: 1,
    attachments: 0,
  },
  {
    id: "PRC-1030",
    columnId: "a-fazer",
    title: "Lentidão ao gerar SPED Contribuições",
    summary: "Empresas com mais de 20 mil notas/mês estão levando mais de 30 min.",
    client: "Alpha Comércio",
    module: "NF-e / SPED",
    priority: "Crítica",
    type: "Suporte",
    assigneeId: "u-ar",
    dueDate: daysFromNow(1),
    tags: ["fiscal", "performance"],
    comments: 7,
    attachments: 3,
  },
  {
    id: "PRC-1031",
    columnId: "a-fazer",
    title: "Erro no rateio de comissão por vendedor",
    summary: "Rateio ignora devoluções lançadas no mesmo mês da venda original.",
    client: "Lyra Farmácias",
    module: "ERP - Financeiro",
    priority: "Alta",
    type: "Bug",
    assigneeId: "u-jp",
    dueDate: daysFromNow(4),
    tags: ["financeiro", "comissão"],
    comments: 3,
    attachments: 1,
  },
  {
    id: "PRC-1040",
    columnId: "em-andamento",
    title: "Implantação módulo de Produção - fase 2",
    summary: "Configuração de roteiros e apontamento por célula. Kick-off realizado.",
    client: "Nébula Indústria",
    module: "ERP - Produção",
    priority: "Alta",
    type: "Implantação",
    assigneeId: "u-rt",
    dueDate: daysFromNow(21),
    tags: ["implantação", "produção"],
    comments: 12,
    attachments: 5,
  },
  {
    id: "PRC-1041",
    columnId: "em-andamento",
    title: "Integração WMS com módulo de Logística",
    summary: "Sincronizar separação, conferência e expedição em tempo real.",
    client: "Cetus Logística",
    module: "Logística",
    priority: "Alta",
    type: "Melhoria",
    assigneeId: "u-bl",
    dueDate: daysFromNow(9),
    tags: ["logística", "wms", "integração"],
    comments: 6,
    attachments: 2,
  },
  {
    id: "PRC-1042",
    columnId: "em-andamento",
    title: "Redesign da tela de conciliação bancária",
    summary: "Nova experiência com match automático e sugestões.",
    client: "Interno",
    module: "ERP - Financeiro",
    priority: "Média",
    type: "Melhoria",
    assigneeId: "u-ar",
    dueDate: daysFromNow(15),
    tags: ["financeiro", "ux"],
    comments: 4,
    attachments: 1,
  },
  {
    id: "PRC-1050",
    columnId: "em-andamento",
    title: "Validação de layout de boleto personalizado",
    summary: "Aguardando aprovação do time financeiro do cliente.",
    client: "Alpha Comércio",
    module: "ERP - Financeiro",
    priority: "Média",
    type: "Suporte",
    assigneeId: "u-ms",
    dueDate: daysFromNow(2),
    tags: ["financeiro", "boleto"],
    comments: 2,
    attachments: 4,
  },
  {
    id: "PRC-1051",
    columnId: "em-andamento",
    title: "Confirmação de dados para migração de estoque",
    summary: "Cliente precisa validar planilha de saldo inicial dos CDs.",
    client: "Vega Distribuidora",
    module: "ERP - Estoque",
    priority: "Alta",
    type: "Implantação",
    assigneeId: "u-rt",
    dueDate: daysFromNow(5),
    tags: ["estoque", "migração"],
    comments: 3,
    attachments: 2,
  },
  {
    id: "PRC-1060",
    columnId: "concluido",
    title: "Release 2026.3.1 - homologação com cliente piloto",
    summary: "Testes de emissão fiscal, kanban e pix automático.",
    client: "Órion Serviços",
    module: "ERP - Fiscal",
    priority: "Alta",
    type: "Melhoria",
    assigneeId: "u-ca",
    dueDate: daysFromNow(6),
    tags: ["release", "homologação"],
    comments: 9,
    attachments: 3,
  },
  {
    id: "PRC-1061",
    columnId: "concluido",
    title: "Pix Automático - fluxo de cobrança recorrente",
    summary: "Validando webhooks e reconciliação automática.",
    client: "Lyra Farmácias",
    module: "ERP - Financeiro",
    priority: "Média",
    type: "Melhoria",
    assigneeId: "u-jp",
    dueDate: daysFromNow(8),
    tags: ["financeiro", "pix"],
    comments: 5,
    attachments: 1,
  },
  {
    id: "PRC-1070",
    columnId: "concluido",
    title: "Correção no cálculo de ICMS ST para SC",
    summary: "Alíquota atualizada conforme convênio ICMS 142/2024.",
    client: "Nébula Indústria",
    module: "ERP - Fiscal",
    priority: "Alta",
    type: "Bug",
    assigneeId: "u-bl",
    dueDate: daysFromNow(-2),
    tags: ["fiscal", "icms"],
    comments: 6,
    attachments: 2,
  },
  {
    id: "PRC-1071",
    columnId: "concluido",
    title: "Migração de autenticação para 2FA obrigatório",
    summary: "Concluído para perfis administrativos e master.",
    client: "Interno",
    module: "Infraestrutura",
    priority: "Alta",
    type: "Melhoria",
    assigneeId: "u-ar",
    dueDate: daysFromNow(-5),
    tags: ["segurança", "2fa"],
    comments: 4,
    attachments: 0,
  },
  {
    id: "PRC-1072",
    columnId: "concluido",
    title: "Publicação release notes 2026.3.0",
    summary: "Notas de versão publicadas no Portal Prócion.",
    client: "Interno",
    module: "Portal do Cliente",
    priority: "Baixa",
    type: "Documentação",
    assigneeId: "u-ca",
    dueDate: daysFromNow(-7),
    tags: ["release", "docs"],
    comments: 2,
    attachments: 1,
  },
];

export const priorityMeta: Record<
  Priority,
  { badge: string; dot: string; strip: string; ring?: string }
> = {
  Baixa: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    strip: "bg-emerald-500",
  },
  Média: {
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-400",
    strip: "bg-amber-400",
  },
  Alta: {
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    strip: "bg-rose-500",
  },
  Crítica: {
    badge: "bg-red-600/15 text-red-700 dark:text-red-300",
    dot: "bg-red-600",
    strip: "bg-red-600",
    ring: "ring-1 ring-destructive/40",
  },
};

export const typeMeta: Record<CardType, string> = {
  Suporte: "bg-primary/10 text-primary",
  Melhoria: "bg-success/15 text-success",
  Bug: "bg-destructive/10 text-destructive",
  Implantação: "bg-accent/20 text-accent-foreground",
  Documentação: "bg-secondary text-secondary-foreground",
};

export const priorities: Priority[] = ["Baixa", "Média", "Alta", "Crítica"];
export const cardTypes: CardType[] = ["Suporte", "Melhoria", "Bug", "Implantação", "Documentação"];

export const kbArticles: RelatedArticle[] = [
  { id: "KB-201", title: "Rejeição 539 na NF-e: causas e soluções", category: "Fiscal" },
  { id: "KB-202", title: "Configurando lote de transmissão de NF-e", category: "Fiscal" },
  { id: "KB-118", title: "Performance na geração do SPED Contribuições", category: "Fiscal" },
  { id: "KB-305", title: "Curva ABC de estoque: parâmetros e filtros", category: "Estoque" },
  { id: "KB-410", title: "Rateio de comissão x devoluções", category: "Financeiro" },
  { id: "KB-512", title: "Integração WMS: mapeamento de eventos", category: "Logística" },
];

export const kbVersions: RelatedVersion[] = [
  {
    id: "V-2026.3.1",
    version: "2026.3.1",
    date: "2026-06-28",
    note: "Ajustes fiscais e Pix automático",
  },
  {
    id: "V-2026.3.0",
    version: "2026.3.0",
    date: "2026-05-30",
    note: "Novo módulo de produção fase 2",
  },
  { id: "V-2026.2.4", version: "2026.2.4", date: "2026-04-12", note: "Hotfix ICMS ST / SC" },
];

// Enriquecer alguns cards de exemplo com dados detalhados
const enrich = (id: string, data: Partial<KanbanCard>) => {
  const idx = initialCards.findIndex((c) => c.id === id);
  if (idx !== -1) initialCards[idx] = { ...initialCards[idx], ...data };
};

enrich("PRC-1024", {
  description:
    "Cliente relata rejeição intermitente ao transmitir notas acima de R$ 50 mil na filial de Curitiba.\n\nCritérios de aceite:\n• Reproduzir o cenário em ambiente de homologação\n• Ajustar validação de XML no gerador de NF-e\n• Publicar hotfix na versão 2026.3.2\n\nImpacto: bloqueio parcial de faturamento em 3 filiais.",
  participants: ["u-bl", "u-ar", "u-jp"],
  checklist: [
    { id: "ck-1", text: "Reproduzir rejeição em homologação", done: true },
    { id: "ck-2", text: "Analisar payload XML enviado à SEFAZ-PR", done: true },
    { id: "ck-3", text: "Ajustar validação do campo vBC", done: false },
    { id: "ck-4", text: "Criar teste automatizado no pipeline fiscal", done: false },
    { id: "ck-5", text: "Publicar hotfix 2026.3.2", done: false },
  ],
  commentsList: [
    {
      id: "cm-1",
      authorId: "u-ar",
      at: daysFromNow(-2) + "T09:20:00",
      text: "Consegui reproduzir no ambiente de homologação. O erro ocorre quando o valor do ICMS ST é zero e há desconto no item.",
    },
    {
      id: "cm-2",
      authorId: "u-bl",
      at: daysFromNow(-1) + "T14:05:00",
      text: "Abri chamado paralelo com a SEFAZ-PR pedindo detalhamento da regra de validação. Enquanto isso, vamos ajustar no gerador.",
    },
    {
      id: "cm-3",
      authorId: "u-jp",
      at: daysFromNow(0) + "T08:40:00",
      text: "Sugestão: adicionar log estruturado no envio do lote para facilitar triagem futura.",
    },
  ],
  activity: [
    {
      id: "ac-1",
      at: daysFromNow(-4) + "T10:00:00",
      text: "Card criado por PRCGGC",
      authorId: "u-ar",
    },
    {
      id: "ac-2",
      at: daysFromNow(-3) + "T11:30:00",
      text: "Prioridade alterada de Média para Alta",
      authorId: "u-ar",
    },
    {
      id: "ac-3",
      at: daysFromNow(-2) + "T09:15:00",
      text: "Responsável definido: Bruno Lima",
      authorId: "u-ar",
    },
    {
      id: "ac-4",
      at: daysFromNow(-1) + "T16:00:00",
      text: "Movido de Backlog para Triagem",
      authorId: "u-bl",
    },
  ],
  attachmentsList: [
    { id: "at-1", name: "xml-rejeitado-539.xml", size: "48 KB", kind: "xml" },
    { id: "at-2", name: "log-transmissao-sefaz.txt", size: "112 KB", kind: "log" },
  ],
  relatedArticles: [kbArticles[0], kbArticles[1]],
  relatedVersions: [kbVersions[0], kbVersions[2]],
});

enrich("PRC-1030", {
  description:
    "Empresas com mais de 20 mil notas/mês estão levando mais de 30 minutos para gerar o SPED Contribuições.\n\nHipóteses:\n• Query de apuração sem índice adequado\n• Falta de paginação no processamento em lote",
  participants: ["u-ar", "u-jp"],
  checklist: [
    { id: "ck-1", text: "Coletar plano de execução em ambiente do cliente", done: true },
    { id: "ck-2", text: "Criar índice em fis_apuracao(data, empresa)", done: false },
    { id: "ck-3", text: "Aplicar processamento em lote de 5 mil registros", done: false },
  ],
  commentsList: [
    {
      id: "cm-1",
      authorId: "u-ar",
      at: daysFromNow(-1) + "T10:00:00",
      text: "Plano de execução confirma sequential scan em fis_apuracao. Índice deve resolver.",
    },
  ],
  activity: [
    {
      id: "ac-1",
      at: daysFromNow(-2) + "T08:00:00",
      text: "Card criado por PRCGGC",
      authorId: "u-ar",
    },
    {
      id: "ac-2",
      at: daysFromNow(-1) + "T09:00:00",
      text: "Movido para Triagem",
      authorId: "u-ar",
    },
  ],
  attachmentsList: [{ id: "at-1", name: "plano-execucao.sql", size: "3 KB", kind: "sql" }],
  relatedArticles: [kbArticles[2]],
  relatedVersions: [kbVersions[0]],
});
