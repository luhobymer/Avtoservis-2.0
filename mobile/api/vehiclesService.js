import * as vehiclesDao from './dao/vehiclesDao';
import axiosAuth from './axiosConfig';

// Отримання всіх транспортних засобів користувача
export const getAllVehicles = async () => {
  try {
    // userId витягується всередині DAO через токен у axiosAuth (Workers)
    return await vehiclesDao.listByUser(null);
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
    return await vehiclesDao.create(vehicleData, null);
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
    const response = await axiosAuth.get('/api/service-records', {
      params: { vehicle_id: id },
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((r) => ({
      id: r.id,
      date: r.service_date,
      type: (r.description || '').split(':')[0] || 'Сервіс',
      description: r.description || '',
      mileage: typeof r.mileage === 'number' ? r.mileage : 0,
      cost: typeof r.cost === 'number' ? r.cost : 0,
      nextServiceDue: r.next_service_date || null,
    }));
  } catch (error) {
    console.error(`[VehiclesService] Error fetching service records for vehicle ${id}:`, error);
    throw error;
  }
};
