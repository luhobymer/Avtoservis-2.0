import { supabase } from './supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleLocalNotification } from './pushNotificationsService';
import { getVehicleServiceIntervals } from './vehiclesApi';

/**
 * Сервіс для роботи з нагадуваннями про ТО, запитами пробігу та сповіщеннями про статус ремонту
 */

// Типи нагадувань
export const REMINDER_TYPES = {
  MAINTENANCE: 'maintenance',  // Нагадування про ТО
  MILEAGE_REQUEST: 'mileage_request', // Запит пробігу
  APPOINTMENT_STATUS: 'appointment_status', // Статус запису на сервіс
};

/**
 * Отримання всіх нагадувань користувача
 * @param {string} token - токен авторизації
 * @returns {Promise<Array>} - масив нагадувань
 */
export const getUserReminders = async (token) => {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.user?.id;
    if (!uid) return [];
    const { data: rows, error } = await supabase
      .from('reminders')
      .select('id, user_id, vehicle_vin, title, description, reminder_type, due_date, due_mileage, is_completed, is_recurring, recurrence_interval, priority, notification_sent, created_at')
      .eq('user_id', uid)
      .order('due_date', { ascending: true });
    if (error) throw error;
    const normalized = (rows || []).map(r => ({
      id: r.id,
      user_id: r.user_id,
      vehicle_vin: r.vehicle_vin,
      title: r.title,
      message: r.description || '',
      type: r.reminder_type,
      due_date: r.due_date,
      due_mileage: r.due_mileage,
      is_completed: r.is_completed,
      is_recurring: r.is_recurring,
      recurrence_interval: r.recurrence_interval,
      priority: r.priority,
      notification_sent: r.notification_sent,
      created_at: r.created_at
    }));
    return normalized;
  } catch (error) {
    console.error('[ReminderService] Помилка при отриманні нагадувань:', error);
    return [];
  }
};

/**
 * Створення нагадування про ТО
 * @param {Object} data - дані нагадування
 * @param {string} data.vehicleId - ID автомобіля
 * @param {string} data.maintenanceType - тип ТО
 * @param {number} data.mileage - пробіг
 * @param {string} data.dueDate - дата нагадування
 * @param {string} token - токен авторизації
 * @returns {Promise<Object>} - створене нагадування
 */
export const createMaintenanceReminder = async (data, token) => {
  try {
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) throw new Error('Не знайдено користувача');
    const vin = data.vehicleId || null;
    const dueDate = new Date(data.dueDate);
    const { data: inserted, error } = await supabase
      .from('reminders')
      .insert({
        user_id: uid,
        vehicle_vin: vin,
        title: 'Нагадування про ТО',
        description: `Час пройти ${data.maintenanceType} для вашого автомобіля`,
        reminder_type: REMINDER_TYPES.MAINTENANCE,
        due_date: dueDate.toISOString().split('T')[0],
        due_mileage: data.mileage,
        is_recurring: false,
        priority: 'medium'
      })
      .select('*')
      .single();
    if (error) throw error;
    const now = new Date();
    const secondsUntilNotification = Math.max(1, Math.floor((dueDate - now) / 1000));
    await scheduleLocalNotification({
      title: 'Нагадування про ТО',
      body: `Час пройти ${data.maintenanceType} для вашого автомобіля`,
      data: {
        type: REMINDER_TYPES.MAINTENANCE,
        vehicleId: data.vehicleId,
        reminderId: inserted.id
      },
      seconds: secondsUntilNotification
    });
    await supabase
      .from('reminders')
      .update({ notification_sent: true })
      .eq('id', inserted.id);
    return inserted;
  } catch (error) {
    console.error('[ReminderService] Помилка при створенні нагадування про ТО:', error);
    throw error;
  }
};

/**
 * Створення запиту пробігу
 * @param {Object} data - дані запиту
 * @param {string} data.vehicleId - ID автомобіля
 * @param {string} data.vehicleName - назва автомобіля
 * @param {string} token - токен авторизації
 * @returns {Promise<Object>} - створений запит
 */
export const createMileageRequest = async (data, token) => {
  try {
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) throw new Error('Не знайдено користувача');
    const vin = data.vehicleId || null;
    const today = new Date();
    const { data: inserted, error } = await supabase
      .from('reminders')
      .insert({
        user_id: uid,
        vehicle_vin: vin,
        title: 'Запит пробігу',
        description: `Будь ласка, вкажіть поточний пробіг для ${data.vehicleName}`,
        reminder_type: 'custom',
        due_date: today.toISOString().split('T')[0],
        is_recurring: false,
        priority: 'medium'
      })
      .select('*')
      .single();
    if (error) throw error;
    await scheduleLocalNotification({
      title: 'Запит пробігу',
      body: `Будь ласка, вкажіть поточний пробіг для ${data.vehicleName}`,
      data: {
        type: REMINDER_TYPES.MILEAGE_REQUEST,
        vehicleId: data.vehicleId,
        reminderId: inserted.id
      },
      seconds: 1
    });
    await supabase
      .from('reminders')
      .update({ notification_sent: true })
      .eq('id', inserted.id);
    return inserted;
  } catch (error) {
    console.error('[ReminderService] Помилка при створенні запиту пробігу:', error);
    throw error;
  }
};

