import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Plus, RefreshCw, Search, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  listAccountants,
  createAccountant,
  getAccountant,
  type Accountant,
} from "@/lib/accountants";

export const Route = createFileRoute("/clientes/contadores")({
  component: AccountantsPage,
  head: () => ({ meta: [{ title: "Contadores - Clientes - Portal Prócion" }] }),
});
function AccountantsPage() {
  const [detail, setDetail] = useState<any>(null);
  const [rows, setRows] = useState<Accountant[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    office: "",
    document: "",
    phone: "",
    email: "",
    notes: "",
  });
  const load = async () => {
    try {
      setRows(await listAccountants());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar os contadores.");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const filtered = rows.filter((r) =>
    `${r.name} ${r.office ?? ""} ${r.email ?? ""} ${r.notes ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome do contador.");
    try {
      await createAccountant(form);
      toast.success("Contador cadastrado.");
      setOpen(false);
      setForm({ name: "", office: "", document: "", phone: "", email: "", notes: "" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar.");
    }
  };
  if (detail) return <AccountantDetail detail={detail} onBack={() => setDetail(null)} />;
  return (
    <AppShell fullWidth>
      <PageHeader
        title="Contadores"
        description="Cadastre contadores e organize os clientes vinculados."
        actions={
          <>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="mr-2 size-4" />
              Atualizar
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" />
              Cadastrar contador
            </Button>
          </>
        }
      />
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar contador ou escritório"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <section>
        <div className="overflow-hidden rounded-md border bg-card">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/35 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Contador</th>
                <th className="px-4 py-3">Escritório</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Clientes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer transition-colors hover:bg-primary/[0.04]"
                  onClick={async () => {
                    try {
                      setDetail(await getAccountant(r.id));
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Não foi possível carregar os detalhes.",
                      );
                    }
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-normal">{r.name}</td>
                  <td className="px-4 py-3">{r.office || "—"}</td>
                  <td className="px-4 py-3">{r.email || r.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <UsersRound className="size-4" />
                      {r.clientCount ?? 0} clientes
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-[12px] text-muted-foreground shadow-[0_6px_16px_rgba(25,29,51,0.04)]">
          <span>
            Mostrando{" "}
            <strong className="font-medium text-foreground">
              {filtered.length ? (page - 1) * pageSize + 1 : 0}
            </strong>{" "}
            a{" "}
            <strong className="font-medium text-foreground">
              {Math.min(page * pageSize, filtered.length)}
            </strong>{" "}
            de <strong className="font-medium text-foreground">{filtered.length}</strong> contadores
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="accountants-page-size">Itens por página</label>
            <select
              id="accountants-page-size"
              className="h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(1)}>
              «
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹
            </Button>
            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-primary px-2 text-xs text-primary-foreground">
              {page}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage(pageCount)}
            >
              »
            </Button>
          </div>
        </div>
        {!filtered.length && (
          <div className="p-12 text-center text-muted-foreground">Nenhum contador cadastrado.</div>
        )}
      </section>
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(value) => {
          if (!value) setDetail(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.name || "Detalhes do contador"}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Escritório</span>
                  <p>{detail.office || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">E-mail</span>
                  <p>{detail.email || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone</span>
                  <p>{detail.phone || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Documento</span>
                  <p>{detail.document || "—"}</p>
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-medium">
                  Clientes vinculados ({detail.clientIds.length})
                </h3>
                {detail.clientIds.length ? (
                  <div className="max-h-64 divide-y overflow-auto rounded-md border">
                    {(detail.clients?.length
                      ? detail.clients
                      : detail.clientIds.map((id: string) => ({ id }))
                    ).map((client: any, index: number) => (
                      <div className="flex items-center gap-3 px-3 py-2" key={client.id}>
                        <span className="text-[11px] text-muted-foreground">{index + 1}</span>
                        <div>
                          <div className="text-[12px] font-normal leading-[1.2] text-foreground">
                            {client.trade_name || client.legal_name || client.id}
                          </div>
                          {client.document && (
                            <div className="mt-1 text-[11px] font-normal text-muted-foreground">
                              {client.document}{" "}
                              {client.city ? `• ${client.city}/${client.state || ""}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Nenhum cliente vinculado.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar contador</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nome</Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Escritório</Label>
              <Input
                className="mt-1"
                value={form.office}
                onChange={(e) => setForm({ ...form, office: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input
                  className="mt-1"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  className="mt-1"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function AccountantDetail({ detail, onBack }: { detail: any; onBack: () => void }) {
  const linkedClients = detail.clients?.length
    ? detail.clients
    : detail.clientIds.map((id: string) => ({ id }));
  return (
    <AppShell fullWidth>
      <PageHeader
        title={detail.name}
        description="Detalhes do contador e empresas vinculadas."
        actions={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" />
            Voltar para contadores
          </Button>
        }
      />
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-5 text-base font-medium">Dados do contador e responsabilidade</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="border-border/60 lg:border-r lg:pr-6">
            <p className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">
              Responsável
            </p>
            <dl className="space-y-3">
              <div>
                <dt className="text-[11px] text-muted-foreground">Nome</dt>
                <dd className="mt-1 text-[12px]">
                  {detail.responsible_name ||
                    detail.notes?.replace(/^Responsável:\s*/i, "") ||
                    "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">CPF</dt>
                <dd className="mt-1 text-[12px]">
                  {detail.responsible_document || "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">RG</dt>
                <dd className="mt-1 text-[12px]">{detail.responsible_rg || "Não informado"}</dd>
              </div>
            </dl>
          </div>
          <div className="border-border/60 lg:border-r lg:pr-6">
            <p className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">
              Endereço do responsável
            </p>
            <dl className="space-y-3">
              <div>
                <dt className="text-[11px] text-muted-foreground">Logradouro e número</dt>
                <dd className="mt-1 text-[12px]">
                  {[detail.address, detail.number].filter(Boolean).join(", ") || "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Bairro / complemento</dt>
                <dd className="mt-1 text-[12px]">
                  {[detail.neighborhood, detail.complement].filter(Boolean).join(" | ") ||
                    "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Cidade / UF</dt>
                <dd className="mt-1 text-[12px]">
                  {[detail.city, detail.state].filter(Boolean).join(" - ") || "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">CEP</dt>
                <dd className="mt-1 text-[12px]">{detail.postal_code || "Não informado"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">
              Contabilidade
            </p>
            <dl className="space-y-3">
              <div>
                <dt className="text-[11px] text-muted-foreground">Escritório</dt>
                <dd className="mt-1 text-[12px]">{detail.office || "Não informado"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Contador responsável</dt>
                <dd className="mt-1 text-[12px]">{detail.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Telefone</dt>
                <dd className="mt-1 text-[12px]">{detail.phone || "Não informado"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">E-mail</dt>
                <dd className="mt-1 break-all text-[12px]">{detail.email || "Não informado"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
      <div className="mt-4">
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="font-medium">Clientes vinculados</h2>
              <p className="text-xs text-muted-foreground">
                Empresas relacionadas a este contador.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
              {linkedClients.length}
            </span>
          </div>
          {linkedClients.length ? (
            <div>
              {linkedClients.map((client: any, index: number) => (
                <div className="flex items-center gap-3 px-5 py-4" key={client.id}>
                  <span className="grid size-8 place-items-center rounded-md bg-muted text-[11px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-[12px] font-normal leading-[1.2] text-foreground">
                      {client.trade_name || client.legal_name || client.name || client.id}
                    </div>
                    {client.document && (
                      <div className="mt-1 text-[11px] font-normal text-muted-foreground">
                        {client.document}
                        {client.city ? ` • ${client.city}/${client.state || ""}` : ""}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum cliente vinculado.
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
