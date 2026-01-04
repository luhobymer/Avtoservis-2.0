import { supabase } from './supabaseClient';

// Отримання всіх сервісних записів користувача
export const getAllServiceRecords = async () => {
  try {
    const { data, error } = await supabase
      .from('service_records')
      .select('id, vehicle_id, description, cost, service_date, mileage')
      .order('service_date', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[ServiceRecordsService] Помилка при отриманні сервісних записів:', error);
    throw error;
  }
};

// Отримання сервісного запису за ID
export const getServiceRecordById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('service_records')
      .select('id, vehicle_id, description, cost, service_date, mileage')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data) throw new Error('Запис не знайдено');

    let vehicleVin = null;
    if (data.vehicle_id) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('vin, make, model, year')
        .eq('id', data.vehicle_id)
        .single();
      vehicleVin = vehicle?.vin || null;
      return { ...data, vehicle_vin: vehicleVin, vehicle_info: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : '' };
    }
    return { ...data, vehicle_vin: null, vehicle_info: '' };
  } catch (error) {
    console.error(`[ServiceRecordsService] Помилка при отриманні сервісного запису ${id}:`, error);
    throw error;
  }
};

// Створення нового сервісного запису
export const createServiceRecord = async (serviceRecordData) => {
  try {
    let vehicleId = null;
    if (serviceRecordData.vehicle_vin) {
      const { data: v } = await supabase
        .from('vehicles')
        .select('id')
        .eq('vin', serviceRecordData.vehicle_vin)
        .single();
      vehicleId = v?.id || null;
    } else if (serviceRecordData.vehicle_id) {
      vehicleId = serviceRecordData.vehicle_id;
    }

    const body = {
      vehicle_id: vehicleId,
      service_date: serviceRecordData.date || serviceRecordData.service_date || new Date().toISOString(),
      mileage: typeof serviceRecordData.mileage === 'number' ? serviceRecordData.mileage : parseInt(serviceRecordData.mileage) || null,
      description: serviceRecordData.description || '',
      cost: typeof serviceRecordData.cost === 'number' ? serviceRecordData.cost : parseFloat(serviceRecordData.cost) || 0
    };

    const { data, error } = await supabase
      .from('service_records')
      .insert(body)
      .select('id, vehicle_id, description, cost, service_date, mileage')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[ServiceRecordsService] Помилка створення сервісного запису:', error);
    throw error;
  }
};

// Оновлення сервісного запису
export const updateServiceRecord = async (id, serviceRecordData) => {
  try {
    const { data, error } = await supabase
      .from('service_records')
      .update({
        description: serviceRecordData.description,
        service_date: serviceRecordData.date || serviceRecordData.service_date,
        mileage: typeof serviceRecordData.mileage === 'number' ? serviceRecordData.mileage : parseInt(serviceRecordData.mileage) || null,
        cost: typeof serviceRecordData.cost === 'number' ? serviceRecordData.cost : parseFloat(serviceRecordData.cost) || 0
      })
      .eq('id', id)
      .select('id, vehicle_id, description, cost, service_date, mileage')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`[ServiceRecordsService] Error updating service record ${id}:`, error);
    throw error;
  }
};

// Видалення сервісного запису
export const deleteServiceRecord = async (id, token) => {
  try {
    const { error } = await supabase
      .from('service_records')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true, id };
  } catch (error) {
    console.error(`[ServiceRecordsService] Error deleting service record ${id}:`, error);
    throw error;
  }
};
