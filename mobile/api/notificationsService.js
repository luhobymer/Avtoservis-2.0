import { supabase } from './supabaseClient';
import * as Notifications from 'expo-notifications';
import { getUserSettings } from './userSettingsService';

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
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, type, is_read, created_at, related_entity, related_entity_id, status, data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const start = offset;
    const end = offset + limit;
    return rows.slice(start, end);
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
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    if (error) throw error;
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
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);
    if (error) throw error;
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
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (error) throw error;
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
    // Перевіряємо налаштування користувача
    const userSettings = await getUserSettings(userId, token);
    
    // Якщо нагадування про записи вимкнені, не створюємо нагадування
    if (userSettings.notifications && 
        userSettings.notifications.appointmentReminders === false) {
      console.log('[notificationsService] Нагадування про записи вимкнені в налаштуваннях користувача');
      return false;
    }
    
    // Отримуємо час нагадування з налаштувань
    const reminderTime = userSettings.notifications?.reminderTime || 'hours_3';
    
    // Розраховуємо час нагадування
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
    
    // Якщо час нагадування вже минув, не створюємо нагадування
    if (reminderDate <= new Date()) {
      console.log('[notificationsService] Час нагадування вже минув');
      return false;
    }
    
    // Форматуємо дату та час запису
    const formattedDate = appointmentDate.toLocaleDateString();
    const formattedTime = appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Створюємо нагадування
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
    await supabase
      .from('scheduled_notifications')
      .delete()
      .eq('user_id', userId)
      .eq('is_sent', false)
      .contains('data', { appointment_id: appointment.id });

    const { error } = await supabase
      .from('scheduled_notifications')
      .insert(reminder);
    if (error) throw error;
    
    // Плануємо локальне сповіщення
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
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabase
      .from('scheduled_notifications')
      .select('id, title, message, type, data, scheduled_for')
      .eq('user_id', userId)
      .eq('is_sent', false)
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true });
    if (error) throw error;
    const rows = Array.isArray(due) ? due : [];
    let processed = 0;
    for (const n of rows) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: n.title,
            body: n.message,
            data: { data: n }
          },
          trigger: null
        });
        await supabase
          .from('scheduled_notifications')
          .update({ is_sent: true, updated_at: new Date().toISOString() })
          .eq('id', n.id);
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: n.title,
            message: n.message,
            type: n.type,
            status: 'sent',
            data: n.data || {}
          });
        processed += 1;
      } catch (innerErr) {
        console.error('[notificationsService] Помилка обробки сповіщення:', innerErr);
      }
    }
    return processed;
  } catch (error) {
    console.error('[notificationsService] Помилка вибірки запланованих сповіщень:', error);
    return 0;
  }
};
