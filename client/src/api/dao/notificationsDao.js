import { supabase } from '../supabaseClient'

export async function listForUser(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, message, type, is_read, created_at, status, data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(n => {
    const d = n.data || {}
    const referenceId = d.referenceId || d.reference_id || d.record_id || d.appointment_id || null
    return {
      id: n.id,
      user_id: n.user_id,
      title: n.title || '',
      message: n.message || '',
      type: n.type || 'general',
      read: !!n.is_read,
      createdAt: n.created_at,
      status: n.status || 'pending',
      referenceId,
    }
  })
}

export async function markAsRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  if (error) throw error
}

export async function markAllRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteById(id) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function deleteAllForUser(userId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}
