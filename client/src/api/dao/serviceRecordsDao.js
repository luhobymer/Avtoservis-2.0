import { supabase } from '../supabaseClient';

async function attachServiceInfo(rows) {
  const items = Array.isArray(rows) ? rows : [];
  const serviceIds = [...new Set(items.map(r => r.service_id).filter(Boolean))];
  let servicesMap = {};
  if (serviceIds.length > 0) {
    const { data: servicesData, error: sError } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .in('id', serviceIds);
    if (sError) throw sError;
    (servicesData || []).forEach(s => {
      servicesMap[s.id] = s;
    });
  }
  return items.map(r => ({
    id: r.id,
    VehicleId: r.vehicle_id,
    vehicleId: r.vehicle_id,
    serviceId: r.service_id || null,
    serviceType: r.service_type,
    serviceName: servicesMap[r.service_id]?.name || null,
    servicePrice: servicesMap[r.service_id]?.price ?? null,
    serviceDuration: servicesMap[r.service_id]?.duration ?? null,
    description: r.description || '',
    mileage: r.mileage || 0,
    serviceDate: r.service_date,
    performedBy: '',
    cost: r.cost || 0,
    parts: []
  }));
}

export async function listAdmin() {
  const { data, error } = await supabase
    .from('service_history')
    .select('id, vehicle_id, service_id, service_type, mileage, service_date, description, cost, mechanic_id, created_at')
    .order('service_date', { ascending: false });
  if (error) throw error;
  return attachServiceInfo(data || []);
}

export async function listForUser(userId) {
  const { data: vehicles, error: vError } = await supabase
    .from('vehicles')
    .select('id')
    .eq('user_id', userId);
  if (vError) throw vError;
  const ids = (vehicles || []).map(v => v.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('service_history')
    .select('id, vehicle_id, service_id, service_type, mileage, service_date, description, cost, mechanic_id, created_at')
    .in('vehicle_id', ids)
    .order('service_date', { ascending: false });
  if (error) throw error;
  return attachServiceInfo(data || []);
}

export async function getById(id) {
  const { data, error } = await supabase
    .from('service_history')
    .select('id, vehicle_id, service_id, service_type, mileage, service_date, description, cost, mechanic_id, created_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  let service = null;
  if (data.service_id) {
    const { data: serviceData, error: sError } = await supabase
      .from('services')
      .select('id, name, price, duration')
      .eq('id', data.service_id)
      .single();
    if (sError) throw sError;
    service = serviceData || null;
  }
  return {
    id: data.id,
    VehicleId: data.vehicle_id,
    vehicleId: data.vehicle_id,
    serviceId: data.service_id || null,
    serviceType: data.service_type,
    serviceName: service?.name || null,
    servicePrice: service?.price ?? null,
    serviceDuration: service?.duration ?? null,
    description: data.description || '',
    mileage: data.mileage || 0,
    serviceDate: data.service_date,
    performedBy: '',
    cost: data.cost || 0,
    parts: []
  };
}

export async function create(payload) {
  const body = {
    vehicle_id: payload.vehicle_id,
    service_id: payload.service_id || payload.serviceId || null,
    service_type: payload.service_type || payload.serviceType || null,
    description: payload.description || null,
    mileage: payload.mileage != null ? Number(payload.mileage) : null,
    service_date: payload.service_date ? new Date(payload.service_date).toISOString() : null,
    cost: payload.cost != null ? Number(payload.cost) : null,
  };
  const { data, error } = await supabase
    .from('service_history')
    .insert(body)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function update(id, payload) {
  const body = {
    vehicle_id: payload.vehicle_id,
    service_id: payload.service_id || payload.serviceId || null,
    service_type: payload.service_type || payload.serviceType || null,
    description: payload.description || null,
    mileage: payload.mileage != null ? Number(payload.mileage) : null,
    service_date: payload.service_date ? new Date(payload.service_date).toISOString() : null,
    cost: payload.cost != null ? Number(payload.cost) : null,
  };
  const { error } = await supabase
    .from('service_history')
    .update(body)
    .eq('id', id);
  if (error) throw error;
}
