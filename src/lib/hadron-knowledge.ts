import { supabase } from './supabase'

export type HadronKnowledge = {
  id: string
  option_number: string
  option_name: string | null
  module: string | null
  purpose: string | null
  fields: string[]
  procedures: string[]
  common_errors: string[]
  review_status: 'pending' | 'approved' | 'rejected'
  source_file: string
  reviewed_at: string | null
}

export async function listHadronKnowledge(status = 'all') {
  let query = supabase.from('hadron_knowledge_options').select('id,option_number,option_name,module,purpose,fields,procedures,common_errors,review_status,source_file,reviewed_at').order('option_number')
  if (status !== 'all') query = query.eq('review_status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as HadronKnowledge[]
}

export async function reviewHadronKnowledge(id: string, reviewStatus: 'approved' | 'rejected', patch: Pick<HadronKnowledge, 'option_name' | 'module' | 'purpose'>) {
  const { error } = await supabase.from('hadron_knowledge_options').update({ ...patch, review_status: reviewStatus, reviewed_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
