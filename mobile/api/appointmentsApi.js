import { supabase } from './supabaseClient';

// Отримання всіх записів на обслуговування користувача
export const getUserAppointments = async (token) => {
  try {
    console.log('[API] Запит записів на сервіс з токеном:', token ? 'Токен існує' : 'Токен відсутній');
    
    // Спробуємо отримати дані з API
    const { data, error } = await supabase
      .from('appointments')
      .select('id, user_id, vehicle_id, service_id, service_type, scheduled_time, status, notes')
      .order('scheduled_time', { ascending: true });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return [];
    }
    const vehicleIds = [...new Set(rows.map(r => r.vehicle_id).filter(Boolean))];
    const serviceIds = [...new Set(rows.map(r => r.service_id).filter(Boolean))];
    let vehiclesMap = {};
    let servicesMap = {};
    if (vehicleIds.length) {
      const { data: vehicles, error: vErr } = await supabase
        .from('vehicles')
        .select('id, vin, make, model, year')
        .in('id', vehicleIds);
      if (vErr) throw vErr;
      vehiclesMap = Object.fromEntries((vehicles || []).map(v => [v.id, v]));
    }
    if (serviceIds.length) {
      const { data: services, error: sErr } = await supabase
        .from('services')
        .select('id, name, price')
        .in('id', serviceIds);
      if (sErr) throw sErr;
      servicesMap = Object.fromEntries((services || []).map(s => [s.id, s]));
    }
    return rows.map(r => {
      const v = vehiclesMap[r.vehicle_id];
      const s = servicesMap[r.service_id];
      const vehicleVin = v ? v.vin : null;
      const vehicleInfo = v ? `${v.make} ${v.model} (${v.year})` : '';
      return {
        ...r,
        vehicle_vin: vehicleVin,
        vehicle_info: vehicleInfo,
        service_name: s ? s.name : null,
        service_price: s && s.price !== undefined && s.price !== null ? s.price : null
      };
    });
  } catch (error) {
    console.error('Помилка при отриманні записів на обслуговування:', error);
    throw error;
  }
};

// Отримання деталей запису на обслуговування
export const getAppointmentDetails = async (appointmentId, token) => {
  try {
    console.log('[API] Запит деталей запису на сервіс ID:', appointmentId);
    
    // Спробуємо отримати дані з API
    const { data, error } = await supabase
      .from('appointments')
      .select('id, user_id, vehicle_id, service_id, service_type, scheduled_time, status, notes')
      .eq('id', appointmentId)
      .single();
    if (error) throw error;
    let vin = null;
    let serviceName = null;
    let servicePrice = null;
    if (data?.vehicle_id) {
      const { data: v } = await supabase
        .from('vehicles')
        .select('vin')
        .eq('id', data.vehicle_id)
        .single();
      vin = v?.vin || null;
    }
    if (data?.service_id) {
      const { data: s } = await supabase
        .from('services')
        .select('name, price')
        .eq('id', data.service_id)
        .single();
      if (s) {
        serviceName = s.name || null;
        servicePrice = s.price !== undefined && s.price !== null ? s.price : null;
      }
    }
    return { ...data, vehicle_vin: vin, service_name: serviceName, service_price: servicePrice };
  } catch (error) {
    console.error('Помилка при отриманні деталей запису:', error);
    throw error;
  }
};

// Створення нового запису на обслуговування
export const createAppointment = async (appointmentData, token) => {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Помилка при створенні запису на обслуговування:', error);
    throw error;
  }
};

// Оновлення запису на обслуговування
export const updateAppointment = async (appointmentId, appointmentData, token) => {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .update(appointmentData)
      .eq('id', appointmentId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Помилка при оновленні запису (ID: ${appointmentId}):`, error);
    throw error;
  }
};

// Скасування запису на обслуговування
export const cancelAppointment = async (appointmentId, token) => {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Помилка при скасуванні запису (ID: ${appointmentId}):`, error);
    throw error;
  }
};
