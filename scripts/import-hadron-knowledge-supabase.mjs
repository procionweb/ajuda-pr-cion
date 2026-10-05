import fs from 'node:fs'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const input = process.argv[2] ?? 'work/hadron-knowledge-all.json'
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const autoApprove = process.env.HADRON_AUTO_APPROVE === '1'

if (!url || !serviceKey) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
if (!fs.existsSync(input)) throw new Error(`Catálogo não encontrado: ${input}`)

const catalog = JSON.parse(fs.readFileSync(input, 'utf8'))
const rows = (catalog.records ?? []).map((record) => ({
  option_number: record.option_number,
  option_name: record.option_name,
  module: record.module,
  fields: record.fields ?? [],
  procedures: record.procedures ?? [],
  common_errors: record.errors ?? [],
  source_file: record.source_file,
  source_path: record.source_path,
  raw_strings: record.strings ?? [],
  ...(autoApprove && record.option_number && (record.fields?.length ?? 0) >= 3
    ? { review_status: 'approved', reviewed_at: new Date().toISOString(), validation_notes: 'Aprovado automaticamente por possuir número de opção e campos estruturados extraídos da DLL.' }
    : {}),
}))

const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
let imported = 0
for (let index = 0; index < rows.length; index += 100) {
  const batch = rows.slice(index, index + 100)
  const { error } = await client.from('hadron_knowledge_options').upsert(batch, { onConflict: 'option_number,source_file', ignoreDuplicates: false })
  if (error) throw error
  imported += batch.length
  console.log(`Importadas ${imported}/${rows.length}`)
}
console.log(`Concluído: ${imported} opções importadas${autoApprove ? ' com aprovação automática quando elegíveis' : ' pendentes de revisão'}.`)
