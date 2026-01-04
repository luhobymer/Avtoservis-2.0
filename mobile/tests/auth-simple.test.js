/**
 * Простий тест автентифікації
 * Перевіряє базову функціональність без складних залежностей
 */

import { isTokenValid, clearAuthData } from '../api/axiosConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Мок для AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Мок для jwt-decode
jest.mock('jwt-decode', () => ({
  __esModule: true,
  default: jest.fn((token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch {
      throw new Error('Invalid token');
    }
  })
}));

// Мок для expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  isAvailableAsync: jest.fn(() => Promise.resolve(true))
}));

// Глобальні функції для base64
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

describe('Тестування автентифікації - базові функції', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Перевірка токенів', () => {
    test('isTokenValid повертає true для валідного токена', async () => {
      // Створюємо валідний JWT токен з майбутнім терміном дії
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // +1 година
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 
        btoa(JSON.stringify({ exp: futureExp, userId: '1' })) + 
        '.signature';
      
      const result = await isTokenValid(validToken);
      expect(result).toBe(true);
    });

    test('isTokenValid повертає false для прострочного токена', async () => {
      // Створюємо прострочений JWT токен
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // -1 година
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 
        btoa(JSON.stringify({ exp: pastExp, userId: '1' })) + 
        '.signature';
      
      const result = await isTokenValid(expiredToken);
      expect(result).toBe(false);
    });

    test('isTokenValid повертає false для недійсного токена', async () => {
      const invalidToken = 'invalid-token';
      
      const result = await isTokenValid(invalidToken);
      expect(result).toBe(false);
    });

    test('isTokenValid повертає false для null токена', async () => {
      const result = await isTokenValid(null);
      expect(result).toBe(false);
    });
  });

  describe('Очищення даних автентифікації', () => {
    test('clearAuthData видаляє всі дані автентифікації', async () => {
      const SecureStore = require('expo-secure-store');
      await clearAuthData();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_refresh_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_user_id');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_user_data');
    });
  });

  describe('Безпека токенів', () => {
    test('Токени не зберігаються в глобальних змінних', () => {
      // Перевіряємо, що токени не доступні через global
      expect(global.token).toBeUndefined();
      expect(global.refresh_token).toBeUndefined();
      expect(global.access_token).toBeUndefined();
    });
  });
});
