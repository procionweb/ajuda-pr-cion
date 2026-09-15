import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  UserCircle,
  BarChart3,
  Plus,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to: to as string });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar páginas, artigos, ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Início
          </CommandItem>
          <CommandItem onSelect={() => go("/kanban")}>
            <KanbanSquare className="mr-2 h-4 w-4" /> Kanban Prócion
          </CommandItem>
          <CommandItem onSelect={() => go("/kanban-dashboard")}>
            <BarChart3 className="mr-2 h-4 w-4" /> Dashboard do Kanban
          </CommandItem>
          <CommandItem onSelect={() => go("/clientes")}>
            <Users className="mr-2 h-4 w-4" /> Clientes
          </CommandItem>
          <CommandItem onSelect={() => go("/minha-conta")}>
            <UserCircle className="mr-2 h-4 w-4" /> Minha Conta
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => go("/kanban")}>
            <Plus className="mr-2 h-4 w-4" /> Criar novo card
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
