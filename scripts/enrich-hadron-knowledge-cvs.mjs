import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const catalogPath = process.argv[2] ?? 'work/hadron-knowledge-all.json'
if (!url || !serviceKey) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')

const stripHtml = (value = '') => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const releasesFile = JSON.parse(fs.readFileSync('src/data/cvs-releases.json', 'utf8'))
const parametersFile = JSON.parse(fs.readFileSync('src/data/cvs-parameters.json', 'utf8'))
const releases = releasesFile?.[2]?.data ?? releasesFile.data ?? releasesFile
const parameters = parametersFile?.[2]?.data ?? parametersFile.data ?? parametersFile
const byOption = new Map()
for (const item of [...releases, ...parameters]) {
  const option = String(item.opcao ?? item.formulario ?? item.cvs_options_opcao ?? '').trim()
  if (!option) continue
  const text = stripHtml([item.descricao, item.descricao_opcao, item.par_title, item.par_description, item.par_text].filter(Boolean).join(' '))
  if (!text) continue
  const current = byOption.get(option) ?? []
  current.push(text)
  byOption.set(option, current)
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
let enriched = 0
for (const record of catalog.records ?? []) {
  const texts = byOption.get(String(record.option_number)) ?? []
  if (!texts.length) continue
  const purpose = [...new Set(texts)].slice(0, 12).join('\n\n').slice(0, 12000)
  const { error } = await client.from('hadron_knowledge_options').update({
    purpose,
    validation_notes: 'Enriquecido automaticamente com releases e parâmetros CVS; revisar conflitos antes de alterar o procedimento.',
    updated_at: new Date().toISOString(),
  }).eq('option_number', record.option_number)
  if (error) throw error
  enriched += 1
}
console.log(`Opções enriquecidas com CVS: ${enriched}`)