/**
 * Створення сповіщення про статус запису на сервіс
 * @param {Object} data - дані сповіщення
 * @param {string} data.appointmentId - ID запису
 * @param {string} data.status - статус запису
 * @param {string} data.message - повідомлення
 * @param {string} token - токен авторизації
 * @returns {Promise<Object>} - створене сповіщення
 */
export const createAppointmentStatusNotification = async (data, token) => {
  try {
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) throw new Error('Не знайдено користувача');
    const { data: inserted, error } = await supabase
      .from('notifications')
      .insert({
        user_id: uid,
        title: 'Статус запису',
        message: data.message,
        type: REMINDER_TYPES.APPOINTMENT_STATUS,
        status: 'pending',
        data: { appointmentId: data.appointmentId, status: data.status }
      })
      .select('*')
      .single();
    if (error) throw error;
    await scheduleLocalNotification({
      title: 'Статус запису',
      body: data.message,
      data: {
        type: REMINDER_TYPES.APPOINTMENT_STATUS,
        appointmentId: data.appointmentId,
        notificationId: inserted.id
      },
      seconds: 1
    });
    return inserted;
  } catch (error) {
    console.error('[ReminderService] Помилка при створенні сповіщення про статус запису:', error);
    throw error;
  }
};

/**
 * Видалення нагадування
 * @param {string} reminderId - ID нагадування
 * @param {string} token - токен авторизації
 * @returns {Promise<boolean>} - успішність операції
 */
export const deleteReminder = async (reminderId, token) => {
  try {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`[ReminderService] Помилка при видаленні нагадування ${reminderId}:`, error);
    return false;
  }
};

/**
 * Автоматичне створення нагадувань про ТО на основі сервісних інтервалів
 * @param {string} vehicleId - ID автомобіля
 * @param {number} currentMileage - поточний пробіг
 * @param {string} token - токен авторизації
 * @returns {Promise<Array>} - створені нагадування
 */
export const setupMaintenanceReminders = async (vehicleId, currentMileage, token) => {
  try {
    // Отримуємо інтервали ТО для автомобіля
    const intervals = await getVehicleServiceIntervals(vehicleId, token);
    
    if (!intervals || intervals.length === 0) {
      console.log('[ReminderService] Для автомобіля не налаштовані інтервали ТО');
      return [];
    }
    
    const createdReminders = [];
    
    // Створюємо нагадування для кожного інтервалу
    for (const interval of intervals) {
      // Розраховуємо дату наступного ТО
      const nextServiceMileage = currentMileage + interval.mileage_interval;
      const averageMileagePerDay = 50; // Середній пробіг на день
      const daysUntilService = Math.floor(interval.mileage_interval / averageMileagePerDay);
      
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysUntilService);
      
      // Створюємо нагадування
      const reminder = await createMaintenanceReminder({
        vehicleId,
        maintenanceType: interval.service_type,
        mileage: nextServiceMileage,
        dueDate: dueDate.toISOString()
      }, token);
      
      createdReminders.push(reminder);
    }
    
    return createdReminders;
  } catch (error) {
    console.error('[ReminderService] Помилка при налаштуванні нагадувань про ТО:', error);
    return [];
  }
};

/**
 * Налаштування щомісячних запитів пробігу
 * @param {string} vehicleId - ID автомобіля
 * @param {string} vehicleName - назва автомобіля
 * @param {string} token - токен авторизації
 * @returns {Promise<boolean>} - успішність операції
 */
export const setupMonthlyMileageRequests = async (vehicleId, vehicleName, token) => {
  try {
    // Отримуємо поточну дату
    const now = new Date();
    
    // Створюємо дату для наступного місяця
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1); // Перший день наступного місяця
    
    // Розраховуємо кількість секунд до наступного місяця
    const secondsUntilNextMonth = Math.floor((nextMonth - now) / 1000);
    
    // Плануємо локальне сповіщення
    const notificationId = await scheduleLocalNotification({
      title: 'Щомісячний запит пробігу',
      body: `Будь ласка, вкажіть поточний пробіг для ${vehicleName}`,
      data: {
        type: REMINDER_TYPES.MILEAGE_REQUEST,
        vehicleId,
        isMonthly: true
      },
      seconds: secondsUntilNextMonth
    });
    
    // Зберігаємо ID сповіщення в локальному сховищі
    const monthlyRequestsKey = `monthly_mileage_requests_${vehicleId}`;
    const existingRequests = await AsyncStorage.getItem(monthlyRequestsKey);
    const requests = existingRequests ? JSON.parse(existingRequests) : [];
    
    requests.push({
      notificationId,
      scheduledFor: nextMonth.toISOString()
    });
    
    await AsyncStorage.setItem(monthlyRequestsKey, JSON.stringify(requests));
    
    return true;
  } catch (error) {
    console.error('[ReminderService] Помилка при налаштуванні щомісячних запитів пробігу:', error);
    return false;
  }
};

 
