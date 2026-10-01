import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuit, Check, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/portal/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listDiagnosisLearnings,
  reviewDiagnosisLearning,
  type DiagnosisLearning,
} from "@/lib/ticket-diagnosis";

export const Route = createFileRoute("/configuracoes/aprendizado-ia")({
  head: () => ({ meta: [{ title: "Aprendizado da IA - Configurações - Portal Prócion" }] }),
  component: DiagnosisLearningPage,
});

const statusLabel = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" };

function plainText(value: string) {
  const document = new DOMParser().parseFromString(value, "text/html");
  return (document.body.textContent || "").trim();
}

function DiagnosisLearningPage() {
  const [rows, setRows] = useState<DiagnosisLearning[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | DiagnosisLearning["reviewStatus"]>("pending");
  const [selected, setSelected] = useState<DiagnosisLearning | null>(null);
  const [solution, setSolution] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listDiagnosisLearnings());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as revisões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => void load(), []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return rows.filter((row) => {
      if (status !== "all" && row.reviewStatus !== status) return false;
      return !term || `${row.protocol} ${row.subject} ${row.module}`.toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [query, rows, status]);

  const openReview = (row: DiagnosisLearning) => {
    setSelected(row);
    setSolution(row.reviewedSolution || plainText(row.actualSolution));
  };

  const save = async (reviewStatus: "approved" | "rejected") => {
    if (!selected) return;
    if (reviewStatus === "approved" && !solution.trim()) {
      toast.error("Informe a solução validada antes de aprovar.");
      return;
    }
    setSaving(true);
    try {
      await reviewDiagnosisLearning(selected.id, reviewStatus, solution);
      toast.success(reviewStatus === "approved" ? "Solução aprovada para aprendizado." : "Aprendizado rejeitado.");
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a revisão.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell fullWidth>
      <PageHeader
        title="Aprendizado da IA"
        description="Revise soluções reais antes de incorporá-las aos próximos diagnósticos do suporte."
        actions={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar protocolo, assunto ou módulo" className="pl-9" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovados</option>
          <option value="rejected">Rejeitados</option>
          <option value="all">Todos</option>
        </select>
      </div>

      <section className="overflow-hidden rounded-md border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/35 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Chamado</th><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Confiança</th><th className="px-4 py-3">Finalização</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3"><div className="font-medium">{row.protocol || "Sem protocolo"}</div><div className="max-w-xl truncate text-muted-foreground">{row.subject}</div></td>
                  <td className="px-4 py-3">{row.module || "—"}</td>
                  <td className="px-4 py-3 capitalize">{row.confidence}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.finalizedAt ? new Date(row.finalizedAt).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{statusLabel[row.reviewStatus]}</Badge></td>
                  <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => openReview(row)}>{row.reviewStatus === "pending" ? "Revisar" : "Ver revisão"}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <div className="flex min-h-44 items-center justify-center text-muted-foreground">Nenhum aprendizado encontrado.</div>}
        {loading && <div className="flex min-h-44 items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-4 animate-spin" />Carregando revisões...</div>}
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BrainCircuit className="size-5 text-primary" />Revisar aprendizado</DialogTitle></DialogHeader>
          {selected && <div className="space-y-5">
            <div><div className="font-semibold">{selected.protocol} · {selected.subject}</div><div className="text-sm text-muted-foreground">{selected.module || "Módulo não informado"}</div></div>
            <div className="rounded-md border bg-muted/20 p-4"><div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Diagnóstico sugerido</div><p className="text-sm">{selected.diagnosis.assessment}</p></div>
            <div><Label htmlFor="validated-solution">Solução real validada</Label><Textarea id="validated-solution" value={solution} onChange={(event) => setSolution(event.target.value)} rows={9} className="mt-2 resize-y" /></div>
          </div>}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="destructive" onClick={() => save("rejected")} disabled={saving}><X className="mr-2 size-4" />Rejeitar</Button>
            <Button onClick={() => save("approved")} disabled={saving}><Check className="mr-2 size-4" />Aprovar aprendizado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
