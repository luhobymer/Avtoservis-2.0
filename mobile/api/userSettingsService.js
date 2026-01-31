import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosAuth from './axiosConfig';

const SETTINGS_STORAGE_KEY = 'user_settings';
const REQUEST_TIMEOUT = 10000; // 10 секунд таймаут для запитів

// Значення за замовчуванням для налаштувань користувача
const DEFAULT_SETTINGS = {
  notifications: {
    pushEnabled: true,
    emailEnabled: true,
    appointmentReminders: true,
    reminderTime: 'hours_3' // За 3 години до запису
  },
  integrations: {
    calendarEnabled: false,
    telegramConnected: false,
    telegramUsername: '',
    viberConnected: false,
    viberUsername: ''
  },
  appearance: {
    darkMode: false
  }
};

/**
 * Отримання налаштувань користувача
 * @param {string} userId - ID користувача
 * @param {string} token - Токен авторизації
 * @returns {Promise<Object>} - Налаштування користувача
 */
export const getUserSettings = async (userId, token) => {
  try {
    const response = await axiosAuth.get(`/api/users/${userId}/settings`);
    if (response && response.data && response.data.settings) {
      const settings = response.data.settings;
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      return settings;
    }

    // Якщо немає даних з сервера, спробуємо отримати з локального сховища
    const localSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (localSettings) {
      return JSON.parse(localSettings);
    }

    // Якщо немає локальних налаштувань, повертаємо значення за замовчуванням
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[userSettingsService] Помилка отримання налаштувань:', error);
    
    console.warn('[userSettingsService] Не вдалося отримати налаштування з Supabase, використовуємо локальні дані');
    
    // У разі помилки спробуємо отримати налаштування з локального сховища
    try {
      const localSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (localSettings) {
        return JSON.parse(localSettings);
      }
    } catch (localError) {
      console.error('[userSettingsService] Помилка отримання локальних налаштувань:', localError);
    }
    
    // Якщо все невдало, повертаємо значення за замовчуванням
    return DEFAULT_SETTINGS;
  }
};

