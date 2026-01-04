import AsyncStorage from '@react-native-async-storage/async-storage';
import secureStorage, { SECURE_STORAGE_KEYS } from './secureStorage';

/**
 * Міграція даних автентифікації з AsyncStorage в SecureStore
 * Ця функція повинна викликатися при запуску додатку після оновлення
 * @returns {Promise<Object>} Результат міграції
 */
export const migrateAuthDataToSecureStorage = async () => {
  console.log('[Migration] Starting migration of auth data to SecureStore');
  
  const migrationMap = {
    'token': SECURE_STORAGE_KEYS.TOKEN,
    'refresh_token': SECURE_STORAGE_KEYS.REFRESH_TOKEN,
    'userId': SECURE_STORAGE_KEYS.USER_ID,
    'userData': SECURE_STORAGE_KEYS.USER_DATA
  };
  
  try {
    // Перевіряємо, чи вже була виконана міграція
    const migrationCompleted = await AsyncStorage.getItem('auth_migration_completed');
    
    if (migrationCompleted === 'true') {
      console.log('[Migration] Auth data migration already completed');
      return { status: 'skipped', message: 'Migration already completed' };
    }
    
    // Виконуємо міграцію даних
    const result = await secureStorage.migrateFromAsyncStorage(migrationMap, AsyncStorage);
    
    // Позначаємо міграцію як завершену
    await AsyncStorage.setItem('auth_migration_completed', 'true');
    
    console.log('[Migration] Auth data migration completed:', result);
    return { status: 'success', result };
  } catch (error) {
    console.error('[Migration] Error during auth data migration:', error);
    return { status: 'error', error: error.message };
  }
};

/**
 * Перевірка наявності даних автентифікації в SecureStore
 * @returns {Promise<boolean>} true, якщо дані знайдено
 */
export const checkSecureAuthData = async () => {
  try {
    const token = await secureStorage.secureGet(SECURE_STORAGE_KEYS.TOKEN);
    const userData = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
    
    return !!(token && userData);
  } catch (error) {
    console.error('[Migration] Error checking secure auth data:', error);
    return false;
  }
};

/**
 * Перевірка наявності даних автентифікації в AsyncStorage
 * @returns {Promise<boolean>} true, якщо дані знайдено
 */
export const checkAsyncAuthData = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const userData = await AsyncStorage.getItem('userData');
    
    return !!(token && userData);
  } catch (error) {
    console.error('[Migration] Error checking async auth data:', error);
    return false;
  }
};

export default {
  migrateAuthDataToSecureStorage,
  checkSecureAuthData,
  checkAsyncAuthData
};