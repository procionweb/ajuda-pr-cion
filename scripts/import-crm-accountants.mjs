import { createClient } from '@supabase/supabase-js'
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await supabase.from('client_companies').select('id,accountant_name,accountant_phone,accountant_email,source_payload')
if (error) throw error
const companies = data ?? []
const parseObject = (value) => {
  if (value && typeof value === 'object') return value
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return {} }
  }
  return {}
}
const grouped = new Map()
for (const company of companies) {
  const payload = parseObject(company.source_payload)
  const accountantPayload = parseObject(payload?.tcl_contador ?? payload?.cli_contador)
  const responsiblePayload = parseObject(payload?.tcl_responsavel ?? payload?.cli_responsavel)
  const name = String(accountantPayload.cli_ctd_res ?? accountantPayload.tcl_ctd_res ?? company.accountantName ?? '').trim()
  const office = String(accountantPayload.cli_ctd_nome ?? accountantPayload.tcl_ctd_nome ?? company.accountantOffice ?? company.accountant_office ?? company.accountant_name ?? '').trim()
  const address = String(responsiblePayload.cli_res_endereco ?? responsiblePayload.tcl_res_endereco ?? '').trim() || null
  const number = String(responsiblePayload.cli_res_numero ?? responsiblePayload.tcl_res_numero ?? '').trim() || null
  const complement = String(responsiblePayload.cli_res_complemento ?? responsiblePayload.tcl_res_complemento ?? '').trim() || null
  const neighborhood = String(responsiblePayload.cli_res_bairro ?? responsiblePayload.tcl_res_bairro ?? '').trim() || null
  const city = String(responsiblePayload.cli_res_cidade ?? responsiblePayload.tcl_res_cidade ?? '').trim() || null
  const state = String(responsiblePayload.cli_res_uf ?? responsiblePayload.tcl_res_uf ?? '').trim() || null
  const postal_code = String(responsiblePayload.cli_res_cep ?? responsiblePayload.tcl_res_cep ?? '').trim() || null
  if (!name && !office) continue
  const keyName = `${name || office}|${office}`.toLowerCase()
  const current = grouped.get(keyName) ?? { name: name || office, office: office || null, phone: company.accountantPhone ?? company.accountant_phone ?? null, email: company.accountantEmail ?? company.accountant_email ?? null, address, number, complement, neighborhood, city, state, postal_code, clients: [] }
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
    : await supabase.from('crm_accountants').insert({ name: accountant.name, office: accountant.office, phone: accountant.phone, email: accountant.email, address: accountant.address, number: accountant.number, complement: accountant.complement, neighborhood: accountant.neighborhood, city: accountant.city, state: accountant.state, postal_code: accountant.postal_code }).select('id').single()
  if (createError) throw createError
  if (existing) {
    const { error: updateError } = await supabase.from('crm_accountants').update({ office: accountant.office, phone: accountant.phone, email: accountant.email, address: accountant.address, number: accountant.number, complement: accountant.complement, neighborhood: accountant.neighborhood, city: accountant.city, state: accountant.state, postal_code: accountant.postal_code }).eq('id', created.id)
    if (updateError) throw updateError
  }
  const links = accountant.clients.filter(Boolean).map((client_company_id) => ({ accountant_id: created.id, client_company_id }))
  if (links.length) { const { error: linkError } = await supabase.from('crm_accountant_clients').upsert(links); if (linkError) throw linkError }
  imported += 1
}
console.log(`Contadores importados: ${imported}`)
