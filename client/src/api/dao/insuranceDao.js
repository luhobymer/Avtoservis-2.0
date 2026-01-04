import { supabase } from '../supabaseClient'

export async function listAll() {
  const { data, error } = await supabase
    .from('insurance')
    .select('id, vehicle_vin, policy_number, insurance_company, start_date, end_date, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function create(payload) {
  const body = {
    vehicle_vin: payload.vehicle_vin,
    policy_number: payload.policy_number,
    insurance_company: payload.insurance_company,
    start_date: payload.start_date ? new Date(payload.start_date).toISOString() : null,
    end_date: payload.end_date ? new Date(payload.end_date).toISOString() : null,
  }
  const { data, error } = await supabase
    .from('insurance')
    .insert(body)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateById(id, payload) {
  const body = {
    vehicle_vin: payload.vehicle_vin,
    policy_number: payload.policy_number,
    insurance_company: payload.insurance_company,
    start_date: payload.start_date ? new Date(payload.start_date).toISOString() : null,
    end_date: payload.end_date ? new Date(payload.end_date).toISOString() : null,
  }
  const { data, error } = await supabase
    .from('insurance')
    .update(body)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteById(id) {
  const { error } = await supabase
    .from('insurance')
    .delete()
    .eq('id', id)
  if (error) throw error
  return true
}
