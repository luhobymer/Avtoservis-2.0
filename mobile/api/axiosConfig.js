import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';

const axiosAuth = axios.create();

const isTokenValid = async (token) => {
  try {
    if (!token) return false;
    const decodedToken = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    return decodedToken.exp > currentTime;
  } catch (error) {
    console.error('Помилка при перевірці токена:', error);
    return false;
  }
};

const clearAuthData = async () => {
  try {
    await secureStorage.secureRemove(SECURE_STORAGE_KEYS.TOKEN);
    await secureStorage.secureRemove(SECURE_STORAGE_KEYS.REFRESH_TOKEN);
    await secureStorage.secureRemove(SECURE_STORAGE_KEYS.USER_ID);
    await secureStorage.secureRemove(SECURE_STORAGE_KEYS.USER_DATA);
    console.log('Дані автентифікації очищено');
    return true;
  } catch (error) {
    console.error('Помилка при очищенні даних автентифікації:', error);
    return false;
  }
};

export { axiosAuth, isTokenValid, clearAuthData };

// Для сумісності з тестами, які використовують axiosInstance
export const axiosInstance = axiosAuth;
export default axiosAuth;
