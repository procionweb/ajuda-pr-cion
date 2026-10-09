import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowLeft,
  Building2,
  History,
  Monitor,
  Network,
  ScrollText,
  SlidersHorizontal,
  UsersRound,
  Wifi,
} from "lucide-react";

import { AppShell } from "@/components/portal/AppShell";
import { Breadcrumbs } from "@/components/portal/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClientTab,
  ClientHadronTab,
  ClientInternetTab,
  ClientDevicesTab,
  ClientParametersTab,
  ClientUsersTab,
  ClientTerminalsTab,
  ClientTechnicalCompaniesTab,
  ClientExternalLogsTab,
  ClientLogsTab,
  HadronMenuIcon,
} from "./clientes.index";

function MiniSummary({
  label,
  value,
  tone = "default",
  title,
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
  title?: string;
}) {
  const toneClass =
    tone === "danger"
      ? "truncate text-[12.5px] font-semibold text-red-600 dark:text-red-400"
      : tone === "success"
        ? "truncate text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400"
        : "truncate text-[12.5px] font-medium text-foreground";
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={toneClass} title={title ?? value}>
        {value}
      </span>
    </div>
  );
}

import { getClientDetail, type ClientDetail } from "@/lib/clients-api";
import { normalizeCityUf } from "@/lib/br-city";
import { getClientErpVersionStatus } from "@/lib/erp-versions";
import { useClients, resolveGroupCode, getGroupMembers } from "@/lib/clients-store";

const tabs = [
  "cliente",
  "hadron",
  "internet",
  "dispositivos",
  "parametros",
  "usuarios",
  "logs",
  "logs-externos",
  "terminais",
  "empresas",
] as const;
type TabValue = (typeof tabs)[number];

const searchSchema = z.object({
  tab: z.string().catch("cliente").default("cliente"),
  from: z.string().catch("").optional(),
  ticketId: z.string().catch("").optional(),
});

