import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, RefreshCw, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, PageHeader } from '@/components/portal/AppShell'
import { Button } from '@/components/ui/button'
import { getAccountant } from '@/lib/accountants'

export const Route = createFileRoute('/clientes/contadores/$accountantId')({ component: AccountantDetailsPage })

function AccountantDetailsPage() {
  const { accountantId } = Route.useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { setData(await getAccountant(accountantId)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível carregar o contador.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [accountantId])
  return <AppShell fullWidth><PageHeader title={data?.name || 'Detalhes do contador'} description="Clientes vinculados a este contador." actions={<><Button variant="outline" asChild><Link to="/clientes/contadores"><ArrowLeft className="mr-2 size-4" />Voltar</Link></Button><Button variant="outline" onClick={load}><RefreshCw className="mr-2 size-4" />Atualizar</Button></>} />{loading ? <div className="rounded-md border bg-card p-10 text-center text-muted-foreground">Carregando...</div> : !data ? <div className="rounded-md border bg-card p-10 text-center text-muted-foreground">Contador não encontrado.</div> : <div className="grid gap-4 lg:grid-cols-[320px_1fr]"><section className="rounded-md border bg-card p-5"><h2 className="text-lg font-medium">Dados do contador</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-muted-foreground">Escritório</dt><dd>{data.office || '—'}</dd></div><div><dt className="text-muted-foreground">E-mail</dt><dd>{data.email || '—'}</dd></div><div><dt className="text-muted-foreground">Telefone</dt><dd>{data.phone || '—'}</dd></div><div><dt className="text-muted-foreground">Documento</dt><dd>{data.document || '—'}</dd></div></dl></section><section className="overflow-hidden rounded-md border bg-card"><div className="flex items-center gap-2 border-b px-5 py-4"><UsersRound className="size-5 text-primary" /><h2 className="text-lg font-medium">Clientes vinculados ({data.clientIds.length})</h2></div>{data.clientIds.length ? <div className="divide-y">{data.clientIds.map((id: string) => <div className="px-5 py-3 text-sm" key={id}>{id}</div>)}</div> : <div className="p-10 text-center text-muted-foreground">Nenhum cliente vinculado.</div>}</section></div>}</AppShell>
}
