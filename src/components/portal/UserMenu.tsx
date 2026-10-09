import { disconnectBackgroundPush } from "@/lib/background-push";
import { Link } from "@tanstack/react-router";
import { LogOut, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useProfileAvatar } from "@/lib/profile-avatar";

export function UserMenu() {
  const avatarUrl = useProfileAvatar();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group flex cursor-pointer items-center gap-3 rounded-r-md border-l border-border pl-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Menu do usuário"
        >
          <div className="hidden xl:block text-right">
            <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
              {currentUser.name}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{currentUser.role}</p>
          </div>
          <Avatar className="h-9 w-9 ring-2 ring-transparent group-hover:ring-primary/30 transition">
            <AvatarImage src={avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl ?? undefined} alt="" />
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => {
            void disconnectBackgroundPush().catch(() => {}).then(() => supabase.auth.signOut()).then(() => {
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
