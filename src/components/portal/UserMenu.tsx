import { Link } from "@tanstack/react-router";
import { LogOut, Settings, UserCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { currentUser } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";

export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group flex cursor-pointer items-center gap-3 rounded-r-md border-l border-border pl-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Menu do usuário"
        >
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
              {currentUser.name}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{currentUser.role}</p>
          </div>
          <Avatar className="h-9 w-9 ring-2 ring-transparent group-hover:ring-primary/30 transition">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{currentUser.name}</p>
            <p className="text-[11px] font-normal text-muted-foreground truncate">
              {currentUser.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/minha-conta" className="cursor-pointer">
            <UserCircle className="mr-2 h-4 w-4" /> Minha Conta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            toast("Preferências em breve", {
              description: "Personalização de tema, idioma e notificações.",
            })
          }
        >
          <Settings className="mr-2 h-4 w-4" /> Preferências
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            toast("Novidades", { description: "Confira as últimas atualizações do portal." })
          }
        >
          <Sparkles className="mr-2 h-4 w-4" /> Novidades
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => {
            void supabase.auth.signOut().then(() => {
              toast.success("Sessão encerrada.");
              window.location.assign("/login");
            });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
