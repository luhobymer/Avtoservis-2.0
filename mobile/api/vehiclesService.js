import { supabase } from './supabaseClient';
import * as vehiclesDao from './dao/vehiclesDao';

// Отримання всіх транспортних засобів користувача
export const getAllVehicles = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data?.user?.id;
    if (!userId) return [];
    return await vehiclesDao.listByUser(userId);
  } catch (error) {
    console.error('[VehiclesService] Error fetching vehicles:', error);
    throw error;
  }
};

// Отримання транспортного засобу за ID
export const getVehicleById = async (id) => {
  try {
    return await vehiclesDao.getById(id);
  } catch (error) {
    console.error(`[VehiclesService] Error fetching vehicle ${id}:`, error);
    throw error;
  }
};

// Створення нового транспортного засобу
export const createVehicle = async (vehicleData) => {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data?.user?.id;
    if (!userId) throw new Error('No user session');
    return await vehiclesDao.create(vehicleData, userId);
  } catch (error) {
    console.error('[VehiclesService] Error creating vehicle:', error);
    throw error;
  }
};

// Оновлення транспортного засобу
export const updateVehicle = async (id, vehicleData) => {
  try {
    return await vehiclesDao.updateById(id, vehicleData);
  } catch (error) {
    console.error(`[VehiclesService] Error updating vehicle ${id}:`, error);
    throw error;
  }
};

// Видалення транспортного засобу
export const deleteVehicle = async (id) => {
  try {
    await vehiclesDao.deleteById(id);
    return { success: true };
  } catch (error) {
    console.error(`[VehiclesService] Error deleting vehicle ${id}:`, error);
    throw error;
  }
};

// Отримання сервісних записів для транспортного засобу
export const getVehicleServiceRecords = async (id) => {
  try {
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(String(id));
    let vehicleId = isUuid ? id : null;
    if (!vehicleId) {
      const { data: v } = await supabase
        .from('vehicles')
        .select('id')
        .eq('vin', id)
        .single();
      vehicleId = v?.id || null;
    }
    if (!vehicleId) return [];
    const { data, error } = await supabase
      .from('service_history')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('service_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`[VehiclesService] Error fetching service records for vehicle ${id}:`, error);
    throw error;
  }
};
