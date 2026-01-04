import { supabase } from '../supabaseClient';

export async function list() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, user_id, vin, make, model, year, license_plate, mileage, color, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(v => ({
    id: v.id,
    make: v.make,
    model: v.model,
    year: v.year,
    vin: v.vin,
    licensePlate: v.license_plate || '',
    mileage: v.mileage || 0,
    color: v.color || '',
    UserId: v.user_id || null
  }));
}

export async function listForUser(userId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, user_id, vin, make, model, year, license_plate, mileage, color, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(v => ({
    id: v.id,
    make: v.make,
    model: v.model,
    year: v.year,
    vin: v.vin,
    licensePlate: v.license_plate || '',
    mileage: v.mileage || 0,
    color: v.color || '',
    UserId: v.user_id || null
  }));
}

export async function update(id, payload) {
  const { error } = await supabase
    .from('vehicles')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

export async function getById(id) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, user_id, vin, make, model, year, license_plate, mileage, color, updated_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    make: data.make,
    model: data.model,
    year: data.year,
    vin: data.vin,
    licensePlate: data.license_plate || '',
    mileage: data.mileage || 0,
    color: data.color || '',
    UserId: data.user_id || null
  };
}

export async function create(payload) {
  const body = {
    make: payload.make || payload.brand || '',
    model: payload.model || '',
    year: payload.year ? Number(payload.year) : null,
    vin: payload.vin || '',
    license_plate: payload.licensePlate || payload.license_plate || null,
    mileage: payload.mileage != null ? Number(payload.mileage) : null,
    color: payload.color || null,
  };
  const { data, error } = await supabase
    .from('vehicles')
    .insert(body)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function remove(id) {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
