import { createClient } from '@supabase/supabase-js'
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await supabase.rpc('list_crm_clients', { p_limit: 5000, p_offset: 0 })
if (error) throw error
const companies = (data ?? []).flatMap((client) => client.companies ?? client.client_companies ?? [])
const grouped = new Map()
for (const company of companies) {
  const name = String(company.accountantName ?? company.accountant_name ?? '').trim()
  const office = String(company.accountantOffice ?? company.accountant_office ?? company.accountant_name ?? '').trim()
  if (!name && !office) continue
  const keyName = `${name || office}|${office}`.toLowerCase()
  const current = grouped.get(keyName) ?? { name: name || office, office: office || null, phone: company.accountantPhone ?? company.accountant_phone ?? null, email: company.accountantEmail ?? company.accountant_email ?? null, clients: [] }
  current.clients.push(String(company.id ?? company.client_company_id ?? company.company_id))
  grouped.set(keyName, current)
}
let imported = 0
for (const accountant of grouped.values()) {
  const { data: existing } = await supabase.from('crm_accountants').select('id').eq('name', accountant.name).eq('office', accountant.office).maybeSingle()
  const { data: created, error: createError } = existing
    ? { data: existing, error: null }
    : await supabase.from('crm_accountants').insert({ name: accountant.name, office: accountant.office, phone: accountant.phone, email: accountant.email }).select('id').single()
  if (createError) throw createError
  const links = accountant.clients.filter(Boolean).map((client_company_id) => ({ accountant_id: created.id, client_company_id }))
  if (links.length) { const { error: linkError } = await supabase.from('crm_accountant_clients').upsert(links); if (linkError) throw linkError }
  imported += 1
}
console.log(`Contadores importados: ${imported}`)
