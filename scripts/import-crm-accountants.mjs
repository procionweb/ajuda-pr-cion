import { createClient } from '@supabase/supabase-js'
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await supabase.from('client_companies').select('id,accountant_name,accountant_phone,accountant_email,source_payload').not('accountant_name', 'is', null)
if (error) throw error
const companies = data ?? []
const grouped = new Map()
for (const company of companies) {
  let payload = company.source_payload
  if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
  const accountantPayload = payload?.tcl_contador ?? payload?.cli_contador ?? {}
  const name = String(company.accountantName ?? company.accountant_name ?? accountantPayload.cli_ctd_res ?? accountantPayload.tcl_ctd_res ?? '').trim()
  const office = String(company.accountantOffice ?? company.accountant_office ?? accountantPayload.cli_ctd_nome ?? accountantPayload.tcl_ctd_nome ?? '').trim()
  if (!name && !office) continue
  const keyName = `${name || office}|${office}`.toLowerCase()
  const current = grouped.get(keyName) ?? { name: name || office, office: office || null, phone: company.accountantPhone ?? company.accountant_phone ?? null, email: company.accountantEmail ?? company.accountant_email ?? null, clients: [] }
  current.phone ||= accountantPayload.cli_ctd_tel ?? accountantPayload.tcl_ctd_tel ?? company.accountantPhone ?? company.accountant_phone ?? null
  current.email ||= accountantPayload.cli_ctd_email ?? accountantPayload.tcl_ctd_email ?? company.accountantEmail ?? company.accountant_email ?? null
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
