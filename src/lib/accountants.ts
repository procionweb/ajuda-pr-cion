import { supabase } from './supabase'
export type Accountant = { id: string; name: string; office: string | null; document: string | null; phone: string | null; email: string | null; notes: string | null }
export async function listAccountants() { const { data, error } = await supabase.from('crm_accountants').select('*').order('name'); if (error) throw error; return (data ?? []) as Accountant[] }
export async function createAccountant(input: Omit<Accountant, 'id'>) { const { data, error } = await supabase.from('crm_accountants').insert(input).select('*').single(); if (error) throw error; return data as Accountant }
