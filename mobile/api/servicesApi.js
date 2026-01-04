import { supabase } from './supabaseClient';

// Отримання всіх послуг (публічний endpoint)
export const getAllServices = async () => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, description, price, duration, category');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Помилка при отриманні послуг:', error);
    throw error;
  }
};

// Отримання всіх сервісних записів користувача
export const getUserServiceRecords = async (token) => {
  try {
    // Припускаємо, що є окремий endpoint для service records
    const { data, error } = await supabase
      .from('service_records')
      .select('id, vehicle_vin, service_details, cost, performed_at, mechanic_notes, service_date')
      .order('service_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Помилка при отриманні сервісних записів:', error);
    throw error;
  }
};

// Отримання деталей послуги за ID
export const getServiceById = async (serviceId) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Помилка при отриманні деталей послуги (ID: ${serviceId}):`, error);
    throw error;
  }
};

// Отримання деталей сервісного запису
export const getServiceRecordDetails = async (recordId, token) => {
  try {
    const { data, error } = await supabase
      .from('service_records')
      .select('*')
      .eq('id', recordId)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Помилка при отриманні деталей сервісного запису (ID: ${recordId}):`, error);
    throw error;
  }
};

// Додавання нового сервісного запису
export const addServiceRecord = async (recordData, token) => {
  try {
    const { data, error } = await supabase
      .from('service_records')
      .insert(recordData)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Помилка при додаванні сервісного запису:', error);
    throw error;
  }
};

// Оновлення існуючого сервісного запису
export const updateServiceRecord = async (recordId, recordData, token) => {
  try {
    const { data, error } = await supabase
      .from('service_records')
      .update(recordData)
      .eq('id', recordId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Помилка при оновленні сервісного запису (ID: ${recordId}):`, error);
    throw error;
  }
};

// Видалення сервісного запису
export const deleteServiceRecord = async (recordId, token) => {
  try {
    const { error } = await supabase
      .from('service_records')
      .delete()
      .eq('id', recordId);
    if (error) throw error;
    return { success: true, id: recordId };
  } catch (error) {
    console.error(`Помилка при видаленні сервісного запису (ID: ${recordId}):`, error);
    throw error;
  }
};
