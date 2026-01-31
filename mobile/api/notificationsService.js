import * as Notifications from 'expo-notifications';
import { getUserSettings } from './userSettingsService';
import axiosAuth from './axiosConfig';

const REQUEST_TIMEOUT = 10000; // 10 секунд таймаут для запитів

/**
 * Отримання сповіщень користувача
 * @param {string} userId - ID користувача
 * @param {string} token - Токен авторизації
 * @param {number} limit - Кількість сповіщень для отримання
 * @param {number} offset - Зміщення для пагінації
 * @returns {Promise<Array>} - Масив сповіщень
 */
export const getNotifications = async (userId, token, limit = 20, offset = 0) => {
  try {
    if (!userId) {
      return [];
    }

    const response = await axiosAuth.get('/api/notifications', {
      params: {
        user_id: userId,
        limit,
        offset,
      },
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    return rows;
  } catch (error) {
    console.error('[notificationsService] Помилка отримання сповіщень:', error);
    
    // Використовуємо покращену обробку помилок з axiosConfig
    if (error.isAuthError) {
      console.warn('[notificationsService] Помилка автентифікації при отриманні сповіщень.');
    } else if (error.isNetworkError) {
      console.warn('[notificationsService] Проблеми з мережею при отриманні сповіщень.');
    } else if (error.isTimeoutError) {
      console.warn('[notificationsService] Таймаут запиту при отриманні сповіщень.');
    } else if (error.status) {
      console.warn(`[notificationsService] Помилка сервера при отриманні сповіщень: ${error.status}`);
    } else {
      console.warn('[notificationsService] Помилка мережі при отриманні сповіщень або інша помилка.');
    }
    
    return [];
  }
};

/**
 * Позначення сповіщення як прочитане
 * @param {string} notificationId - ID сповіщення
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const markNotificationAsRead = async (notificationId, token) => {
  try {
    await axiosAuth.post(`/api/notifications/${notificationId}/read`);
    return true;
  } catch (error) {
    console.error('[notificationsService] Помилка позначення сповіщення як прочитане:', error);
    
    // Використовуємо покращену обробку помилок з axiosConfig
    if (error.isAuthError) {
      console.warn('[notificationsService] Помилка автентифікації при позначенні сповіщення.');
    } else if (error.isNetworkError) {
      console.warn('[notificationsService] Проблеми з мережею при позначенні сповіщення.');
    } else if (error.isTimeoutError) {
      console.warn('[notificationsService] Таймаут запиту при позначенні сповіщення.');
    } else if (error.status) {
      console.warn(`[notificationsService] Помилка сервера при позначенні сповіщення: ${error.status}`);
    } else {
      console.warn('[notificationsService] Помилка мережі при позначенні сповіщення або інша помилка.');
    }
    return false;
  }
};

/**
 * Позначення всіх сповіщень як прочитані
 * @param {string} userId - ID користувача
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const markAllNotificationsAsRead = async (userId, token) => {
  try {
    await axiosAuth.post('/api/notifications/mark-all-read', {
      user_id: userId,
    });
    return true;
  } catch (error) {
    console.error('[notificationsService] Помилка позначення всіх сповіщень як прочитані:', error);
    
    // Використовуємо покращену обробку помилок з axiosConfig
    if (error.isAuthError) {
      console.warn('[notificationsService] Помилка автентифікації при позначенні всіх сповіщень.');
    } else if (error.isNetworkError) {
      console.warn('[notificationsService] Проблеми з мережею при позначенні всіх сповіщень.');
    } else if (error.isTimeoutError) {
      console.warn('[notificationsService] Таймаут запиту при позначенні всіх сповіщень.');
    } else if (error.status) {
      console.warn(`[notificationsService] Помилка сервера при позначенні всіх сповіщень: ${error.status}`);
    } else {
      console.warn('[notificationsService] Помилка мережі при позначенні всіх сповіщень або інша помилка.');
    }
    return false;
  }
};

/**
 * Видалення сповіщення
 * @param {string} notificationId - ID сповіщення
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const deleteNotification = async (notificationId, token) => {
  try {
    await axiosAuth.delete(`/api/notifications/${notificationId}`);
    return true;
  } catch (error) {
    console.error('[notificationsService] Помилка видалення сповіщення:', error);
    
    // Використовуємо покращену обробку помилок з axiosConfig
    if (error.isAuthError) {
      console.warn('[notificationsService] Помилка автентифікації при видаленні сповіщення.');
    } else if (error.isNetworkError) {
      console.warn('[notificationsService] Проблеми з мережею при видаленні сповіщення.');
    } else if (error.isTimeoutError) {
      console.warn('[notificationsService] Таймаут запиту при видаленні сповіщення.');
    } else if (error.status) {
      console.warn(`[notificationsService] Помилка сервера при видаленні сповіщення: ${error.status}`);
    } else {
      console.warn('[notificationsService] Помилка мережі при видаленні сповіщення або інша помилка.');
    }
    
    return false;
  }
};

/**
 * Створення нагадування про запис на ремонт
 * @param {Object} appointment - Дані запису
 * @param {string} userId - ID користувача
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const createAppointmentReminder = async (appointment, userId, token) => {
  try {
    const userSettings = await getUserSettings(userId, token);
    
    if (userSettings.notifications && 
        userSettings.notifications.appointmentReminders === false) {
      console.log('[notificationsService] Нагадування про записи вимкнені в налаштуваннях користувача');
      return false;
    }
    
    const reminderTime = userSettings.notifications?.reminderTime || 'hours_3';
    
    const appointmentDate = new Date(appointment.scheduled_time);
    let reminderDate = new Date(appointmentDate);
    
    switch (reminderTime) {
      case 'day_before':
        reminderDate.setDate(reminderDate.getDate() - 1);
        break;
      case 'hours_12':
        reminderDate.setHours(reminderDate.getHours() - 12);
        break;
      case 'hours_3':
        reminderDate.setHours(reminderDate.getHours() - 3);
        break;
      case 'hour_1':
        reminderDate.setHours(reminderDate.getHours() - 1);
        break;
      case 'minutes_30':
        reminderDate.setMinutes(reminderDate.getMinutes() - 30);
        break;
      default:
        reminderDate.setHours(reminderDate.getHours() - 3);
    }
    
    if (reminderDate <= new Date()) {
      console.log('[notificationsService] Час нагадування вже минув');
      return false;
    }
    
    const formattedDate = appointmentDate.toLocaleDateString();
    const formattedTime = appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const reminder = {
      user_id: userId,
      title: 'Нагадування про запис',
      message: `Нагадуємо про запис на ${formattedDate} о ${formattedTime}`,
      type: 'appointment_reminder',
      data: {
        appointment_id: appointment.id,
        appointment_date: appointment.scheduled_time
      },
      scheduled_for: reminderDate.toISOString()
    };
    await axiosAuth.post('/api/notifications', {
      user_id: reminder.user_id,
      title: reminder.title,
      message: reminder.message,
      type: reminder.type,
      status: 'pending',
      data: reminder.data,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.message,
        data: { data: reminder }
      },
      trigger: {
        date: reminderDate
      }
    });
    
    return true;
  } catch (error) {
    console.error('[notificationsService] Помилка створення нагадування про запис:', error);
    
    return false;
  }
};

export const processScheduledNotifications = async (userId, token) => {
  try {
    return 0;
  } catch (error) {
    console.error('[notificationsService] Помилка вибірки запланованих сповіщень:', error);
    return 0;
  }
};
