import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Check,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  listAccountantClientOptions,
  linkAccountantClients,
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
  const [clientOptions, setClientOptions] = useState<any[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    office: "",
    document: "",
    phone: "",
    email: "",
    notes: "",
    responsible_name: "",
    responsible_document: "",
    responsible_rg: "",
    address: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    postal_code: "",
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
    const requiredFields = [
      "name",
      "office",
      "phone",
      "email",
      "responsible_name",
      "responsible_document",
      "responsible_rg",
      "address",
      "number",
      "neighborhood",
      "city",
      "state",
      "postal_code",
    ] as const;
    if (requiredFields.some((key) => !form[key].trim())) {
      return toast.error("Preencha todos os campos obrigatórios do cadastro.");
    }
    if (!selectedClients.length)
      return toast.error("Selecione pelo menos uma empresa para vincular.");
    try {
      const created = await createAccountant(form as any);
      await linkAccountantClients(created.id, selectedClients);
      toast.success("Contador cadastrado.");
      setOpen(false);
      setForm({
        ...form,
        name: "",
        office: "",
        document: "",
        phone: "",
        email: "",
        notes: "",
        responsible_name: "",
        responsible_document: "",
        responsible_rg: "",
        address: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        postal_code: "",
      });
      setSelectedClients([]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar.");
    }
  };
  if (detail) return <AccountantDetail detail={detail} onBack={() => setDetail(null)} />;
  if (open)
    return (
      <AccountantCreateScreen
        form={form}
        setForm={setForm}
        clientOptions={clientOptions}
        selectedClients={selectedClients}
        setSelectedClients={setSelectedClients}
        onSave={save}
        onCancel={() => setOpen(false)}
      />
    );
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
            <Button
              onClick={async () => {
                setOpen(true);
                try {
                  setClientOptions(await listAccountantClientOptions());
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Não foi possível carregar as empresas.",
                  );
                }
              }}
            >
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
                <th className="px-4 py-3">Código</th>
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
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    CTR-{r.id.slice(0, 8).toUpperCase()}
                  </td>
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
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Cadastrar contador</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <div>
              <Label>
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>
                Escritório <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                value={form.office}
                onChange={(e) => setForm({ ...form, office: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Telefone <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="mt-1"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>
                  E-mail <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="mt-1"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["CPF do responsável", "responsible_document"],
                ["RG do responsável", "responsible_rg"],
                ["Responsável", "responsible_name"],
                ["Endereço", "address"],
                ["Número", "number"],
                ["Complemento", "complement"],
                ["Bairro", "neighborhood"],
                ["Cidade", "city"],
                ["UF", "state"],
                ["CEP", "postal_code"],
              ].map(([label, key]) => (
                <div key={key}>
                  <Label>
                    {label} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="mt-1"
                    value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value } as any)}
                  />
                </div>
              ))}
            </div>
            <div>
              <Label>Empresas vinculadas</Label>
              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                {clientOptions.map((client) => (
                  <label className="flex items-center gap-2" key={client.id}>
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(client.id)}
                      onChange={(e) =>
                        setSelectedClients(
                          e.target.checked
                            ? [...selectedClients, client.id]
                            : selectedClients.filter((id) => id !== client.id),
                        )
                      }
                    />
                    <span>
                      {client.trade_name || client.legal_name}{" "}
                      {client.document ? `• ${client.document}` : ""}
                    </span>
                  </label>
                ))}
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

