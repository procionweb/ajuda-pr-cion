import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Image, Link2, Mail, Palette, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createBoardInvite, listBoardInvites, listBoardMembers, revokeBoardInvite,
  updateKanbanBoard, uploadBoardBackground, type BoardInvite, type BoardMember, type BoardSummary,
} from "@/lib/kanban-api";

const COLORS = ["#0f766e", "#0369a1", "#4338ca", "#7c3aed", "#be123c", "#b45309", "#334155", "#18181b"];
const PHOTOS = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1800&q=85",
];

const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

export function BoardCollaborationDialog({ board, open, onOpenChange, initialTab = "share", onChanged }: {
  board: BoardSummary | null; open: boolean; onOpenChange: (value: boolean) => void;
  initialTab?: "share" | "background"; onChanged: () => void;
}) {
  const appOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [invites, setInvites] = useState<BoardInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "observer">("member");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeLinks = useMemo(() => invites.filter((item) => item.type === "link" && item.status === "pending"), [invites]);

  const reload = async () => {
    if (!board) return;
    const [memberResult, inviteResult] = await Promise.all([listBoardMembers({ boardId: board.id }), listBoardInvites({ boardId: board.id })]);
    setMembers(memberResult.members); setInvites(inviteResult.invites);
  };
  useEffect(() => { if (open && board) void reload().catch(() => toast.error("Não foi possível carregar o compartilhamento.")); }, [open, board?.id]);

  const invite = async () => {
    if (!board || !/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("Informe um e-mail válido.");
    setBusy(true);
    try {
      const result = await createBoardInvite({ boardId: board.id, type: "email", email: email.trim(), role });
      setEmail(""); await reload(); onChanged();
      if (result.emailSent) toast.success(result.joinedExistingMember ? "Membro adicionado e avisado por e-mail." : "Convite enviado por e-mail.");
      else if (result.joinedExistingMember) toast.success("Membro adicionado ao quadro. O email ainda não foi enviado.");
      else toast.info("Convite registrado, mas o envio por email ainda não está disponível.");
    } catch { toast.error("Não foi possível enviar o convite. Verifique a configuração SMTP."); } finally { setBusy(false); }
  };
  const createLink = async () => {
    if (!board) return;
    setBusy(true);
    try { await createBoardInvite({ boardId: board.id, type: "link", role, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }); await reload(); }
    catch { toast.error("Não foi possível criar o link."); } finally { setBusy(false); }
  };
  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${appOrigin}/kanban/convite/${token}`);
    toast.success("Link copiado.");
  };
  const revoke = async (id: string) => { await revokeBoardInvite({ id }); await reload(); toast.success("Link revogado."); };
  const setBackground = async (type: "color" | "photo", value: string) => {
    if (!board) return;
    await updateKanbanBoard({ id: board.id, backgroundType: type, backgroundValue: value, backgroundMode: "cover" });
    onChanged(); toast.success("Fundo atualizado.");
  };
  const upload = async (file?: File) => {
    if (!board || !file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Escolha uma imagem de até 5 MB.");
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try { await uploadBoardBackground({ boardId: board.id, fileName: file.name, dataUrl: String(reader.result) }); onChanged(); toast.success("Imagem aplicada ao quadro."); }
      catch { toast.error("Não foi possível enviar a imagem."); } finally { setBusy(false); }
    };
    reader.readAsDataURL(file);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl [&>button]:hidden" onInteractOutside={(event) => event.preventDefault()}>
      <DialogTitle className="sr-only">Configurações do quadro</DialogTitle>
      <DetailModalHeader
        icon={Users}
        title="Configurações do quadro"
        meta="Compartilhe com a equipe e personalize o ambiente deste quadro."
        onClose={() => onOpenChange(false)}
      />
      <div className="px-5 py-4">
      <Tabs key={`${initialTab}-${open}`} defaultValue={initialTab}>

        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="share" className="cursor-pointer gap-2"><Users className="h-4 w-4" />Compartilhar</TabsTrigger><TabsTrigger value="background" className="cursor-pointer gap-2"><Palette className="h-4 w-4" />Fundo</TabsTrigger></TabsList>
        <TabsContent value="share" className="space-y-5 pt-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Endereço de e-mail" /><RoleSelect value={role} onChange={setRole} /><Button className="cursor-pointer" disabled={busy} onClick={() => void invite()}><Mail className="mr-2 h-4 w-4" />Adicionar</Button></div>
          <p className="text-xs text-muted-foreground">Contas existentes são adicionadas e avisadas por e-mail. Para novos e-mails, enviaremos um link de convite.</p>
          {invites.filter((item) => item.type === "email" && item.status === "pending").length > 0 && <section><h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Convites pendentes</h3><div className="space-y-1">{invites.filter((item) => item.type === "email" && item.status === "pending").map((item) => <p key={item.id} className="truncate text-sm">{item.email}</p>)}</div></section>}
          <section><h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Membros do quadro ({members.length})</h3><div className="grid gap-2 sm:grid-cols-2">{members.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-lg border p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs text-primary">{initials(member.name)}</span><div className="min-w-0"><p className="truncate text-sm">{member.name}</p><p className="truncate text-xs text-muted-foreground">{member.email || member.operator}</p></div><span className="ml-auto text-xs text-muted-foreground">{member.role === "admin" ? "Admin" : member.role === "observer" ? "Observador" : "Membro"}</span></div>)}</div></section>
          <section className="rounded-lg border p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm">Compartilhar este quadro com um link</h3><p className="text-xs text-muted-foreground">O link expira em 7 dias e pode ser revogado a qualquer momento.</p></div><Button variant="outline" className="cursor-pointer" disabled={busy} onClick={() => void createLink()}><Link2 className="mr-2 h-4 w-4" />Criar link</Button></div>{activeLinks.map((item) => <div key={item.id} className="mt-3 flex items-center gap-2 rounded-md bg-muted p-2"><code className="min-w-0 flex-1 truncate text-xs">{`${appOrigin}/kanban/convite/${item.token}`}</code><Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => void copyLink(item.token)}><Copy className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="cursor-pointer text-destructive" onClick={() => void revoke(item.id)}><Trash2 className="h-4 w-4" /></Button></div>)}</section>
        </TabsContent>
        <TabsContent value="background" className="space-y-5 pt-3">
          <section><h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Cores</h3><div className="grid grid-cols-8 gap-2">{COLORS.map((color) => <button key={color} type="button" aria-label={`Usar cor ${color}`} onClick={() => void setBackground("color", color)} className={cn("aspect-square cursor-pointer rounded-md border-2", board?.backgroundValue === color ? "border-primary ring-2 ring-primary/25" : "border-transparent")} style={{ backgroundColor: color }} />)}</div></section>
          <section><h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Fotos</h3><div className="grid grid-cols-3 gap-2">{PHOTOS.map((photo) => <button key={photo} type="button" onClick={() => void setBackground("photo", photo)} className="aspect-video cursor-pointer overflow-hidden rounded-md border bg-muted"><img src={photo} alt="Fundo do quadro" className="h-full w-full object-cover" /></button>)}</div></section>
          <section className="flex items-center justify-between rounded-lg border p-4"><div className="flex items-center gap-3"><Image className="h-5 w-5 text-primary" /><div><p className="text-sm">Imagem personalizada</p><p className="text-xs text-muted-foreground">JPG, PNG ou WebP de até 5 MB.</p></div></div><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void upload(e.target.files?.[0])} /><Button variant="outline" className="cursor-pointer" disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Escolher arquivo</Button></section>
        </TabsContent>
      </Tabs>
      </div>

    </DialogContent>
  </Dialog>;
}

function RoleSelect({ value, onChange }: { value: "admin" | "member" | "observer"; onChange: (value: "admin" | "member" | "observer") => void }) {
  return <Select value={value} onValueChange={(next) => onChange(next as typeof value)}><SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member">Membro</SelectItem><SelectItem value="observer">Observador</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select>;
}
