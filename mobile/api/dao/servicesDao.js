import { supabase } from '../supabaseClient'

export async function listAll() {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, price, duration')
    .order('name')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function create(payload) {
  const body = {
    name: payload.name,
    description: payload.description || '',
    price: typeof payload.price === 'number' ? payload.price : parseFloat(payload.price) || 0,
    duration:
      payload.duration === null || payload.duration === undefined || payload.duration === ''
        ? null
        : parseInt(payload.duration, 10) || 0
  }
  const { data, error } = await supabase
    .from('services')
    .insert(body)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateById(id, payload) {
  const body = {
    name: payload.name,
    description: payload.description || '',
    price: typeof payload.price === 'number' ? payload.price : parseFloat(payload.price) || 0,
    duration:
      payload.duration === null || payload.duration === undefined || payload.duration === ''
        ? null
        : parseInt(payload.duration, 10) || 0
  }
  const { data, error } = await supabase
    .from('services')
    .update(body)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteById(id) {
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
  if (error) throw error
  return true
}
