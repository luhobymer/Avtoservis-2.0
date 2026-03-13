import * as vehiclesDao from './dao/vehiclesDao';
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';

// Функція для отримання списку автомобілів користувача
export const getUserVehicles = async () => {
  let role = 'client';
  try {
    const user = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
    if (user && user.role) {
      role = String(user.role).toLowerCase();
    }
  } catch (_) {}

  const list =
    role === 'master'
      ? await vehiclesDao.listServicedByCurrentMechanic()
      : await vehiclesDao.listByUser(null);

  return list.map((v) => ({
    id: v.id,
    vin: v.vin,
    make: v.brand,
    model: v.model,
    year: v.year,
    license_plate: v.licensePlate,
  }));
};

// Функція для отримання деталей про конкретний автомобіль
export const getVehicleDetails = async (vin) => {
  const v = await vehiclesDao.getById(vin);
  return {
    id: v.id,
    vin: v.vin,
    make: v.brand,
    model: v.model,
    year: v.year,
    license_plate: v.licensePlate,
    mileage: v.mileage,
    color: v.color
  };
};

// Функція для додавання нового автомобіля
export const addVehicle = async (vehicleData, userId) => {
  const created = await vehiclesDao.create(vehicleData, userId);
  return {
    id: created.id,
    vin: created.vin,
    make: created.brand,
    model: created.model,
    year: created.year,
    license_plate: created.licensePlate
  };
};

// Функція для оновлення інформації про автомобіль
export const updateVehicle = async (vin, vehicleData) => {
  const updated = await vehiclesDao.updateById(vin, vehicleData);
  return {
    id: updated.id,
    vin: updated.vin,
    make: updated.brand,
    model: updated.model,
    year: updated.year,
    license_plate: updated.licensePlate
  };
};

// Функція для видалення автомобіля
export const deleteVehicle = async (vin) => {
  await vehiclesDao.deleteById(vin);
  return { success: true };
};
