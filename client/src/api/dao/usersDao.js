import { supabase } from '../supabaseClient';

export async function list() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, role, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function update(id, payload) {
  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

export async function remove(id) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
