import { supabase } from '../supabaseClient'

const KEY = 'admin_users'

export async function listAll() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, active')
    .order('name')
  if (error) throw error
  const mapped = (data || []).map(u => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email,
    role: u.role || 'client',
    status: u.active ? 'active' : 'inactive'
  }))
  return mapped
}

export async function updateStatus(userId, status) {
  const { error } = await supabase
    .from('users')
    .update({ active: status === 'active' })
    .eq('id', userId)
  if (error) throw error
  return true
}

export async function updateRole(userId, role) {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)
  if (error) throw error
  return true
}
