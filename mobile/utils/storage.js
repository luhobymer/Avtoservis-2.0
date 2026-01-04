import AsyncStorage from '@react-native-async-storage/async-storage';

// Ключі для зберігання даних
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER_ID: 'userId',
  USER_DATA: 'userData',
  LANGUAGE: 'language',
  THEME: 'theme'
};

// Зберігання значення
export const storeData = async (key, value) => {
  try {
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    return true;
  } catch (error) {
    console.error(`[Storage] Error storing data for key ${key}:`, error);
    return false;
  }
};

// Отримання значення
export const getData = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value === null) return null;
    
    try {
      // Спробуємо розпарсити як JSON
      return JSON.parse(value);
    } catch {
      // Якщо не вдалося розпарсити, повертаємо як рядок
      return value;
    }
  } catch (error) {
    console.error(`[Storage] Error retrieving data for key ${key}:`, error);
    return null;
  }
};

// Видалення значення
export const removeData = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[Storage] Error removing data for key ${key}:`, error);
    return false;
  }
};

// Очищення всіх даних
export const clearAll = async () => {
  try {
    await AsyncStorage.clear();
    return true;
  } catch (error) {
    console.error('[Storage] Error clearing all data:', error);
    return false;
  }
};

// Зберігання даних автентифікації
export const storeAuthData = async (token, userId, userData = null) => {
  try {
    await Promise.all([
      storeData(STORAGE_KEYS.TOKEN, token),
      storeData(STORAGE_KEYS.USER_ID, userId.toString()),
      userData ? storeData(STORAGE_KEYS.USER_DATA, userData) : Promise.resolve()
    ]);
    return true;
  } catch (error) {
    console.error('[Storage] Error storing auth data:', error);
    return false;
  }
};

// Отримання даних автентифікації
export const getAuthData = async () => {
  try {
    const [token, userId, userData] = await Promise.all([
      getData(STORAGE_KEYS.TOKEN),
      getData(STORAGE_KEYS.USER_ID),
      getData(STORAGE_KEYS.USER_DATA)
    ]);
    
    return { token, userId, userData };
  } catch (error) {
    console.error('[Storage] Error retrieving auth data:', error);
    return { token: null, userId: null, userData: null };
  }
};

// Видалення даних автентифікації
export const clearAuthData = async () => {
  try {
    await Promise.all([
      removeData(STORAGE_KEYS.TOKEN),
      removeData(STORAGE_KEYS.USER_ID),
      removeData(STORAGE_KEYS.USER_DATA)
    ]);
    return true;
  } catch (error) {
    console.error('[Storage] Error clearing auth data:', error);
    return false;
  }
};