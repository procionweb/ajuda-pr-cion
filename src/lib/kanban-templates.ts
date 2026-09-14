import type { KanbanCard } from "./kanban-data";

export type KanbanCardTemplate = {
  id: string;
  name: string;
  title: string;
  summary: string;
  description: string;
  module: string;
  priority: KanbanCard["priority"];
  type: KanbanCard["type"];
  tags: string[];
  checklist: NonNullable<KanbanCard["checklist"]>;
};

const defaultTemplates: KanbanCardTemplate[] = [
  {
    id: "template-bug-fiscal",
    name: "Erro fiscal",
    title: "Erro na emissão de documento fiscal",
    summary: "Validar rejeicao, ambiente, XML e retorno da SEFAZ.",
    description: "Descreva a mensagem apresentada, o documento afetado e os passos para reproduzir.",
    module: "NF-e / SPED",
    priority: "Alta",
    type: "Bug",
    tags: ["fiscal", "nf-e"],
    checklist: [
      { id: "tpl-fiscal-1", text: "Coletar XML e mensagem completa", done: false, checklistTitle: "Diagnostico" },
      { id: "tpl-fiscal-2", text: "Validar retorno da SEFAZ", done: false, checklistTitle: "Diagnostico" },
    ],
  },
  {
    id: "template-implantacao",
    name: "Implantação de módulo",
    title: "Implantação de módulo",
    summary: "Planejar configuração, validação e entrega do módulo ao cliente.",
    description: "Registre o escopo, dependencias, responsaveis e criterio de aceite.",
    module: "ERP - Fiscal",
    priority: "Média",
    type: "Implantação",
    tags: ["implantacao"],
    checklist: [
      { id: "tpl-impl-1", text: "Confirmar escopo com o cliente", done: false, checklistTitle: "Implantacao" },
      { id: "tpl-impl-2", text: "Configurar ambiente", done: false, checklistTitle: "Implantacao" },
      { id: "tpl-impl-3", text: "Validar com usuário-chave", done: false, checklistTitle: "Implantação" },
    ],
  },
  {
    id: "template-melhoria",
    name: "Solicitacao de melhoria",
    title: "Melhoria de processo",
    summary: "Analisar impacto e definir criterio de aceite para a melhoria.",
    description: "Descreva o comportamento atual, o resultado esperado e o ganho para o usuário.",
    module: "ERP - Financeiro",
    priority: "Média",
    type: "Melhoria",
    tags: ["melhoria"],
    checklist: [
      { id: "tpl-melh-1", text: "Mapear comportamento atual", done: false, checklistTitle: "Análise" },
      { id: "tpl-melh-2", text: "Definir critério de aceite", done: false, checklistTitle: "Análise" },
    ],
  },
];

const normalizeTemplate = (template: KanbanCardTemplate): KanbanCardTemplate => ({
  ...template,
  tags: template.tags ?? [],
  checklist: template.checklist ?? [],
});

export function templateToCard(template: KanbanCardTemplate, columnId: string): KanbanCard {
  const now = Date.now().toString(36);
  return {
    id: "",
    columnId,
    title: template.title,
    summary: template.summary,
    description: template.description,
    client: "Vega Distribuidora",
    module: template.module,
    priority: template.priority,
    type: template.type,
    assigneeId: "u-ar",
    dueDate: new Date().toISOString().slice(0, 10),
    tags: [...template.tags],
    comments: 0,
    attachments: 0,
    participants: [],
    checklist: template.checklist.map((item, index) => ({
      ...item,
      id: `ck-${now}-${index}`,
      done: false,
    })),
    commentsList: [],
    activity: [],
    attachmentsList: [],
    relatedArticles: [],
    relatedVersions: [],
  };
}
