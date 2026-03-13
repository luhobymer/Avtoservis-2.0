import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosAuth from './axiosConfig';
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';

/**
 * Реєстрація пристрою для отримання push-сповіщень
 * @returns {Promise<string|null>} - токен пристрою або null, якщо реєстрація не вдалася
 */
export const registerForPushNotifications = async () => {
  console.warn('[PushNotifications] Push notifications are disabled without a native provider.');
  return null;
};

/**
 * Відправка токена пристрою на сервер
 * @param {string} pushToken - токен пристрою для push-сповіщень
 * @param {string} authToken - токен авторизації користувача
 * @returns {Promise<boolean>} - успішність операції
 */
export const sendPushTokenToServer = async (pushToken, authToken) => {
  try {
    if (!pushToken) return false;
    const storedUser = await secureStorage.secureGet(
      SECURE_STORAGE_KEYS.USER_DATA,
      true
    );
    const uid = storedUser && storedUser.id ? storedUser.id : null;
    if (!uid) return false;
    let installationId = await AsyncStorage.getItem('installation_id');
    if (!installationId) {
      installationId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem('installation_id', installationId);
    }
    const payload = {
      user_id: uid,
      device_id: installationId,
      token: pushToken,
      platform: Platform.OS,
      app_version: '1.0.0',
      last_used_at: new Date().toISOString()
    };
    await axiosAuth.post('/api/push-tokens', payload);
    return true;
  } catch (error) {
    console.error('[PushNotifications] Помилка при відправці токена на сервер:', error);
    return false;
  }
};

/**
 * Налаштування обробників сповіщень
 * @param {Function} onNotificationReceived - функція, яка викликається при отриманні сповіщення
 * @param {Function} onNotificationResponse - функція, яка викликається при натисканні на сповіщення
 * @returns {Function} - функція для видалення обробників
 */
export const setupNotificationListeners = (onNotificationReceived, onNotificationResponse) => {
  return () => {};
};

/**
 * Відправка локального сповіщення
 * @param {Object} notification - об'єкт сповіщення
 * @param {string} notification.title - заголовок сповіщення
 * @param {string} notification.body - текст сповіщення
 * @param {Object} notification.data - додаткові дані
 * @param {number} notification.seconds - затримка в секундах (за замовчуванням 1)
 * @returns {Promise<string>} - ідентифікатор сповіщення
 */
export const scheduleLocalNotification = async ({ title, body, data = {}, seconds = 1 }) => {
  console.warn('[PushNotifications] Local notifications are disabled without a native provider.');
  return null;
};

/**
 * Скасування запланованого сповіщення
 * @param {string} notificationId - ідентифікатор сповіщення
 * @returns {Promise<boolean>} - успішність операції
 */
export const cancelScheduledNotification = async (notificationId) => {
  return false;
};

/**
 * Скасування всіх запланованих сповіщень
 * @returns {Promise<boolean>} - успішність операції
 */
export const cancelAllScheduledNotifications = async () => {
  return false;
};

/**
 * Отримання всіх запланованих сповіщень
 * @returns {Promise<Array>} - масив запланованих сповіщень
 */
export const getAllScheduledNotifications = async () => {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log('[PushNotifications] Заплановані сповіщення:', notifications);
    return notifications;
  } catch (error) {
    console.error('[PushNotifications] Помилка при отриманні запланованих сповіщень:', error);
    return [];
  }
};
