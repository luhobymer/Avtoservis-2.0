import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosAuth from './axiosConfig';
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';

// Налаштування обробки сповіщень
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Реєстрація пристрою для отримання push-сповіщень
 * @returns {Promise<string|null>} - токен пристрою або null, якщо реєстрація не вдалася
 */
export const registerForPushNotifications = async () => {
  let token;
  
  if (!Device.isDevice) {
    console.log('[PushNotifications] Сповіщення не працюють на емуляторі');
    return null;
  }

  // Перевіряємо дозволи
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('[PushNotifications] Дозвіл на сповіщення не надано');
    return null;
  }
  
  try {
    // Отримуємо токен для push-сповіщень
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;
    
    console.log('[PushNotifications] Токен пристрою:', token);
    
    // Зберігаємо токен локально
    await AsyncStorage.setItem('pushToken', token);
    
    // Налаштування для Android
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    
    return token;
  } catch (error) {
    console.error('[PushNotifications] Помилка при отриманні токена:', error);
    return null;
  }
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
      app_version: Constants.expoConfig?.version || '1.0.0',
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
  // Обробник для отримання сповіщення, коли додаток відкрито
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    notification => {
      console.log('[PushNotifications] Отримано сповіщення:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    }
  );

  // Обробник для натискання на сповіщення
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    response => {
      console.log('[PushNotifications] Відповідь на сповіщення:', response);
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    }
  );

  // Повертаємо функцію для видалення обробників
  return () => {
    Notifications.removeNotificationSubscription(receivedSubscription);
    Notifications.removeNotificationSubscription(responseSubscription);
  };
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
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: seconds > 0 ? { seconds } : null,
    });
    
    console.log(`[PushNotifications] Заплановано локальне сповіщення з ID: ${id}`);
    return id;
  } catch (error) {
    console.error('[PushNotifications] Помилка при плануванні сповіщення:', error);
    throw error;
  }
};

/**
 * Скасування запланованого сповіщення
 * @param {string} notificationId - ідентифікатор сповіщення
 * @returns {Promise<boolean>} - успішність операції
 */
export const cancelScheduledNotification = async (notificationId) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`[PushNotifications] Скасовано сповіщення з ID: ${notificationId}`);
    return true;
  } catch (error) {
    console.error('[PushNotifications] Помилка при скасуванні сповіщення:', error);
    return false;
  }
};

/**
 * Скасування всіх запланованих сповіщень
 * @returns {Promise<boolean>} - успішність операції
 */
export const cancelAllScheduledNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[PushNotifications] Скасовано всі сповіщення');
    return true;
  } catch (error) {
    console.error('[PushNotifications] Помилка при скасуванні всіх сповіщень:', error);
    return false;
  }
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
