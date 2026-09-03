import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { currentUser } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";

export type PortalRole = "s_admin" | "prc";

type PortalAuthState = {
  loading: boolean;
  session: Session | null;
  role: PortalRole | null;
};

const PortalAuthContext = createContext<PortalAuthState>({
  loading: true,
  session: null,
  role: null,
});

const prcRoutes = ["/chamados", "/kanban", "/base-de-conhecimento", "/iniciar-hadron"];

export function canAccessPortalPath(role: PortalRole | null, pathname: string) {
  if (pathname === "/login") return true;
  if (role === "s_admin") return true;
  if (role !== "prc") return false;
  if (pathname === "/" || pathname.startsWith("/minha-conta")) return true;
  return prcRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function syncCurrentUser(session: Session | null) {
  const user = session?.user;
  if (!user) return;
  const metadata = user.user_metadata || {};
  const operator = String(metadata.operator || "")
    .trim()
    .toUpperCase();
  const fullName = String(metadata.full_name || operator || user.email || "Usuário").trim();
  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  Object.assign(currentUser, {
    name: fullName,
    email: user.email || "",
    role: user.app_metadata?.perfil === "s_admin" ? "Administrador" : "Equipe Prócion",
    initials,
    operator: operator || fullName,
  });
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortalAuthState>({ loading: true, session: null, role: null });

  useEffect(() => {
    let active = true;
    const applySession = (session: Session | null) => {
      if (!active) return;
      syncCurrentUser(session);
      const rawRole = session?.user.app_metadata?.perfil;
      const role = rawRole === "s_admin" || rawRole === "prc" ? rawRole : null;
      setState({ loading: false, session, role });
    };
    void supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}