/**
 * Збереження налаштувань користувача
 * @param {string} userId - ID користувача
 * @param {Object} settings - Налаштування користувача
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const saveUserSettings = async (userId, settings, token) => {
  try {
    // Зберігаємо налаштування локально
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    await axiosAuth.put(`/api/users/${userId}/settings`, { settings });
    return true;
  } catch (error) {
    console.error('[userSettingsService] Помилка збереження налаштувань:', error);
    console.warn('[userSettingsService] Не вдалося зберегти налаштування на Supabase');
    
    // Навіть якщо не вдалося зберегти на сервері, локальне збереження могло пройти успішно
    return false;
  }
};

/**
 * Підключення Telegram інтеграції
 * @param {string} userId - ID користувача
 * @param {string} username - Ім'я користувача в Telegram
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const connectTelegram = async (userId, username, token) => {
  try {
    // Отримуємо поточні налаштування
    const settings = await getUserSettings(userId, token);
    
    // Оновлюємо налаштування Telegram
    const updatedSettings = {
      ...settings,
      integrations: {
        ...settings.integrations,
        telegramConnected: true,
        telegramUsername: username
      }
    };
    
    // Зберігаємо оновлені налаштування
    return await saveUserSettings(userId, updatedSettings, token);
  } catch (error) {
    console.error('[userSettingsService] Помилка підключення Telegram:', error);
    return false;
  }
};

/**
 * Відключення Telegram інтеграції
 * @param {string} userId - ID користувача
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const disconnectTelegram = async (userId, token) => {
  try {
    // Отримуємо поточні налаштування
    const settings = await getUserSettings(userId, token);
    
    // Оновлюємо налаштування Telegram
    const updatedSettings = {
      ...settings,
      integrations: {
        ...settings.integrations,
        telegramConnected: false,
        telegramUsername: ''
      }
    };
    
    // Зберігаємо оновлені налаштування
    return await saveUserSettings(userId, updatedSettings, token);
  } catch (error) {
    console.error('[userSettingsService] Помилка відключення Telegram:', error);
    return false;
  }
};

/**
 * Підключення Viber інтеграції
 * @param {string} userId - ID користувача
 * @param {string} username - Ім'я користувача в Viber
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const connectViber = async (userId, username, token) => {
  try {
    // Отримуємо поточні налаштування
    const settings = await getUserSettings(userId, token);
    
    // Оновлюємо налаштування Viber
    const updatedSettings = {
      ...settings,
      integrations: {
        ...settings.integrations,
        viberConnected: true,
        viberUsername: username
      }
    };
    
    // Зберігаємо оновлені налаштування
    return await saveUserSettings(userId, updatedSettings, token);
  } catch (error) {
    console.error('[userSettingsService] Помилка підключення Viber:', error);
    return false;
  }
};

/**
 * Відключення Viber інтеграції
 * @param {string} userId - ID користувача
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const disconnectViber = async (userId, token) => {
  try {
    // Отримуємо поточні налаштування
    const settings = await getUserSettings(userId, token);
    
    // Оновлюємо налаштування Viber
    const updatedSettings = {
      ...settings,
      integrations: {
        ...settings.integrations,
        viberConnected: false,
        viberUsername: ''
      }
    };
    
    // Зберігаємо оновлені налаштування
    return await saveUserSettings(userId, updatedSettings, token);
  } catch (error) {
    console.error('[userSettingsService] Помилка відключення Viber:', error);
    return false;
  }
};

/**
 * Оновлення налаштувань сповіщень
 * @param {string} userId - ID користувача
 * @param {Object} notificationSettings - Налаштування сповіщень
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const updateNotificationSettings = async (userId, notificationSettings, token) => {
  try {
    // Отримуємо поточні налаштування
    const settings = await getUserSettings(userId, token);
    
    // Оновлюємо налаштування сповіщень
    const updatedSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        ...notificationSettings
      }
    };
    
    // Зберігаємо оновлені налаштування
    return await saveUserSettings(userId, updatedSettings, token);
  } catch (error) {
    console.error('[userSettingsService] Помилка оновлення налаштувань сповіщень:', error);
    return false;
  }
};

/**
 * Оновлення налаштувань інтеграцій
 * @param {string} userId - ID користувача
 * @param {Object} integrationSettings - Налаштування інтеграцій
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const updateIntegrationSettings = async (userId, integrationSettings, token) => {
  try {
    // Отримуємо поточні налаштування
    const settings = await getUserSettings(userId, token);
    
    // Оновлюємо налаштування інтеграцій
    const updatedSettings = {
      ...settings,
      integrations: {
        ...settings.integrations,
        ...integrationSettings
      }
    };
    
    // Зберігаємо оновлені налаштування
    return await saveUserSettings(userId, updatedSettings, token);
  } catch (error) {
    console.error('[userSettingsService] Помилка оновлення налаштувань інтеграцій:', error);
    return false;
  }
};

/**
 * Оновлення налаштувань зовнішнього вигляду
 * @param {string} userId - ID користувача
 * @param {Object} appearanceSettings - Налаштування зовнішнього вигляду
 * @param {string} token - Токен авторизації
 * @returns {Promise<boolean>} - Результат операції
 */
export const updateAppearanceSettings = async (userId, appearanceSettings, token) => {
  try {
    // Отримуємо поточні налаштування
    const settings = await getUserSettings(userId, token);
    
    // Оновлюємо налаштування зовнішнього вигляду
    const updatedSettings = {
      ...settings,
      appearance: {
        ...settings.appearance,
        ...appearanceSettings
      }
    };
    
    // Зберігаємо оновлені налаштування
    return await saveUserSettings(userId, updatedSettings, token);
  } catch (error) {
    console.error('[userSettingsService] Помилка оновлення налаштувань зовнішнього вигляду:', error);
    return false;
  }
};