export const Route = createFileRoute("/clientes/$clienteId")({
  head: ({ params }) => ({
    meta: [{ title: `Cliente ${params.clienteId.toUpperCase()} - Portal Procion` }],
  }),
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    const detail = await getClientDetail(params.clienteId);
    if (!detail) throw notFound();
    return detail;
  },
  notFoundComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-medium">Cliente não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não localizamos este cliente. Verifique a sigla ou volte à lista.
        </p>
        <Button asChild className="mt-6 cursor-pointer">
          <Link to="/clientes">Voltar para Clientes</Link>
        </Button>
      </div>
    </AppShell>
  ),
  errorComponent: ({ reset }) => (
    <AppShell>
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-medium">Erro ao carregar cliente</h1>
        <Button onClick={reset} className="mt-6 cursor-pointer">
          Tentar novamente
        </Button>
      </div>
    </AppShell>
  ),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const {
    client,
    contacts,
    companies,
    groupCompanies,
    users,
    terminals,
    hadronInfo,
    modules,
    internet,
    tickets,
    events,
    activities,
    parameters,
    logs,
  } = Route.useLoaderData() as ClientDetail;
  const { tab, from, ticketId } = Route.useSearch();
  const navigate = useNavigate();
  const showReturnToTicket = from === "chamado" && !!ticketId;
  const { clients: allClients } = useClients({ onlyActive: false });
  const showInternet =
    internet.hasActiveContract || internet.contracts.some((c: { active: boolean }) => c.active);
  const showDevices = showInternet;
  const showParameters = parameters.length > 0;
  // Dispositivos: ativos vinculados aos contratos ativos / limite do contrato
  // (auth_contratos.con_qtd_dispositivos).
  const deviceUsage = (() => {
    const activeContracts = internet.contracts.filter((c) => c.active);
    const activeKeys = new Set(activeContracts.map((c) => c.legacyId).filter(Boolean));
    const scoped = activeKeys.size
      ? internet.devices.filter((d) => !d.contractLegacyId || activeKeys.has(d.contractLegacyId))
      : internet.devices;
    const active = scoped.filter((d) => d.active).length;

    const limit = activeContracts.reduce((total, contract) => {
      const raw = (contract.sourcePayload as Record<string, unknown>)?.con_qtd_dispositivos;
      const parsed = Number(String(raw ?? "").replace(/[^\d]/g, ""));
      return total + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    return { active, limit, label: limit > 0 ? `${active}/${limit}` : String(active) };
  })();

  // Grupo: usa group_acronym do cliente. Se vazio, verifica se ele é raiz de
  // um grupo (algum outro cliente aponta group_acronym para a sigla dele).
  const groupCode = resolveGroupCode(client, allClients);
  const groupMembersCount = groupCode ? getGroupMembers(groupCode, allClients).length : 0;

  const requestedTab = tab;
  const tabAllowed =
    (tabs as readonly string[]).includes(requestedTab) &&
    (requestedTab !== "dispositivos" || showDevices) &&
    (requestedTab !== "parametros" || showParameters) &&
    (requestedTab !== "internet" || showInternet);
  const currentTab: TabValue = tabAllowed ? (requestedTab as TabValue) : "cliente";

  const setTab = (value: string) => {
    navigate({
      to: "/clientes/$clienteId",
      params: { clienteId: client.id },
      search: { tab: value, from, ticketId },
      replace: true,
    });
  };

  const erpStatus = getClientErpVersionStatus(client.version, client.versionDate);
  const breadcrumbGroupLabel = groupCode || client.acronym;
  return (
    <AppShell>
      <div className="mb-3 flex flex-wrap items-center gap-2 max-xl:[&_a]:min-h-11">
        <Button asChild variant="outline" size="sm" className="h-8 cursor-pointer rounded-lg">
          <Link to="/clientes" aria-label="Voltar para Clientes">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Voltar para Clientes
          </Link>
        </Button>

        {showReturnToTicket && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="ml-2 h-8 cursor-pointer rounded-lg"
          >
            <Link to="/chamados" search={{ ticket: ticketId }}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Voltar ao chamado
            </Link>
          </Button>
        )}
      </div>

      <div className="mb-4 flex w-full min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Breadcrumbs
          className="mb-0 min-w-0 shrink flex-wrap"
          items={[
            { label: "Clientes", to: "/clientes" },
            groupCode
              ? { label: breadcrumbGroupLabel, to: `/clientes?grupo=${groupCode}` }
              : { label: client.acronym, to: "/clientes" },
            { label: "Detalhes do cliente" },
          ]}
        />

        <div className="client-header-summary flex min-w-0 flex-wrap items-center justify-end gap-x-5 gap-y-1.5">
          <MiniSummary
            label="Atendimento"
            value={normalizeCityUf(client.city) || "Não informado"}
          />
          <MiniSummary
            label="Status"
            value={client.status || "Não informado"}
            tone={client.status.trim().toLowerCase().startsWith("ativo") ? "success" : "default"}
          />
          <MiniSummary
            label="Versão Hádron"
            value={client.versionDate || client.version || "Não informada"}
            tone={erpStatus.needsAttention ? "danger" : "default"}
            title={erpStatus.label}
          />
          <MiniSummary
            label="Data de atualização"
            value={client.versionUpdatedAt || "Não informada"}
          />
          <MiniSummary
            label="Dispositivos"
            value={deviceUsage.label}
            title={
              deviceUsage.limit
                ? `${deviceUsage.active} dispositivos ativos de ${deviceUsage.limit} contratados`
                : `${deviceUsage.active} dispositivos ativos`
            }
          />
        </div>
      </div>

      <Card className="overflow-hidden border-border bg-card p-0 shadow-sm dark:border-border">
        <header className="client-detail-header border-b border-border px-4 py-4 sm:px-5 xl:px-7 xl:py-5 dark:border-border">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 max-w-full gap-3 xl:gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-sm">
                {client.acronym.slice(0, 4).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {groupCode ? (
                    <Link
                      to="/clientes"
                      search={{ grupo: groupCode, origem: client.id }}
                      className="cursor-pointer text-sm font-medium text-primary hover:underline"
                      title={`Ver clientes do grupo ${groupCode}`}
                    >
                      {client.acronym}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-primary">{client.acronym}</span>
                  )}
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    {client.status}
                  </Badge>
                </div>

                <h2 className="mt-1 break-words text-lg xl:text-xl font-medium text-foreground">
                  {client.razaoSocial}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {client.fantasia}
                  {groupCode ? (
                    <span className="ml-1 text-muted-foreground/80">· Grupo {groupCode}</span>
                  ) : null}
                </p>
              </div>
            </div>

            {groupCode && (
              <Button
                asChild
                variant="outline"
                size="sm"
                title="Ver clientes deste grupo"
                className="h-9 cursor-pointer gap-1.5 rounded-full border-primary/30 bg-primary/5 px-3.5 text-[12.5px] font-medium text-primary hover:bg-primary/10"
              >
                <Link to="/clientes" search={{ grupo: groupCode, origem: client.id }}>
                  <Network className="h-3.5 w-3.5" />
                  Ver clientes do grupo {groupCode} ({groupMembersCount})
                </Link>
              </Button>
            )}
          </div>
        </header>

        <Tabs value={currentTab} onValueChange={setTab} className="flex flex-col">
          <div className="min-w-0 overflow-x-auto border-b border-border px-2 sm:px-4 xl:px-7">
            <TabsList className="client-detail-tabs h-auto w-max justify-start gap-1 rounded-none border-0 bg-transparent p-0">
              {[
                ["cliente", "Cliente", Building2],
                ["hadron", "Hádron", HadronMenuIcon],
                ...(showInternet ? [["internet", "Internet", Wifi]] : []),
                ...(showDevices ? [["dispositivos", "Dispositivos", Monitor]] : []),
                ...(showParameters ? [["parametros", "Parâmetros", SlidersHorizontal]] : []),
                ["usuarios", "Usuários", UsersRound],
                ["logs", "Logs", ScrollText],
                ["logs-externos", "Logs externos", History],
                ["terminais", "Terminais", Monitor],
                ["empresas", "Empresas", Network],
              ].map(([value, label, Icon]) => {
                const V = value as string;
                const L = label as string;
                const I = Icon as typeof Building2;
                return (
                  <TabsTrigger
                    key={V}
                    value={V}
                    className="cursor-pointer gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    <I className="h-4 w-4" />
                    {L}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="client-detail-content min-w-0 bg-muted/10 p-3 sm:p-4 xl:p-6">
            <TabsContent
              value="cliente"
              className="m-0 space-y-5 text-[12px] [&_.text-sm]:text-[12px]"
            >
              <ClientTab
                client={client}
                contacts={contacts}
                companies={companies}
                terminals={terminals}
                tickets={tickets}
                events={events}
                activities={activities}
                onOpenCompanies={() => setTab("empresas")}
              />
            </TabsContent>
            <TabsContent
              value="hadron"
              className="m-0 space-y-5 text-[12px] [&_.text-sm]:text-[12px]"
            >
              <ClientHadronTab
                client={client}
                companies={companies}
                modules={modules}
                terminals={terminals}
              />
            </TabsContent>
            {showInternet && (
              <TabsContent
                value="internet"
                className="m-0 space-y-5 text-[12px] [&_.text-sm]:text-[12px]"
              >
                <ClientInternetTab client={client} internet={internet} />
              </TabsContent>
            )}
            {showDevices && (
              <TabsContent
                value="dispositivos"
                className="m-0 space-y-5 text-[12px] [&_.text-sm]:text-[12px]"
              >
                <ClientDevicesTab internet={internet} />
              </TabsContent>
            )}
            {showParameters && (
              <TabsContent value="parametros" className="m-0">
                <ClientParametersTab parameters={parameters} />
              </TabsContent>
            )}
            <TabsContent value="usuarios" className="m-0">
              <ClientUsersTab users={users} />
            </TabsContent>
            <TabsContent value="logs" className="m-0">
              <ClientLogsTab logs={logs.logs} />
            </TabsContent>
            <TabsContent value="logs-externos" className="m-0">
              <ClientExternalLogsTab logs={logs.externalLogs} />
            </TabsContent>
            <TabsContent value="terminais" className="m-0">
              <ClientTerminalsTab terminals={terminals} />
            </TabsContent>
            <TabsContent value="empresas" className="m-0">
              <ClientTechnicalCompaniesTab
                client={client}
                terminals={terminals}
                hadronInfo={hadronInfo}
              />
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </AppShell>
  );
}
