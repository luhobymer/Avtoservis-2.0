import { supabase } from './supabaseClient';

// Отримання всіх записів на обслуговування користувача
export const getAllAppointments = async (token) => {
  try {
    console.log('[API] Запит записів на обслуговування');
    
    const { data, error } = await supabase
      .from('appointments')
      .select('id, user_id, vehicle_id, service_id, service_type, scheduled_time, status, notes, created_at, updated_at')
      .order('scheduled_time', { ascending: true });
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    const vehicleIds = [...new Set(data.map(a => a.vehicle_id).filter(Boolean))];
    const serviceIds = [...new Set(data.map(a => a.service_id).filter(Boolean))];
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
        .select('id, name, price, duration')
        .in('id', serviceIds);
      if (sErr) throw sErr;
      servicesMap = Object.fromEntries((services || []).map(s => [s.id, s]));
    }
    return data.map(a => {
      const v = vehiclesMap[a.vehicle_id];
      const s = servicesMap[a.service_id];
      const vehicleInfo = v ? `${v.make} ${v.model} (${v.year})` : '';
      const vehicleVin = v ? v.vin : null;
      const serviceName = s ? s.name : null;
      const servicePrice = s && s.price !== undefined && s.price !== null ? s.price : null;
      const serviceDuration = s && s.duration !== undefined && s.duration !== null ? s.duration : null;
      return {
        ...a,
        vehicle_info: vehicleInfo,
        vehicle_vin: vehicleVin,
        service_name: serviceName,
        service_price: servicePrice,
        service_duration: serviceDuration
      };
    });
  } catch (error) {
    console.error('[AppointmentsService] Помилка при отриманні записів:', error);
    throw error;
  }
};

// Отримання запису на обслуговування за ID
export const getAppointmentById = async (id, token) => {
  try {
    console.log(`[API] Запит запису на обслуговування з ID ${id}`);
    
    const { data, error } = await supabase
      .from('appointments')
      .select('id, user_id, vehicle_id, service_id, service_type, scheduled_time, status, notes, created_at, updated_at')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data) {
      throw new Error('Запис не знайдено');
    }
    let vin = null;
    let vehicleInfo = '';
    let serviceName = null;
    let servicePrice = null;
    let serviceDuration = null;
    if (data.vehicle_id) {
      const { data: v } = await supabase
        .from('vehicles')
        .select('vin, make, model, year')
        .eq('id', data.vehicle_id)
        .single();
      if (v) {
        vin = v.vin || null;
        vehicleInfo = `${v.make} ${v.model} (${v.year})`;
      }
    }
    if (data.service_id) {
      const { data: s } = await supabase
        .from('services')
        .select('name, price, duration')
        .eq('id', data.service_id)
        .single();
      if (s) {
        serviceName = s.name || null;
        servicePrice = s.price !== undefined && s.price !== null ? s.price : null;
        serviceDuration = s.duration !== undefined && s.duration !== null ? s.duration : null;
      }
    }
    return {
      ...data,
      vehicle_vin: vin,
      vehicle_info: vehicleInfo,
      service_name: serviceName,
      service_price: servicePrice,
      service_duration: serviceDuration
    };
  } catch (error) {
    console.error('[appointmentsService] Помилка при отриманні деталей запису:', error);
    throw error;
  }
};

// Створення нового запису на обслуговування
export const createAppointment = async (appointmentData, token) => {
  try {
    console.log('[API] Створення нового запису на обслуговування:', appointmentData);
    
  let vehicleId = appointmentData.vehicle_id || null;
  if (!vehicleId && appointmentData.vehicle_vin) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('id')
      .eq('vin', appointmentData.vehicle_vin)
      .single();
    vehicleId = vehicle?.id || null;
  }
  const body = {
    user_id: appointmentData.user_id,
    vehicle_id: vehicleId,
    mechanic_id: appointmentData.mechanic_id || appointmentData.master_id || null,
    service_id: appointmentData.service_id || null,
    scheduled_time: appointmentData.scheduled_time,
    service_type: appointmentData.service_type,
    status: appointmentData.status || 'pending',
    notes: appointmentData.notes || ''
  };
    const { data, error } = await supabase
      .from('appointments')
      .insert(body)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[AppointmentsService] Помилка при створенні запису:', error);
    throw error;
  }
};

// Оновлення запису на обслуговування
export const updateAppointment = async (id, appointmentData, token) => {
  try {
    console.log(`[API] Оновлення запису на обслуговування ${id}:`, appointmentData);
    
    const { vehicle_vin, ...safeData } = appointmentData;
    const { data, error } = await supabase
      .from('appointments')
      .update({ ...safeData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`[AppointmentsService] Помилка при оновленні запису ${id}:`, error);
    throw error;
  }
};

// Видалення запису на обслуговування
export const deleteAppointment = async (id, token) => {
  try {
    console.log(`[API] Видалення запису на обслуговування ${id}`);
    
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true, id };
  } catch (error) {
    console.error(`[AppointmentsService] Помилка при видаленні запису ${id}:`, error);
    throw error;
  }
};

// Підтвердження запису на обслуговування
export const confirmAppointment = async (id, token) => {
  try {
    console.log(`[API] Підтвердження запису на обслуговування ${id}`);
    
    const updateData = {
      status: 'confirmed',
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`[AppointmentsService] Помилка при підтвердженні запису ${id}:`, error);
    throw error;
  }
};

// Позначення запису як "в процесі"
export const startAppointment = async (id, token) => {
  try {
    console.log(`[API] Позначення запису ${id} як "в процесі"`);
    
    const updateData = {
      status: 'in_progress',
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`[AppointmentsService] Помилка при позначенні запису ${id} як "в процесі":`, error);
    throw error;
  }
};

// Завершення запису на обслуговування
export const completeAppointment = async (id, completionData, token) => {
  try {
    console.log(`[API] Завершення запису на обслуговування ${id}:`, completionData);
    
    const updateData = {
      status: 'completed',
      completion_notes: completionData.notes || '',
      completion_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`[AppointmentsService] Помилка при завершенні запису ${id}:`, error);
    throw error;
  }
};

// Скасування запису на обслуговування
export const cancelAppointment = async (id, cancellationData, token) => {
  try {
    console.log(`[API] Скасування запису на обслуговування ${id}:`, cancellationData);
    
    const updateData = {
      status: 'cancelled',
      cancellation_reason: cancellationData.reason || '',
      cancellation_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (data && data.user_id) {
      await supabase
        .from('scheduled_notifications')
        .delete()
        .eq('user_id', data.user_id)
        .eq('is_sent', false)
        .contains('data', { appointment_id: id });
    }
    return data;
  } catch (error) {
    console.error(`[AppointmentsService] Помилка при скасуванні запису ${id}:`, error);
    throw error;
  }
};
