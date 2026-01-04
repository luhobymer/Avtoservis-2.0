import { supabase } from '../supabaseClient'

const KEY = 'admin_vehicles'

const mapVehicle = v => ({
  id: v.vin,
  vin: v.vin,
  brand: v.brand || v.make,
  model: v.model,
  year: v.year,
  licensePlate: v.license_plate,
  mileage: v.mileage,
  color: v.color
})

export async function listByUser(userId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('vin, make, model, year, license_plate, mileage, color')
    .eq('user_id', userId)
    .order('year', { ascending: false })
  if (error) throw error
  return (data || []).map(mapVehicle)
}

export async function getById(vin) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('vin, make, model, year, license_plate, mileage, color')
    .eq('vin', vin)
    .single()
  if (error) throw error
  return mapVehicle(data)
}

export async function create(payload, userId) {
  const body = {
    vin: payload.vin,
    user_id: userId,
    make: payload.make || payload.brand,
    model: payload.model,
    year: payload.year,
    license_plate: payload.licensePlate,
    color: payload.color,
    mileage: payload.mileage ? Number(payload.mileage) : null
  }
  const { data, error } = await supabase
    .from('vehicles')
    .insert(body)
    .select('vin, make, model, year, license_plate, mileage, color')
    .single()
  if (error) throw error
  return mapVehicle(data)
}

export async function updateById(vin, data) {
  const { data: updated, error } = await supabase
    .from('vehicles')
    .update(data)
    .eq('vin', vin)
    .select('vin, make, model, year, license_plate, mileage, color')
    .single()
  if (error) throw error
  return mapVehicle(updated)
}

export async function deleteById(vin) {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('vin', vin)
  if (error) throw error
  return true
}

export async function listByVins(vins) {
  if (!Array.isArray(vins) || vins.length === 0) return []
  const { data, error } = await supabase
    .from('vehicles')
    .select('vin, make, model, year, license_plate, mileage, color')
    .in('vin', vins)
  if (error) throw error
  return (data || []).map(mapVehicle)
}

export async function listAllAdmin() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('vin, make, model, year, license_plate, user_id')
  if (error) throw error
  const list = Array.isArray(data) ? data : []
  const userIds = [...new Set(list.map(v => v.user_id).filter(Boolean))]
  const usersMap = {}
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds)
    ;(usersData || []).forEach(u => { usersMap[u.id] = u })
  }
  const mapped = list.map(v => ({
    id: v.vin,
    make: v.make,
    model: v.model,
    year: v.year,
    licensePlate: v.license_plate,
    status: 'active',
    ownerName: usersMap[v.user_id]?.name || usersMap[v.user_id]?.email || '—'
  }))
  return mapped
}
