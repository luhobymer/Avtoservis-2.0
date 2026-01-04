import { supabase } from '../supabaseClient'

export async function listAll() {
  const { data, error } = await supabase
    .from('parts')
    .select('id, name, article, manufacturer, price, warranty_period')
    .order('id', { ascending: false })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function create(payload) {
  const body = {
    name: payload.name || '',
    article: payload.article || null,
    manufacturer: payload.manufacturer || null,
    price: payload.price != null ? Number(payload.price) : null,
    warranty_period: payload.warranty_period != null ? Number(payload.warranty_period) : null,
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
  const body = {
    name: payload.name || '',
    article: payload.article || null,
    manufacturer: payload.manufacturer || null,
    price: payload.price != null ? Number(payload.price) : null,
    warranty_period: payload.warranty_period != null ? Number(payload.warranty_period) : null,
  }
  const { data, error } = await supabase
    .from('parts')
    .update(body)
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
