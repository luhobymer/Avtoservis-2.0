import { supabase } from '../supabaseClient'

export async function listAll() {
  const { data, error } = await supabase
    .from('parts')
    .select('id, name, description, price, stock')
    .order('name')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function create(payload) {
  const body = {
    name: payload.name,
    description: payload.description || '',
    price: Number(payload.price) || 0,
    stock: Number(payload.stock) || 0
  }
  const { data, error } = await supabase
    .from('parts')
    .insert(body)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateById(id, payload) {
  const { data, error } = await supabase
    .from('parts')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteById(id) {
  const { error } = await supabase
    .from('parts')
    .delete()
    .eq('id', id)
  if (error) throw error
  return true
}
