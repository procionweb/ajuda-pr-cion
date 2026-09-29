import { useEffect, useMemo, useState } from "react";
import { Building2, Globe2, LayoutGrid, LockKeyhole, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  addWorkspaceMember,
  createKanbanWorkspace,
  deleteKanbanWorkspace,
  listAvailableMembers,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateKanbanWorkspace,
  updateWorkspaceMemberRole,
  type BoardMember,
  type WorkspaceSummary,
} from "@/lib/kanban-api";

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  member: "Membro",
  guest: "Convidado",
};

const defaultSettings: WorkspaceSummary["settings"] = {
  memberRestriction: "admins",
  boardCreation: "members",
  boardDeletion: "admins",
  guestSharing: "admins",
};

const slugify = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export function WorkspaceModal({
  open,
  onOpenChange,
  workspace,
  initialTab = "settings",
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: WorkspaceSummary | null;
  initialTab?: "settings" | "members";
  onChanged: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [settings, setSettings] = useState<WorkspaceSummary["settings"]>(defaultSettings);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [available, setAvailable] = useState<BoardMember[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setName(workspace?.name ?? "");
    setSlug(workspace?.slug ?? "");
    setWebsite(workspace?.website ?? "");
    setDescription(workspace?.description ?? "");
    setVisibility(workspace?.visibility ?? "private");
    setSettings(workspace?.settings ?? defaultSettings);
    if (!workspace) return;
    Promise.all([
      listWorkspaceMembers({ data: { workspaceId: workspace.id } }),
      listAvailableMembers(),
    ]).then(([memberResult, availableResult]) => {
      setMembers(memberResult.members ?? []);
      setAvailable(availableResult.members ?? []);
    }).catch(() => toast.error("Não foi possível carregar os membros."));
  }, [initialTab, open, workspace]);

  const candidates = useMemo(() => {
    const ids = new Set(members.map((member) => member.id));
    const normalized = query.trim().toLowerCase();
    return available.filter((member) => {
      if (ids.has(member.id)) return false;
      return !normalized || `${member.name} ${member.operator ?? ""} ${member.email ?? ""}`.toLowerCase().includes(normalized);
    }).slice(0, 6);
  }, [available, members, query]);

  const save = async () => {
    if (!name.trim()) return toast.error("Informe o nome da área de trabalho.");
    const normalizedSlug = slugify(slug || name);
    if (!normalizedSlug) return toast.error("Informe um nome curto válido.");
    setSaving(true);
    try {
      if (workspace) {
        await updateKanbanWorkspace({ data: { id: workspace.id, name: name.trim(), slug: normalizedSlug, website: website.trim(), description: description.trim(), visibility, settings } });
        toast.success("Área de trabalho atualizada.");
      } else {
        await createKanbanWorkspace({ data: { name: name.trim(), slug: normalizedSlug, website: website.trim(), description: description.trim(), visibility, settings } });
        toast.success("Área de trabalho criada.");
      }
      onChanged();
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar a área de trabalho.");
    } finally {
      setSaving(false);
    }
  };

  const addMember = async (member: BoardMember) => {
    if (!workspace) return;
    try {
      await addWorkspaceMember({ data: { workspaceId: workspace.id, profileId: member.id, role: "member" } });
      setMembers((current) => [...current, { ...member, role: "member" }]);
      toast.success("Membro adicionado.");
      onChanged();
    } catch {
      toast.error("Não foi possível adicionar o membro.");
    }
  };

  const deleteArea = async () => {
    if (!workspace || !window.confirm(`Excluir a área "${workspace.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await deleteKanbanWorkspace({ data: { workspaceId: workspace.id } });
      toast.success("Área excluída.");
      onChanged();
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível excluir. Verifique se a área não possui quadros, inclusive arquivados.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl [&>button]:hidden" onInteractOutside={(event) => event.preventDefault()}>
        <DialogTitle className="sr-only">{workspace ? workspace.name : "Criar área de trabalho"}</DialogTitle>

        <DetailModalHeader
          icon={Building2}
          title={workspace ? workspace.name : "Criar área de trabalho"}
          meta="Organize quadros, pessoas e permissões em um único espaço."
          onClose={() => onOpenChange(false)}
        />

        <div className="px-5 py-4">


        <Tabs value={workspace ? tab : "settings"} onValueChange={(value) => setTab(value as typeof tab)}>
          {workspace && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings" className="cursor-pointer">Configurações</TabsTrigger>
              <TabsTrigger value="members" className="cursor-pointer">Membros</TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <section className="rounded-md border bg-white p-4 dark:bg-slate-950">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
                <div><h3 className="text-sm font-medium">Identidade da área</h3><p className="text-xs text-slate-500">Informações exibidas nos quadros e convites.</p></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="workspace-name">Nome *</Label><Input id="workspace-name" value={name} onChange={(event) => { setName(event.target.value); if (!workspace) setSlug(slugify(event.target.value)); }} /></div>
                <div className="space-y-2"><Label htmlFor="workspace-slug">Nome curto *</Label><Input id="workspace-slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="desenvolvimento-procion" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="workspace-website">Site</Label><Input id="workspace-website" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://procion.com" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="workspace-description">Descrição</Label><Textarea id="workspace-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
              </div>
            </section>

            <section className="rounded-md border bg-white p-4 dark:bg-slate-950">
              <div className="mb-3 flex items-center gap-2"><Globe2 className="h-4 w-4 text-primary" /><h3 className="text-sm font-medium">Visibilidade</h3></div>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="private" className="cursor-pointer">Privada: somente membros convidados</SelectItem><SelectItem value="company" className="cursor-pointer">Empresa: todos da Prócion podem encontrar</SelectItem></SelectContent>
              </Select>
            </section>

            <section className="rounded-md border bg-white p-4 dark:bg-slate-950">
              <div className="mb-1 flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-primary" /><h3 className="text-sm font-medium">Regras administrativas</h3></div>
              <p className="mb-4 text-xs text-slate-500">Defina quem pode administrar pessoas, quadros e convidados.</p>
              <div className="divide-y rounded-md border">
                {([
                  ["memberRestriction", "Adicionar membros", "Quem pode convidar pessoas para esta área"],
                  ["boardCreation", "Criar quadros", "Quem pode criar novos quadros"],
                  ["boardDeletion", "Excluir quadros", "Quem pode remover quadros da área"],
                  ["guestSharing", "Convidar externos", "Quem pode compartilhar quadros com convidados"],
                ] as const).map(([key, title, detail]) => (
                  <div key={key} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                    <LayoutGrid className="h-4 w-4 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1"><p className="text-sm">{title}</p><p className="text-xs text-slate-500">{detail}</p></div>
                    <Select value={settings[key]} onValueChange={(value) => setSettings((current) => ({ ...current, [key]: value }))}>
                      <SelectTrigger className="w-full min-w-0 cursor-pointer gap-1 px-2 text-xs sm:w-48 [&>span]:min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="admins" className="cursor-pointer">Somente administradores</SelectItem><SelectItem value="members" className="cursor-pointer">Todos os membros</SelectItem></SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </section>

            {workspace && <section className="flex items-center justify-between gap-4 rounded-md border border-red-200 bg-white p-4 dark:border-red-900/60 dark:bg-slate-950"><div><h3 className="text-sm font-medium text-red-600">Excluir área de trabalho</h3><p className="text-xs text-slate-500">{(workspace.boardsCount ?? workspace.boards.length) > 0 ? "Remova ou transfira os quadros, inclusive arquivados, antes de excluir esta área." : "Esta área não possui quadros."}</p></div><Button variant="outline" disabled={deleting || (workspace.boardsCount ?? workspace.boards.length) > 0 || workspace.membershipRole !== "admin"} onClick={() => void deleteArea()} className="shrink-0 border-red-200 text-red-600"><Trash2 className="mr-2 h-4 w-4" />Excluir área</Button></section>}
          </TabsContent>
          {workspace && (
            <TabsContent value="members" className="mt-4 space-y-4">
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pessoa para adicionar" className="pl-9" /></div>
              {query && candidates.length > 0 && <div className="rounded-md border p-2">{candidates.map((member) => <button key={member.id} type="button" onClick={() => void addMember(member)} className="flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/5"><span><span className="block text-sm">{member.name}</span><span className="text-xs text-slate-500">{member.operator ?? member.email}</span></span><UserPlus className="h-4 w-4 text-primary" /></button>)}</div>}
              <div className="space-y-2">
                {members.length === 0 && <p className="rounded-md border border-dashed p-5 text-center text-sm text-slate-500">Nenhum membro adicionado.</p>}
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-md border p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs text-primary">{member.avatarUrl ? <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" /> : member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm">{member.name}{member.id === workspace.ownerId && <span className="ml-2 text-xs text-primary">Criador</span>}</p><p className="truncate text-xs text-slate-500">{member.operator ?? member.email}</p></div>
                    <Select disabled={member.id === workspace.ownerId} value={member.role ?? "member"} onValueChange={async (role) => { await updateWorkspaceMemberRole({ data: { workspaceId: workspace.id, profileId: member.id, role: role as "admin" | "member" | "guest" } }); setMembers((current) => current.map((item) => item.id === member.id ? { ...item, role } : item)); onChanged(); }}>
                      <SelectTrigger className="w-36 cursor-pointer"><ShieldCheck className="mr-1 h-4 w-4" /><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(roleLabel).map(([value, label]) => <SelectItem key={value} value={value} className="cursor-pointer">{label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" disabled={member.id === workspace.ownerId} className="cursor-pointer" onClick={async () => { await removeWorkspaceMember({ data: { workspaceId: workspace.id, profileId: member.id } }); setMembers((current) => current.filter((item) => item.id !== member.id)); onChanged(); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
        </div>

        <DialogFooter className="border-t border-border bg-card px-5 py-3">
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {(!workspace || tab === "settings") && <Button className="cursor-pointer" disabled={saving} onClick={() => void save()}>{saving ? "Salvando..." : workspace ? "Salvar" : "Criar área"}</Button>}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
