import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleNotification, cancelScheduledNotification } from './pushNotificationsService';
import axiosAuth from './axiosConfig';
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';
import { getUserVehicles } from './vehiclesApi';

/**
 * Сервіс для управління запитами пробігу
 */

// Ключі для AsyncStorage
const MILEAGE_REQUESTS_KEY = 'mileage_requests';
const LAST_MILEAGE_REQUEST_DATE_KEY = 'last_mileage_request_date';

/**
 * Отримати всі запити пробігу
 * @returns {Promise<Array>} Масив запитів пробігу
 */
export const getMileageRequests = async () => {
  try {
    const requestsJson = await AsyncStorage.getItem(MILEAGE_REQUESTS_KEY);
    return requestsJson ? JSON.parse(requestsJson) : [];
  } catch (error) {
    console.error('Помилка при отриманні запитів пробігу:', error);
    return [];
  }
};

/**
 * Зберегти запити пробігу
 * @param {Array} requests Масив запитів пробігу
 * @returns {Promise<void>}
 */
export const saveMileageRequests = async (requests) => {
  try {
    await AsyncStorage.setItem(MILEAGE_REQUESTS_KEY, JSON.stringify(requests));
  } catch (error) {
    console.error('Помилка при збереженні запитів пробігу:', error);
  }
};

/**
 * Додати новий запит пробігу
 * @param {Object} request Об'єкт запиту пробігу
 * @returns {Promise<Object>} Доданий запит пробігу
 */
export const addMileageRequest = async (request) => {
  try {
    const requests = await getMileageRequests();
    
    // Створюємо новий запит з унікальним ID
    const newRequest = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      ...request,
    };
    
    // Додаємо запит до масиву
    requests.push(newRequest);
    
    // Зберігаємо оновлений масив
    await saveMileageRequests(requests);
    
    // Плануємо сповіщення для запиту
    await scheduleNotification({
      identifier: `mileage-request-${newRequest.id}`,
      title: 'Запит пробігу',
      body: `Будь ласка, оновіть пробіг для ${newRequest.vehicleMake} ${newRequest.vehicleModel}`,
      data: { type: 'mileage_request', requestId: newRequest.id },
      trigger: { seconds: 1 }, // Показуємо сповіщення одразу
    });
    
    return newRequest;
  } catch (error) {
    console.error('Помилка при додаванні запиту пробігу:', error);
    throw error;
  }
};

/**
 * Оновити статус запиту пробігу
 * @param {string} requestId ID запиту пробігу
 * @param {string} status Новий статус запиту
 * @param {number} mileage Новий пробіг (якщо статус 'completed')
 * @returns {Promise<Object>} Оновлений запит пробігу
 */
export const updateMileageRequestStatus = async (requestId, status, mileage = null) => {
  try {
    const requests = await getMileageRequests();
    
    // Знаходимо запит за ID
    const requestIndex = requests.findIndex(req => req.id === requestId);
    
    if (requestIndex === -1) {
      throw new Error('Запит пробігу не знайдено');
    }
    
    // Оновлюємо статус запиту
    requests[requestIndex] = {
      ...requests[requestIndex],
      status,
      updatedAt: new Date().toISOString(),
      ...(mileage !== null ? { mileage } : {}),
    };
    
    // Зберігаємо оновлений масив
    await saveMileageRequests(requests);
    
      // Якщо запит виконано, синхронізуємо дані з бекендом
      if (status === 'completed' && mileage !== null) {
        try {
          const storedUser = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
          const userId = storedUser?.id || null;
          const vin = requests[requestIndex].vehicleId;
          if (vin) {
            await axiosAuth.put(`/api/vehicles/${vin}`, { mileage });
          }
        } catch (serverError) {
          console.error('Помилка при синхронізації пробігу з бекендом:', serverError);
        }
      
      // Скасовуємо сповіщення для запиту
      await cancelScheduledNotification(`mileage-request-${requestId}`);
    }
    
    return requests[requestIndex];
  } catch (error) {
    console.error('Помилка при оновленні статусу запиту пробігу:', error);
    throw error;
  }
};

/**
 * Видалити запит пробігу
 * @param {string} requestId ID запиту пробігу
 * @returns {Promise<void>}
 */
export const deleteMileageRequest = async (requestId) => {
  try {
    const requests = await getMileageRequests();
    
    // Фільтруємо масив, видаляючи запит з вказаним ID
    const filteredRequests = requests.filter(req => req.id !== requestId);
    
    // Зберігаємо оновлений масив
    await saveMileageRequests(filteredRequests);
    
    // Скасовуємо сповіщення для запиту
    await cancelScheduledNotification(`mileage-request-${requestId}`);
  } catch (error) {
    console.error('Помилка при видаленні запиту пробігу:', error);
    throw error;
  }
};

/**
 * Створити щомісячні запити пробігу для всіх автомобілів користувача
 * @returns {Promise<Array>} Масив створених запитів пробігу
 */
export const createMonthlyMileageRequests = async () => {
  try {
    // Перевіряємо, чи не створювали ми запити в цьому місяці
    const lastRequestDateStr = await AsyncStorage.getItem(LAST_MILEAGE_REQUEST_DATE_KEY);
    
    if (lastRequestDateStr) {
      const lastRequestDate = new Date(lastRequestDateStr);
      const currentDate = new Date();
      
      // Якщо запити вже створювались в цьому місяці, пропускаємо
      if (lastRequestDate.getMonth() === currentDate.getMonth() &&
          lastRequestDate.getFullYear() === currentDate.getFullYear()) {
        return [];
      }
    }
    
    // Отримуємо список автомобілів користувача
    const storedUser = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
    const userId = storedUser?.id || null;
    const vehicles = userId ? await getUserVehicles(userId) : [];
    
    if (!vehicles || vehicles.length === 0) {
      return [];
    }
    
    // Створюємо запити пробігу для кожного автомобіля
    const createdRequests = [];
    
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      // Створюємо запит пробігу
      const request = await addMileageRequest({
        vehicleId: vehicle.id,
        vehicleMake: vehicle.make,
        vehicleModel: vehicle.model,
        vehicleYear: vehicle.year,
        currentMileage: vehicle.mileage || 0,
      });
      
      createdRequests.push(request);
    }
    
    // Зберігаємо дату створення запитів
    await AsyncStorage.setItem(LAST_MILEAGE_REQUEST_DATE_KEY, new Date().toISOString());
    
    return createdRequests;
  } catch (error) {
    console.error('Помилка при створенні щомісячних запитів пробігу:', error);
    return [];
  }
};

/**
 * Перевірити та створити щомісячні запити пробігу, якщо потрібно
 * @returns {Promise<void>}
 */
export const checkAndCreateMileageRequests = async () => {
  try {
    await createMonthlyMileageRequests();
  } catch (error) {
    console.error('Помилка при перевірці та створенні запитів пробігу:', error);
  }
};

/**
 * Відправити відповідь на запит пробігу
 * @param {string} requestId ID запиту пробігу
 * @param {number} mileage Новий пробіг
 * @returns {Promise<Object>} Оновлений запит пробігу
 */
export const submitMileageResponse = async (requestId, mileage) => {
  try {
    return await updateMileageRequestStatus(requestId, 'completed', mileage);
  } catch (error) {
    console.error('Помилка при відправці відповіді на запит пробігу:', error);
    throw error;
  }
};
