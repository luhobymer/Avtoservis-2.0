import { supabase } from '../supabaseClient';

function mapStatus(status) {
  if (status === 'pending') return 'scheduled';
  if (status === 'confirmed') return 'in-progress';
  if (status === 'canceled') return 'cancelled';
  return status || 'scheduled';
}

export async function listAdmin() {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, user_id, vehicle_vin, service_id, service_type, scheduled_time, status, updated_at, description, notes, estimated_completion_date, actual_completion_date'
    )
    .order('scheduled_time', { ascending: false });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const serviceIds = [...new Set(rows.map(a => a.service_id).filter(Boolean))];
  let servicesMap = {};
  if (serviceIds.length > 0) {
    const { data: servicesData } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .in('id', serviceIds);
    (servicesData || []).forEach(s => {
      servicesMap[s.id] = s;
    });
  }
  return rows.map(a => ({
    id: a.id,
    UserId: a.user_id,
    vehicle_vin: a.vehicle_vin,
    serviceId: a.service_id || null,
    serviceType: a.service_type,
    serviceName: servicesMap[a.service_id]?.name || null,
    servicePrice: servicesMap[a.service_id]?.price ?? null,
    serviceDuration: servicesMap[a.service_id]?.duration ?? null,
    scheduledDate: a.scheduled_time,
    estimatedCompletionDate: a.estimated_completion_date || null,
    actualCompletionDate: a.actual_completion_date || null,
    status: mapStatus(a.status),
    description: a.description || '',
    notes: a.notes || ''
  }));
}

export async function update(id, payload) {
  const { error } = await supabase
    .from('appointments')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

export async function listForUser(userId) {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, user_id, vehicle_vin, service_id, service_type, scheduled_time, status, updated_at, description, notes, estimated_completion_date, actual_completion_date'
    )
    .eq('user_id', userId)
    .order('scheduled_time', { ascending: false });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const serviceIds = [...new Set(rows.map(a => a.service_id).filter(Boolean))];
  let servicesMap = {};
  if (serviceIds.length > 0) {
    const { data: servicesData } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .in('id', serviceIds);
    (servicesData || []).forEach(s => {
      servicesMap[s.id] = s;
    });
  }
  return rows.map(a => ({
    id: a.id,
    UserId: a.user_id,
    vehicle_vin: a.vehicle_vin,
    serviceId: a.service_id || null,
    serviceType: a.service_type,
    serviceName: servicesMap[a.service_id]?.name || null,
    servicePrice: servicesMap[a.service_id]?.price ?? null,
    serviceDuration: servicesMap[a.service_id]?.duration ?? null,
    scheduledDate: a.scheduled_time,
    estimatedCompletionDate: a.estimated_completion_date || null,
    actualCompletionDate: a.actual_completion_date || null,
    status: mapStatus(a.status),
    description: a.description || '',
    notes: a.notes || ''
  }));
}

export async function getById(id) {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, user_id, vehicle_vin, service_id, service_type, scheduled_time, status, updated_at, description, notes, estimated_completion_date, actual_completion_date'
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  let service = null;
  if (data.service_id) {
    const { data: serviceData } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .eq('id', data.service_id)
      .single();
    service = serviceData || null;
  }
  return {
    id: data.id,
    UserId: data.user_id,
    vehicle_vin: data.vehicle_vin,
    serviceId: data.service_id || null,
    serviceType: data.service_type,
    serviceName: service?.name || null,
    servicePrice: service?.price ?? null,
    serviceDuration: service?.duration ?? null,
    scheduledDate: data.scheduled_time,
    status: mapStatus(data.status),
    description: data.description || '',
    notes: data.notes || '',
    estimatedCompletionDate: data.estimated_completion_date || null,
    actualCompletionDate: data.actual_completion_date || null
  };
}

export async function create(payload) {
  const body = {
    user_id: payload.user_id,
    vehicle_vin: payload.vehicle_vin,
    service_id: payload.service_id || payload.serviceId || null,
    service_type: payload.service_type || payload.serviceType || null,
    scheduled_time: payload.scheduled_time,
    status: payload.status || 'pending',
    description: payload.description || null,
    notes: payload.notes || null,
    estimated_completion_date: payload.estimated_completion_date || null,
    actual_completion_date: payload.actual_completion_date || null
  };
  const { data, error } = await supabase
    .from('appointments')
    .insert(body)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
