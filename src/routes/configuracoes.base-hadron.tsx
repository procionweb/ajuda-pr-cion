import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Database, RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, PageHeader } from '@/components/portal/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listHadronKnowledge, reviewHadronKnowledge, type HadronKnowledge } from '@/lib/hadron-knowledge'

export const Route = createFileRoute('/configuracoes/base-hadron')({
  head: () => ({ meta: [{ title: 'Base Hádron - Configurações - Portal Prócion' }] }),
  component: HadronKnowledgePage,
})

function HadronKnowledgePage() {
  const [rows, setRows] = useState<HadronKnowledge[]>([])
  const [status, setStatus] = useState('pending')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<HadronKnowledge | null>(null)
  const [purpose, setPurpose] = useState('')
  const [saving, setSaving] = useState(false)
  const load = async () => { try { setRows(await listHadronKnowledge(status)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível carregar a Base Hádron.') } }
  useEffect(() => { void load() }, [status])
  const filtered = useMemo(() => { const q = query.toLowerCase().trim(); return rows.filter((r) => !q || `${r.option_number} ${r.option_name ?? ''} ${r.module ?? ''}`.toLowerCase().includes(q)) }, [rows, query])
  const open = (row: HadronKnowledge) => { setSelected(row); setPurpose(row.purpose ?? '') }
  const save = async (reviewStatus: 'approved' | 'rejected') => { if (!selected) return; setSaving(true); try { await reviewHadronKnowledge(selected.id, reviewStatus, { option_name: selected.option_name, module: selected.module, purpose }); toast.success(reviewStatus === 'approved' ? 'Opção aprovada para o bot.' : 'Opção rejeitada.'); setSelected(null); await load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a revisão.') } finally { setSaving(false) } }
  return <AppShell fullWidth><PageHeader title="Base Hádron" description="Revise as opções extraídas das DLLs antes de disponibilizá-las ao bot." actions={<Button variant="outline" onClick={load}><RefreshCw className="mr-2 size-4" />Atualizar</Button>} />
    <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1 sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar opção, nome ou módulo" value={query} onChange={(e) => setQuery(e.target.value)} /></div><select className="h-9 rounded-lg border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="pending">Pendentes</option><option value="approved">Aprovadas</option><option value="rejected">Rejeitadas</option><option value="all">Todas</option></select></div>
    <section className="overflow-hidden rounded-md border bg-card"><table className="w-full text-sm"><thead className="border-b bg-muted/35 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Opção</th><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Campos</th><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody className="divide-y">{filtered.map((row) => <tr key={row.id} className="hover:bg-muted/20"><td className="px-4 py-3"><b>{row.option_number}</b><div className="text-muted-foreground">{row.option_name ?? 'Nome pendente'}</div></td><td className="px-4 py-3">{row.module ?? '—'}</td><td className="px-4 py-3">{row.fields.length}</td><td className="px-4 py-3 text-xs">{row.source_file}</td><td className="px-4 py-3"><Badge variant="outline">{row.review_status}</Badge></td><td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => open(row)}>Revisar</Button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="flex min-h-44 items-center justify-center text-muted-foreground"><Database className="mr-2 size-4" />Nenhuma opção encontrada.</div>}</section>
    <Dialog open={Boolean(selected)} onOpenChange={(v) => !v && setSelected(null)}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Revisar opção {selected?.option_number}</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><div><b>{selected.option_name ?? 'Nome pendente'}</b><div className="text-sm text-muted-foreground">{selected.module ?? 'Módulo pendente'} · {selected.source_file}</div></div><div><Label htmlFor="purpose">Finalidade validada</Label><Textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={4} className="mt-2" /></div><div className="rounded-md border p-3 text-sm"><b>Campos extraídos:</b><div className="mt-2 space-y-1">{selected.fields.slice(0, 30).map((field) => <div key={field}>• {field}</div>)}</div></div></div>}<DialogFooter><Button variant="destructive" onClick={() => save('rejected')} disabled={saving}><X className="mr-2 size-4" />Rejeitar</Button><Button onClick={() => save('approved')} disabled={saving}><Check className="mr-2 size-4" />Aprovar</Button></DialogFooter></DialogContent></Dialog>
  </AppShell>
}
