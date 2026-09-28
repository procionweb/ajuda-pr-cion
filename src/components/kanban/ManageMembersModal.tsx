import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, UserPlus, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailModalHeader } from "@/components/portal/DetailModalHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  addBoardMember,
  listAvailableMembers,
  listBoardMembers,
  removeBoardMember,
  updateBoardMemberRole,
  type BoardMember,
} from "@/lib/kanban-api";

const ROLES: { id: string; label: string; tone: string }[] = [
  { id: "admin", label: "Administrador", tone: "bg-primary/15 text-primary" },
  { id: "member", label: "Membro", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
  { id: "observer", label: "Observador", tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
];
const roleMeta = (id?: string) => ROLES.find((r) => r.id === id) ?? ROLES[1];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ManageMembersModal({
  boardId,
  boardName,
  open,
  onOpenChange,
  onChanged,
}: {
  boardId: string;
  boardName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [available, setAvailable] = useState<BoardMember[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [avail, curr] = await Promise.all([
        listAvailableMembers({ data: { query } }),
        listBoardMembers({ data: { boardId } }),
      ]);
      setAvailable(avail.members);
      setMembers(curr.members);
    } catch {
      toast.error("Não foi possível carregar membros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boardId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void reload(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const filteredAvailable = available.filter((m) => !memberIds.has(m.id));

  const add = async (m: BoardMember) => {
    try {
      await addBoardMember({ data: { boardId, profileId: m.id, role: "member" } });
      setMembers((prev) => [...prev, { ...m, role: "member" }]);
      onChanged?.();
    } catch {
      toast.error("Não foi possível adicionar.");
    }
  };
  const changeRole = async (m: BoardMember, role: string) => {
    try {
      await updateBoardMemberRole({ data: { boardId, profileId: m.id, role } });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role } : x)));
      onChanged?.();
    } catch {
      toast.error("Não foi possível atualizar função.");
    }
  };
  const remove = async (m: BoardMember) => {
    try {
      await removeBoardMember({ data: { boardId, profileId: m.id } });
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
      onChanged?.();
    } catch {
      toast.error("Não foi possível remover.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-4xl [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Gerenciar membros</DialogTitle>

        <DetailModalHeader
          icon={Users}
          title="Gerenciar membros"
          protocol={boardName}
          meta="Adicione, remova ou altere a função dos membros do quadro."
          onClose={() => onOpenChange(false)}
        />

        <div className="grid gap-5 px-5 py-4">

          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, e-mail ou operador PRC..."
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <section className="min-w-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Membros do quadro ({members.length})
              </h3>
              <div className="max-h-[300px] space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
                {members.length === 0 && (
                  <p className="p-3 text-xs text-slate-500 dark:text-slate-400">Nenhum membro ainda.</p>
                )}
                {members.map((m) => {
                  const meta = roleMeta(m.role);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-md p-2 hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                        {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(m.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-900 dark:text-white">{m.name}</p>
                        <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                          {m.operator || m.email || ""}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("hidden h-5 shrink-0 px-1.5 text-[10px] sm:inline-flex", meta.tone)}>{meta.label}</Badge>
                      <Select value={m.role ?? "member"} onValueChange={(v) => void changeRole(m, v)}>
                        <SelectTrigger className="h-8 w-32 shrink-0 cursor-pointer text-xs" aria-label="Função">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {ROLES.map((r) => (
                            <SelectItem key={r.id} value={r.id} className="cursor-pointer">
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        aria-label="Remover membro"
                        onClick={() => void remove(m)}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="min-w-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Disponíveis {loading && "..."}
              </h3>
              <div className="max-h-[300px] space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
                {filteredAvailable.length === 0 && (
                  <p className="p-3 text-xs text-slate-500 dark:text-slate-400">
                    Nenhum resultado.
                  </p>
                )}
                {filteredAvailable.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-md p-2 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(m.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-900 dark:text-white">{m.name}</p>
                      <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {m.operator || m.email || ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer gap-1"
                      onClick={() => void add(m)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
