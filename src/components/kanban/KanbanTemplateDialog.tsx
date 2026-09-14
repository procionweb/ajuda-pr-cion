import { useState } from "react";
import { CopyPlus, FileStack, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { kanbanModules, priorities, cardTypes, type KanbanCard } from "@/lib/kanban-data";
import {
  type KanbanCardTemplate,
} from "@/lib/kanban-templates";
import { useCrmCatalog, trySaveCrmCatalog } from "@/lib/crm-catalog-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (template: KanbanCardTemplate) => void;
};

const blankTemplate = (): KanbanCardTemplate => ({
  id: `template-${Date.now().toString(36)}`,
  name: "",
  title: "",
  summary: "",
  description: "",
  module: kanbanModules[0],
  priority: priorities[1] as KanbanCard["priority"],
  type: cardTypes[0] as KanbanCard["type"],
  tags: [],
  checklist: [],
});

export function KanbanTemplateDialog({ open, onOpenChange, onUse }: Props) {
  const { items: templates } = useCrmCatalog<KanbanCardTemplate>("kanban_templates");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<KanbanCardTemplate>(blankTemplate);

  const createTemplate = async () => {
    if (!draft.name.trim() || !draft.title.trim()) {
      toast.error("Informe o nome do modelo e o título do cartão.");
      return;
    }
    const next = [
      {
        ...draft,
        name: draft.name.trim(),
        title: draft.title.trim(),
        tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
      },
    ];
    if (!await trySaveCrmCatalog("kanban_templates", next)) return;
    setCreating(false);
    setDraft(blankTemplate());
    toast.success("Template criado.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl [&>button]:hidden">
        <DialogTitle className="sr-only">Templates de cartões</DialogTitle>
        <DetailModalHeader
          icon={FileStack}
          title="Templates de cartões"
          meta="Padronize demandas recorrentes sem prender cliente, responsável ou prazo."
          onClose={() => onOpenChange(false)}
        />
        <div className="px-5 py-4">


        {creating ? (
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label>Nome do template</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Erro de emissão fiscal" /></div>
            <div className="space-y-2"><Label>Título inicial</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Título exibido no novo cartão" /></div>
            <div className="space-y-2"><Label>Módulo</Label><Select value={draft.module} onValueChange={(module) => setDraft({ ...draft, module })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{kanbanModules.map((module) => <SelectItem key={module} value={module}>{module}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Prioridade</Label><Select value={draft.priority} onValueChange={(priority) => setDraft({ ...draft, priority: priority as KanbanCard["priority"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Tipo</Label><Select value={draft.type} onValueChange={(type) => setDraft({ ...draft, type: type as KanbanCard["type"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cardTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Resumo</Label><Input value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="Contexto curto para orientar o preenchimento" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Descrição orientativa</Label><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="O que deve ser informado neste tipo de demanda" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Etiquetas</Label><Input value={draft.tags.join(", ")} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",") })} placeholder="fiscal, nf-e, urgente" /></div>
            <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button><Button onClick={createTemplate}>Salvar template</Button></div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((template) => (
                <div key={template.id} className="group rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-primary/40 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{template.name}</h3><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.title}</p></div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" title="Excluir template" onClick={() => void trySaveCrmCatalog("kanban_templates", [template], true)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground"><span className="rounded bg-muted px-2 py-1">{template.module}</span><span className="rounded bg-muted px-2 py-1">{template.priority}</span><span className="rounded bg-muted px-2 py-1">{template.type}</span></div>
                  <Button className="mt-4 w-full" variant="outline" onClick={() => onUse(template)}><CopyPlus className="mr-2 h-4 w-4" />Usar template</Button>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full border-dashed" onClick={() => { setDraft(blankTemplate()); setCreating(true); }}><Plus className="mr-2 h-4 w-4" />Criar novo template</Button>
          </>
        )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
