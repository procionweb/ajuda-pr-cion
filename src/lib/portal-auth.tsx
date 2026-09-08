import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { currentUser } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";

export type PortalRole =
  | "s_admin"
  | "admin"
  | "tester"
  | "manager"
  | "logistics"
  | "supervisor"
  | "marketing"
  | "prc";

export type PortalDepartment = "admin" | "tester" | "support" | "commercial" | "development" | string;

type PortalAuthState = {
  loading: boolean;
  session: Session | null;
  role: PortalRole | null;
  department: PortalDepartment | null;
};

const PortalAuthContext = createContext<PortalAuthState>({
  loading: true,
  session: null,
  role: null,
  department: null,
});

const portalRoles: PortalRole[] = [
  "s_admin", "admin", "tester", "manager", "logistics", "supervisor", "marketing", "prc",
];
const commonRoutes = [
  "/chamados", "/suporte/agendamentos", "/calendario", "/clientes",
  "/base-de-conhecimento", "/iniciar-hadron", "/atualizacoes", "/minha-conta",
];

export function canAccessPortalPath(
  role: PortalRole | null,
  department: PortalDepartment | null,
  pathname: string,
) {
  if (pathname === "/login") return true;
  if (!role || !portalRoles.includes(role)) return false;
  if (pathname === "/") return true;
  if (pathname.startsWith("/kanban")) return true;
  if (pathname.startsWith("/frota")) return role === "s_admin";
  if (pathname.startsWith("/comercial")) return department === "admin" || department === "commercial";
  if (pathname.startsWith("/analytics")) return role === "s_admin" || role === "admin";
  if (pathname.startsWith("/configuracoes/contratos")) return role === "s_admin";
  if (pathname.startsWith("/configuracoes")) return role === "s_admin" || role === "admin";
  if (pathname.startsWith("/versoes")) {
    return department === "admin" || department === "development" || department === "tester";
  }
  return commonRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
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
    role:
      user.app_metadata?.perfil === "s_admin"
        ? "Administrador geral"
        : user.app_metadata?.perfil === "admin"
          ? "Administrador"
          : "Equipe Prócion",
    initials,
    operator: operator || fullName,
  });
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortalAuthState>({ loading: true, session: null, role: null, department: null });

  useEffect(() => {
    let active = true;
    const applySession = async (session: Session | null) => {
      if (!active) return;
      syncCurrentUser(session);
      const rawRole = session?.user.app_metadata?.perfil;
      let role = portalRoles.includes(rawRole as PortalRole) ? (rawRole as PortalRole) : null;
      let department = session?.user.user_metadata?.departamento
        ? String(session.user.user_metadata.departamento)
        : null;
      if (session) {
        const { data } = await supabase.rpc("get_current_portal_access");
        const access = data?.[0] as
          | { portal_profile?: string; collaborator_department?: string }
          | undefined;
        if (access?.portal_profile && portalRoles.includes(access.portal_profile as PortalRole)) {
          role = access.portal_profile as PortalRole;
        }
        department = access?.collaborator_department || department;
      }
      if (active) setState({ loading: false, session, role, department });
    };
    void supabase.auth.getSession().then(({ data }) => void applySession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => void applySession(session));
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