function AccountantCreateScreen({
  form,
  setForm,
  clientOptions,
  selectedClients,
  setSelectedClients,
  onSave,
  onCancel,
}: any) {
  useEffect(() => {
    document.body.dataset.accountantCreate = "true";
    return () => {
      delete document.body.dataset.accountantCreate;
    };
  }, []);
  const [clientQuery, setClientQuery] = useState("");
  const [cepStatus, setCepStatus] = useState("");
  const mask = (value: string, pattern: string) => {
    const digits = value.replace(/\D/g, "");
    let index = 0;
    let output = "";
    for (const character of pattern) {
      if (index >= digits.length) break;
      output += character === "#" ? digits[index++] : character;
    }
    return output;
  };
  useEffect(() => {
    const cep = form.postal_code.replace(/\D/g, "");
    if (cep.length !== 8) {
      setCepStatus("");
      return;
    }
    const controller = new AbortController();
    setCepStatus("Buscando endereço...");
    fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.erro) {
          setCepStatus("CEP não encontrado. Preencha o endereço manualmente.");
          return;
        }
        setForm((previous: any) => ({
          ...previous,
          address: data.logradouro || previous.address,
          neighborhood: data.bairro || previous.neighborhood,
          city: data.localidade || previous.city,
          state: data.uf || previous.state,
        }));
        setCepStatus("Endereço preenchido pelo CEP.");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCepStatus("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
      });
    return () => controller.abort();
  }, [form.postal_code]);
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const visibleClients = clientOptions.filter((client: any) =>
    `${client.trade_name || ""} ${client.legal_name || ""} ${client.document || ""}`
      .toLowerCase()
      .includes(clientQuery.toLowerCase()),
  );
  const fields = [
    ["CPF do responsável", "responsible_document"],
    ["RG do responsável", "responsible_rg"],
    ["Responsável", "responsible_name"],
    ["Endereço", "address"],
    ["Número", "number"],
    ["Complemento", "complement"],
    ["Bairro", "neighborhood"],
    ["Cidade", "city"],
    ["UF", "state"],
    ["CEP", "postal_code"],
  ];
  return (
    <AppShell fullWidth>
      <PageHeader
        title="Cadastrar contador"
        description="Cadastre todos os dados do contador e vincule as empresas da base."
        actions={
          <Button variant="outline" onClick={onCancel}>
            Voltar para contadores
          </Button>
        }
      />
      <style>
        {
          'body[data-accountant-create="true"] button[aria-label="Voltar ao topo"] { display: none; }'
        }
      </style>
      <div className="space-y-5 text-sm [&_input]:h-11 [&_input]:rounded-xl [&_input]:text-sm [&_label]:text-[12px] [&_label]:font-medium">
        <section className="rounded-xl border bg-card p-5 text-sm shadow-sm">
          <h2 className="mb-4 flex items-center gap-3 text-base font-medium">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="size-5" />
            </span>
            Dados do contador
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>
                Escritório <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                value={form.office}
                onChange={(e) => setForm({ ...form, office: e.target.value })}
              />
            </div>
            <div>
              <Label>
                Telefone <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: mask(
                      e.target.value,
                      e.target.value.replace(/\D/g, "").length > 10
                        ? "(##) #####-####"
                        : "(##) ####-####",
                    ),
                  })
                }
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label>
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <h3 className="mb-3 mt-5 flex items-center gap-2 border-t pt-4 text-sm font-medium">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </span>
            Responsável e endereço
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            {fields.map(([label, key]) => (
              <div key={key}>
                <Label>
                  {label} {key !== "complement" && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  className="mt-1"
                  value={form[key] || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]:
                        key === "responsible_document"
                          ? mask(e.target.value, "###.###.###-##")
                          : key === "responsible_rg"
                            ? e.target.value
                                .replace(/[^0-9xX]/g, "")
                                .slice(0, 9)
                                .replace(/^(\d{2})(\d)/, "$1.$2")
                                .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
                                .replace(/(\d{3})([\dxX])$/, "$1-$2")
                            : key === "postal_code"
                              ? mask(e.target.value, "#####-###")
                              : e.target.value,
                    })
                  }
                />
                {key === "postal_code" && (
                  <p className="mt-1 text-xs text-muted-foreground" role="status">
                    {cepStatus}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="mt-4 rounded-xl border bg-card p-5 text-sm shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-medium">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </span>
            Empresas vinculadas <span className="text-destructive">*</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione as empresas que ficarão ligadas a este contador.
          </p>
          <Popover open={clientSelectOpen} onOpenChange={setClientSelectOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="mt-3 flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl border px-3 text-left text-sm text-muted-foreground"
              >
                <Search className="size-4" />
                Buscar por sigla, fantasia, razão social, CNPJ ou cidade...
                <span className="ml-auto">⌄</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[var(--radix-popover-trigger-width)] p-2"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <Input
                className="h-10"
                placeholder="Digite para filtrar..."
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
              />
              <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {visibleClients.map((client: any) => (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedClients(
                        selectedClients.includes(client.id)
                          ? selectedClients.filter((id: string) => id !== client.id)
                          : [...selectedClients, client.id],
                      )
                    }
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-md border p-3 text-left text-sm ${selectedClients.includes(client.id) ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                    key={client.id}
                  >
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${selectedClients.includes(client.id) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}
                    >
                      {selectedClients.includes(client.id) && <Check className="size-3.5" />}
                    </span>
                    <span>
                      {client.trade_name || client.legal_name}
                      <span className="block text-xs text-muted-foreground">
                        {client.document || "CNPJ não informado"}
                        {client.city ? ` • ${client.city}/${client.state || ""}` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <div className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Empresas selecionadas</span>
              <strong className="text-foreground">{selectedClients.length}</strong>
            </div>
            <p className="mt-1">
              As empresas selecionadas serão vinculadas ao contador após salvar.
            </p>
            <div className="mt-3 space-y-2">
              {clientOptions
                .filter((client: any) => selectedClients.includes(client.id))
                .map((client: any) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {client.trade_name || client.legal_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {client.document || "CNPJ não informado"}
                        {client.city ? ` • ${client.city}/${client.state || ""}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 cursor-pointer text-destructive hover:text-destructive"
                      onClick={() =>
                        setSelectedClients(selectedClients.filter((id: string) => id !== client.id))
                      }
                    >
                      Remover
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </section>
        <div className="flex justify-end gap-2 pb-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onSave}>Salvar contador</Button>
        </div>
      </div>
    </AppShell>
  );
}

function AccountantDetail({ detail, onBack }: { detail: any; onBack: () => void }) {
  const registrationCode = `CTR-${detail.id.slice(0, 8).toUpperCase()}`;
  const formatCnpj = (value: unknown) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits.length === 14
      ? digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
      : String(value ?? "");
  };
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
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                Código: {registrationCode}
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
              {linkedClients.length}
            </span>
          </div>
          {linkedClients.length ? (
            <div>
              {linkedClients.map((client: any, index: number) => (
                <div className="flex items-start gap-3 px-5 py-4" key={client.id}>
                  <span className="grid size-8 place-items-center rounded-md bg-muted text-[11px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="mt-1 text-[12px] font-normal leading-[1.2] text-foreground">
                      {client.trade_name || client.legal_name || client.name || client.id}
                    </div>
                    <div className="mt-1 text-[11px] font-normal text-muted-foreground">
                      {[
                        client.legal_name && client.trade_name !== client.legal_name
                          ? client.legal_name
                          : null,
                        client.acronym,
                        client.city && `${client.city}/${client.state || ""}`,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "Dados cadastrais não informados"}
                    </div>
                    {(client.address || client.postal_code || client.size || client.tax_regime) && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {[client.address, client.postal_code, client.size, client.tax_regime]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    )}
                  </div>
                  <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
                    <span>
                      CNPJ: {client.document ? formatCnpj(client.document) : "Não informado"}
                    </span>
                    <span>IE: {client.state_registration || "Não informada"}</span>
                    <span>CNAE: {client.cnae || "Não informado"}</span>
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
