import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import Constants from 'expo-constants';
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';

const apiBaseUrl =
  Constants?.expoConfig?.extra?.API_BASE_URL ||
  Constants?.manifest?.extra?.API_BASE_URL ||
  'http://127.0.0.1:8787';

const axiosAuth = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

axiosAuth.interceptors.request.use(async (config) => {
  try {
    const token = await secureStorage.secureGet(SECURE_STORAGE_KEYS.TOKEN, false);
    if (token && token !== 'local') {
      if (!config.headers) {
        config.headers = {};
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Помилка при додаванні токена в заголовок:', error);
  }
  return config;
});

axiosAuth.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error && error.config ? error.config : null;
    const status = error && error.response ? error.response.status : null;

    if (originalRequest && status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await secureStorage.secureGet(SECURE_STORAGE_KEYS.REFRESH_TOKEN, false);
        if (!refreshToken) {
          await clearAuthData();
          return Promise.reject(error);
        }
        const refreshResponse = await axiosAuth.post('/api/auth/refresh-token', {
          refresh_token: refreshToken,
        });
        const data = refreshResponse && refreshResponse.data ? refreshResponse.data : null;
        if (data) {
          const newAccessToken = data.token || data.accessToken || null;
          const newRefreshToken = data.refresh_token || data.refreshToken || null;
          if (newAccessToken) {
            await secureStorage.secureSet(SECURE_STORAGE_KEYS.TOKEN, newAccessToken);
          }
          if (newRefreshToken) {
            await secureStorage.secureSet(SECURE_STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
          }
        }
        return axiosAuth(originalRequest);
      } catch (refreshError) {
        await clearAuthData();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { axiosAuth, isTokenValid, clearAuthData };
export const axiosInstance = axiosAuth;
export default axiosAuth;
