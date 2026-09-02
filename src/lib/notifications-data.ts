import type { LucideIcon } from "lucide-react";
import { AlertOctagon, GitBranch, MessageSquare, Sparkles, UserPlus } from "lucide-react";

export type NotificationTone = "info" | "success" | "warning" | "danger";

export type Notification = {
  id: string;
  title: string;
  description: string;
  time: string;
  icon: LucideIcon;
  tone: NotificationTone;
  read?: boolean;
  href?: string;
};

export const notifications: Notification[] = [
  {
    id: "n1",
    title: "Nova versão 2026.3.1 publicada",
    description: "Kanban com colunas customizáveis e filtro global de clientes.",
    time: "há 12 min",
    icon: GitBranch,
    tone: "success",
    href: "/atualizacoes",
  },
  {
    id: "n2",
    title: "Card crítico atribuído a você",
    description: "PRC-482 · Rejeição de XML na NF-e do cliente Vega Distribuidora.",
    time: "há 42 min",
    icon: AlertOctagon,
    tone: "danger",
    href: "/chamados",
  },
  {
    id: "n3",
    title: "Bruno Lima comentou em PRC-478",
    description: "“Consegui reproduzir o erro no ambiente de homologação.”",
    time: "há 2 h",
    icon: MessageSquare,
    tone: "info",
    href: "/chamados",
  },
  {
    id: "n4",
    title: "Novo artigo publicado",
    description: "Guia rápido: conciliação bancária com Pix Automático.",
    time: "há 5 h",
    icon: Sparkles,
    tone: "info",
    read: true,
    href: "/base-de-conhecimento",
  },
  {
    id: "n5",
    title: "Cliente Órion Serviços em trial",
    description: "Trial expira em 7 dias · acompanhe o onboarding.",
    time: "ontem",
    icon: UserPlus,
    tone: "warning",
    read: true,
    href: "/clientes",
  },
];

export const toneStyles: Record<NotificationTone, string> = {
  info: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
};
