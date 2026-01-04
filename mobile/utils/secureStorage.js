import * as SecureStore from 'expo-secure-store';

// Ключі для зберігання даних
export const SECURE_STORAGE_KEYS = {
  TOKEN: 'secure_token',
  REFRESH_TOKEN: 'secure_refresh_token',
  USER_ID: 'secure_user_id',
  USER_DATA: 'secure_user_data',
  PUSH_TOKEN: 'secure_push_token',
  MILEAGE_TOKEN: 'secure_mileage_token',
  NOTIFICATION_TOKEN: 'secure_notification_token'
};

/**
 * Зберігає значення в SecureStore
 * @param {string} key - Ключ для зберігання
 * @param {string} value - Значення для зберігання
 * @returns {Promise<void>}
 */
export const secureSet = async (key, value) => {
  try {
    if (value === null || value === undefined) {
      console.log(`[SecureStorage] Removing value for key: ${key}`);
      await SecureStore.deleteItemAsync(key);
      return;
    }
    
    // Перетворюємо об'єкти в JSON рядки
    const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await SecureStore.setItemAsync(key, valueToStore);
    console.log(`[SecureStorage] Value stored for key: ${key}`);
  } catch (error) {
    console.error(`[SecureStorage] Error storing value for key ${key}:`, error);
    throw error;
  }
};

/**
 * Отримує значення з SecureStore
 * @param {string} key - Ключ для отримання
 * @param {boolean} parseJson - Чи потрібно парсити значення як JSON
 * @returns {Promise<any>} - Значення або null, якщо ключ не знайдено
 */
export const secureGet = async (key, parseJson = false) => {
  try {
    const value = await SecureStore.getItemAsync(key);
    
    if (value === null || value === undefined) {
      console.log(`[SecureStorage] No value found for key: ${key}`);
      return null;
    }
    
    if (parseJson) {
      try {
        return JSON.parse(value);
      } catch (parseError) {
        console.error(`[SecureStorage] Error parsing JSON for key ${key}:`, parseError);
        return value; // Повертаємо як рядок, якщо не вдалося розпарсити
      }
    }
    
    console.log(`[SecureStorage] Value retrieved for key: ${key}`);
    return value;
  } catch (error) {
    console.error(`[SecureStorage] Error retrieving value for key ${key}:`, error);
    return null;
  }
};

/**
 * Видаляє значення з SecureStore
 * @param {string} key - Ключ для видалення
 * @returns {Promise<boolean>} - true, якщо видалення успішне
 */
export const secureRemove = async (key) => {
  try {
    await SecureStore.deleteItemAsync(key);
    console.log(`[SecureStorage] Value removed for key: ${key}`);
    return true;
  } catch (error) {
    console.error(`[SecureStorage] Error removing value for key ${key}:`, error);
    return false;
  }
};

/**
 * Перевіряє, чи існує значення для ключа
 * @param {string} key - Ключ для перевірки
 * @returns {Promise<boolean>} - true, якщо значення існує
 */
export const secureExists = async (key) => {
  try {
    const value = await SecureStore.getItemAsync(key);
    return value !== null && value !== undefined;
  } catch (error) {
    console.error(`[SecureStorage] Error checking existence for key ${key}:`, error);
    return false;
  }
};

const migrateFromAsyncStorage = async () => {
  const results = { migrated: [], failed: [] };
  
  try {
    const asyncKeys = await AsyncStorage.getAllKeys();
    
    for (const asyncKey of asyncKeys) {
      try {
        const value = await AsyncStorage.getItem(asyncKey);
        if (value !== null) {
          await secureSet(asyncKey, value);
          await AsyncStorage.removeItem(asyncKey);
          results.migrated.push(asyncKey);
        }
      } catch (error) {
        results.failed.push(asyncKey);
        console.error(`[SecureStorage] Failed to migrate ${asyncKey}:`, error);
      }
    }
  } catch (error) {
    console.error('[SecureStorage] Migration error:', error);
  }
  
  return results;
};

export default {
  secureSet,
  secureGet,
  secureRemove,
  secureExists,
  migrateFromAsyncStorage,
  SECURE_STORAGE_KEYS
};