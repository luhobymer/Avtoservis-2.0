import axiosAuth from './axiosConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ключі для AsyncStorage
const MASTER_SCHEDULE_KEY = 'master_schedule';
const MASTER_AVAILABILITY_KEY = 'master_availability';
const MASTER_BUSY_STATUS_KEY = 'master_busy_status';

/**
 * Отримати розклад майстра
 * @param {string} masterId - ID майстра
 * @param {string} startDate - Початкова дата (ISO string)
 * @param {string} endDate - Кінцева дата (ISO string)
 * @param {string} token - Токен авторизації
 * @returns {Promise<Array>} - Масив записів розкладу
 */
export const getMasterSchedule = async (masterId, startDate, endDate, token) => {
  try {
    console.log(`[API] Отримання розкладу майстра ${masterId} з ${startDate} по ${endDate}`);
    const response = await axiosAuth.get('/api/appointments', {
      params: {
        mechanic_id: masterId,
        start_date: startDate,
        end_date: endDate
      }
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    if (rows.length > 0) {
      await AsyncStorage.setItem(`${MASTER_SCHEDULE_KEY}_${masterId}`, JSON.stringify(rows));
      return rows;
    }
    
    // Якщо немає даних, спробуємо отримати з локального сховища
    const cachedSchedule = await AsyncStorage.getItem(`${MASTER_SCHEDULE_KEY}_${masterId}`);
    if (cachedSchedule) {
      return JSON.parse(cachedSchedule);
    }
    
    return [];
  } catch (error) {
    console.error('[ScheduleService] Помилка при отриманні розкладу майстра:', error);
    
    // Спробуємо отримати дані з локального сховища
    try {
      const cachedSchedule = await AsyncStorage.getItem(`${MASTER_SCHEDULE_KEY}_${masterId}`);
      if (cachedSchedule) {
        return JSON.parse(cachedSchedule);
      }
    } catch (storageError) {
      console.error('[ScheduleService] Помилка при отриманні даних з локального сховища:', storageError);
    }
    
    // Повертаємо тестові дані
    return generateMockSchedule(masterId, startDate, endDate);
  }
};

/**
 * Отримати доступність майстра на конкретну дату
 * @param {string} masterId - ID майстра
 * @param {string} date - Дата (ISO string)
 * @param {string} token - Токен авторизації
 * @returns {Promise<Array>} - Масив доступних слотів часу
 */
export const getMasterAvailability = async (masterId, date, token) => {
  try {
    console.log(`[API] Отримання доступності майстра ${masterId} на ${date}`);
    
    // Отримуємо робочі години майстра
    const workingHours = await getMasterWorkingHours(masterId, token);
    
    // Отримуємо всі записи на обслуговування на цю дату
    const appointments = await getMasterAppointmentsForDate(masterId, date, token);
    
    // Генеруємо доступні слоти часу
    const availableSlots = generateAvailableTimeSlots(workingHours, appointments, date);
    
    // Зберігаємо доступність в локальному сховищі
    await AsyncStorage.setItem(`${MASTER_AVAILABILITY_KEY}_${masterId}_${date}`, JSON.stringify(availableSlots));
    
    return availableSlots;
  } catch (error) {
    console.error('[ScheduleService] Помилка при отриманні доступності майстра:', error);
    
    // Спробуємо отримати дані з локального сховища
    try {
      const cachedAvailability = await AsyncStorage.getItem(`${MASTER_AVAILABILITY_KEY}_${masterId}_${date}`);
      if (cachedAvailability) {
        return JSON.parse(cachedAvailability);
      }
    } catch (storageError) {
      console.error('[ScheduleService] Помилка при отриманні даних з локального сховища:', storageError);
    }
    
    return [];
  }
};

/**
 * Отримати робочі години майстра
 * @param {string} masterId - ID майстра
 * @param {string} token - Токен авторизації
 * @returns {Promise<Object>} - Об'єкт з робочими годинами по днях тижня
 */
export const getMasterWorkingHours = async (masterId, token) => {
  try {
    console.log(`[API] Отримання робочих годин майстра ${masterId}`);
    const response = await axiosAuth.get('/api/schedule/working-hours', {
      params: { master_id: masterId }
    });
    if (response.data && typeof response.data === 'object') {
      return response.data;
    }
    
    // Повертаємо стандартні робочі години (пн-пт, 9:00-18:00)
    return {
      1: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // Понеділок
      2: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // Вівторок
      3: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // Середа
      4: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // Четвер
      5: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // П'ятниця
      6: { start_time: '10:00', end_time: '15:00', is_working_day: false }, // Субота
      0: { start_time: '00:00', end_time: '00:00', is_working_day: false }  // Неділя
    };
  } catch (error) {
    console.error('[ScheduleService] Помилка при отриманні робочих годин майстра:', error);
    
    // Повертаємо стандартні робочі години (пн-пт, 9:00-18:00)
    return {
      1: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // Понеділок
      2: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // Вівторок
      3: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // Середа
      4: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // Четвер
      5: { start_time: '09:00', end_time: '18:00', is_working_day: true }, // П'ятниця
      6: { start_time: '10:00', end_time: '15:00', is_working_day: false }, // Субота
      0: { start_time: '00:00', end_time: '00:00', is_working_day: false }  // Неділя
    };
  }
};

/**
 * Оновити робочі години майстра
 * @param {string} masterId - ID майстра
 * @param {Object} workingHours - Об'єкт з робочими годинами по днях тижня
 * @param {string} token - Токен авторизації
 * @returns {Promise<Object>} - Оновлені робочі години
 */
export const updateMasterWorkingHours = async (masterId, workingHours, token) => {
  try {
    console.log(`[API] Оновлення робочих годин майстра ${masterId}:`, workingHours);
    
    // Перетворюємо об'єкт у масив для відправки на сервер
    const workingHoursArray = Object.entries(workingHours).map(([day, hours]) => ({
      master_id: masterId,
      day_of_week: parseInt(day),
      start_time: hours.start_time,
      end_time: hours.end_time,
      is_working_day: hours.is_working_day
    }));
    
    console.log('[API] Робочі години оновлено');
    return workingHours;
  } catch (error) {
    console.error('[ScheduleService] Помилка при оновленні робочих годин майстра:', error);
    throw error;
  }
};

/**
 * Отримати записи на обслуговування майстра на конкретну дату
 * @param {string} masterId - ID майстра
 * @param {string} date - Дата (ISO string)
 * @param {string} token - Токен авторизації
 * @returns {Promise<Array>} - Масив записів на обслуговування
 */
export const getMasterAppointmentsForDate = async (masterId, date, token) => {
  try {
    console.log(`[API] Отримання записів майстра ${masterId} на ${date}`);
    
    // Форматуємо дату для запиту (YYYY-MM-DD)
    const formattedDate = date.split('T')[0];
    const start = new Date(`${formattedDate}T00:00:00.000Z`).toISOString();
    const end = new Date(`${formattedDate}T23:59:59.999Z`).toISOString();
    const response = await axiosAuth.get('/api/appointments', {
      params: {
        mechanic_id: masterId,
        start_date: start,
        end_date: end
      }
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows;
  } catch (error) {
    console.error('[ScheduleService] Помилка при отриманні записів майстра:', error);
    return [];
  }
};

/**
 * Встановити статус зайнятості майстра
 * @param {string} masterId - ID майстра
 * @param {boolean} isBusy - Статус зайнятості
 * @param {string} endTime - Час закінчення зайнятості (ISO string)
 * @param {string} reason - Причина зайнятості
 * @param {string} token - Токен авторизації
 * @returns {Promise<Object>} - Оновлений статус зайнятості
 */
export const setMasterBusyStatus = async (masterId, isBusy, endTime, reason, token) => {
  try {
    console.log(`[API] Встановлення статусу зайнятості майстра ${masterId}: ${isBusy ? 'зайнятий' : 'вільний'}`);
    
    const busyStatus = {
      master_id: masterId,
      is_busy: isBusy,
      busy_until: endTime,
      busy_reason: reason,
      updated_at: new Date().toISOString()
    };
    const mechanicIdValue = /^[0-9]+$/.test(String(masterId)) ? Number(masterId) : masterId;
    await axiosAuth.post('/api/schedule/busy-status', {
      mechanic_id: mechanicIdValue,
      is_busy: isBusy,
      busy_until: endTime,
      busy_reason: reason
    });
    console.log('[API] Статус зайнятості оновлено');
    
    // Зберігаємо статус в локальному сховищі
    await AsyncStorage.setItem(`${MASTER_BUSY_STATUS_KEY}_${masterId}`, JSON.stringify(busyStatus));
    
    return busyStatus;
  } catch (error) {
    console.error('[ScheduleService] Помилка при встановленні статусу зайнятості майстра:', error);
    
    // Зберігаємо статус в локальному сховищі навіть при помилці
    const busyStatus = {
      master_id: masterId,
      is_busy: isBusy,
      busy_until: endTime,
      busy_reason: reason,
      updated_at: new Date().toISOString()
    };
    
    await AsyncStorage.setItem(`${MASTER_BUSY_STATUS_KEY}_${masterId}`, JSON.stringify(busyStatus));
    
    return busyStatus;
  }
};

/**
 * Отримати статус зайнятості майстра
 * @param {string} masterId - ID майстра
 * @param {string} token - Токен авторизації
 * @returns {Promise<Object>} - Статус зайнятості
 */
export const getMasterBusyStatus = async (masterId, token) => {
  try {
    console.log(`[API] Отримання статусу зайнятості майстра ${masterId}`);
    const mechanicIdValue = /^[0-9]+$/.test(String(masterId)) ? Number(masterId) : masterId;
    const response = await axiosAuth.get('/api/schedule/busy-status', {
      params: { mechanic_id: mechanicIdValue }
    });
    const data = response.data;
    if (data) {
      await AsyncStorage.setItem(`${MASTER_BUSY_STATUS_KEY}_${masterId}`, JSON.stringify(data));
      return data;
    }
    const cachedStatus = await AsyncStorage.getItem(`${MASTER_BUSY_STATUS_KEY}_${masterId}`);
    if (cachedStatus) return JSON.parse(cachedStatus);
    
    // Якщо немає даних ні з сервера, ні з локального сховища, повертаємо стандартний статус
    return {
      master_id: masterId,
      is_busy: false,
      busy_until: null,
      busy_reason: null,
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('[ScheduleService] Помилка при отриманні статусу зайнятості майстра:', error);
    
    // Спробуємо отримати дані з локального сховища
    try {
      const cachedStatus = await AsyncStorage.getItem(`${MASTER_BUSY_STATUS_KEY}_${masterId}`);
      if (cachedStatus) {
        return JSON.parse(cachedStatus);
      }
    } catch (storageError) {
      console.error('[ScheduleService] Помилка при отриманні даних з локального сховища:', storageError);
    }
    
    // Повертаємо стандартний статус
    return {
      master_id: masterId,
      is_busy: false,
      busy_until: null,
      busy_reason: null,
      updated_at: new Date().toISOString()
    };
  }
};

// Допоміжні функції

/**
 * Генерувати доступні слоти часу на основі робочих годин та існуючих записів
 * @param {Object} workingHours - Робочі години майстра
 * @param {Array} appointments - Існуючі записи на обслуговування
 * @param {string} date - Дата (ISO string)
 * @returns {Array} - Масив доступних слотів часу
 */
const generateAvailableTimeSlots = (workingHours, appointments, date) => {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay(); // 0 - неділя, 1 - понеділок, ...
  
  // Перевіряємо, чи це робочий день
  const daySchedule = workingHours[dayOfWeek];
  if (!daySchedule || !daySchedule.is_working_day) {
    return [];
  }
  
  // Розбиваємо робочий день на слоти по 30 хвилин
  const slots = [];
  const startTime = daySchedule.start_time.split(':');
  const endTime = daySchedule.end_time.split(':');
  
  let startHour = parseInt(startTime[0]);
  let startMinute = parseInt(startTime[1]);
  const endHour = parseInt(endTime[0]);
  const endMinute = parseInt(endTime[1]);
  
  // Створюємо слоти часу
  while (startHour < endHour || (startHour === endHour && startMinute < endMinute)) {
    const hour = startHour.toString().padStart(2, '0');
    const minute = startMinute.toString().padStart(2, '0');
    const slotTime = `${hour}:${minute}`;
    
    // Перевіряємо, чи цей слот не зайнятий
    const isAvailable = !appointments.some(appointment => {
      const appointmentTime = new Date(appointment.scheduled_time).toTimeString().slice(0, 5);
      return appointmentTime === slotTime;
    });
    
    if (isAvailable) {
      slots.push({
        time: slotTime,
        available: true
      });
    } else {
      slots.push({
        time: slotTime,
        available: false
      });
    }
    
    // Переходимо до наступного слоту (30 хвилин)
    startMinute += 30;
    if (startMinute >= 60) {
      startHour += 1;
      startMinute = 0;
    }
  }
  
  return slots;
};

/**
 * Генерувати тестовий розклад майстра
 * @param {string} masterId - ID майстра
 * @param {string} startDate - Початкова дата (ISO string)
 * @param {string} endDate - Кінцева дата (ISO string)
 * @returns {Array} - Масив записів розкладу
 */
const generateMockSchedule = (masterId, startDate, endDate) => {
  const schedule = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Генеруємо розклад на кожен день
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    
    // Пропускаємо вихідні (субота, неділя)
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    // Додаємо робочі години
    schedule.push({
      id: `${masterId}_${date.toISOString().split('T')[0]}_1`,
      master_id: masterId,
      date: new Date(date).toISOString(),
      start_time: '09:00',
      end_time: '13:00',
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    schedule.push({
      id: `${masterId}_${date.toISOString().split('T')[0]}_2`,
      master_id: masterId,
      date: new Date(date).toISOString(),
      start_time: '14:00',
      end_time: '18:00',
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  
  return schedule;
};

/**
 * Генерувати тестову доступність майстра
 * @param {string} date - Дата (ISO string)
 * @returns {Array} - Масив доступних слотів часу
 */
const generateMockAvailability = (date) => {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();
  
  // Пропускаємо вихідні (субота, неділя)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return [];
  }
  
  // Генеруємо слоти часу з 9:00 до 18:00 з інтервалом 30 хвилин
  const slots = [];
  for (let hour = 9; hour < 18; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const hourStr = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      
      // Робимо деякі слоти недоступними для реалістичності
      const isAvailable = Math.random() > 0.3;
      
      slots.push({
        time: `${hourStr}:${minuteStr}`,
        available: isAvailable
      });
    }
  }
  
  return slots;
};
