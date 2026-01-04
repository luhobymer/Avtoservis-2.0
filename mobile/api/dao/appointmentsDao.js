import { supabase } from '../supabaseClient'

const KEY = 'admin_appointments'

export async function listAdmin() {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, scheduled_time, status, service_id, user_id, vehicle_id')
    .order('scheduled_time', { ascending: false })
  if (error) throw error
  const appts = Array.isArray(data) ? data : []
  const userIds = [...new Set(appts.map(a => a.user_id).filter(Boolean))]
  const vehicleIds = [...new Set(appts.map(a => a.vehicle_id).filter(Boolean))]
  const serviceIds = [...new Set(appts.map(a => a.service_id).filter(Boolean))]
  let usersMap = {}
  let vehiclesMap = {}
  let servicesMap = {}
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds)
    ;(usersData || []).forEach(u => { usersMap[u.id] = u })
  }
  if (vehicleIds.length > 0) {
    const { data: vehiclesData } = await supabase
      .from('vehicles')
      .select('id, vin, make, model, license_plate')
      .in('id', vehicleIds)
    ;(vehiclesData || []).forEach(v => { vehiclesMap[v.id] = v })
  }
  if (serviceIds.length > 0) {
    const { data: servicesData } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .in('id', serviceIds)
    ;(servicesData || []).forEach(s => { servicesMap[s.id] = s })
  }
  const mapped = appts.map(a => ({
    id: a.id,
    dateTime: a.scheduled_time,
    clientName: usersMap[a.user_id]?.name || usersMap[a.user_id]?.email || 'Клієнт',
    vehicleMake: vehiclesMap[a.vehicle_id]?.make || '',
    vehicleModel: vehiclesMap[a.vehicle_id]?.model || '',
    vehiclePlate: vehiclesMap[a.vehicle_id]?.license_plate || '',
    serviceName: servicesMap[a.service_id]?.name || null,
    servicePrice: servicesMap[a.service_id]?.price ?? null,
    serviceDuration: servicesMap[a.service_id]?.duration ?? null,
    status: a.status || 'pending'
  }))
  return mapped
}

export async function updateStatus(id, status) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select('id, scheduled_time, status, service_id, user_id, vehicle_id')
    .single()
  if (error) throw error
  return data
}
