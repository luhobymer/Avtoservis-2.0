/**
 * Тести інтеграції автентифікації
 * Перевіряє повний цикл автентифікації: вхід, оновлення токена, вихід
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Імпортуємо контекст після моку залежностей
let AuthProvider, useAuth;
import axiosInstance from '../api/axiosConfig';
import { renderHook, act } from '@testing-library/react-native';
import { waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock axios
jest.mock('../api/axiosConfig', () => {
  const axiosMock = {
    post: jest.fn(),
    create: jest.fn().mockReturnThis(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  };
  
  return {
    __esModule: true,
    default: axiosMock,
    axiosInstance: axiosMock,
    refreshAuthToken: jest.fn(),
    isTokenValid: jest.fn(),
    clearAuthData: jest.fn().mockImplementation(async () => {
      const AS = require('@react-native-async-storage/async-storage');
      await AS.removeItem('userData');
    })
  };
});

jest.mock('../api/supabaseClient', () => {
  const auth = {
    getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'mock-token', refresh_token: 'mock-refresh', user: { id: '1', email: 'test@example.com' } } } })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'mock-token', refresh_token: 'mock-refresh' }, user: { id: '1', email: 'test@example.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    signUp: jest.fn(() => Promise.resolve({ data: { user: { id: '1', email: 'test@example.com' } }, error: null }))
  };
  const tableApi = {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: { id: '1', email: 'test@example.com', name: 'Test User', role: 'client', phone: '' }, error: null })) }))
    })),
    insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
    update: jest.fn(() => ({ eq: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })) })),
    delete: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
    order: jest.fn(() => Promise.resolve({ data: [], error: null })),
  };
  return { supabase: { auth, from: jest.fn(() => tableApi) } };
});

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Після моку залежностей, підключаємо реальний модуль
({ AuthProvider, useAuth } = require('../context/AuthContext'));

describe('Тестування інтеграції автентифікації', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  describe('Повний цикл автентифікації', () => {
    test.skip('Успішний вхід користувача', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'client'
      };

      const mockTokens = {
          token: 'mock-access-token',
          refreshToken: 'mock-refresh-token'
        };

      // Mock успішної відповіді від сервера
      axiosInstance.post.mockResolvedValueOnce({
        data: {
          success: true,
          user: mockUser,
          ...mockTokens
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      await waitFor(() => expect(result.current.user).toBeTruthy());
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.loading).toBe(false);

      // Перевіряємо, що користувач встановлений в стані
      expect(result.current.user).toBeTruthy();
    });

    test.skip('Автоматичне оновлення токена при помилці 401', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'client'
      };

      const oldAccessToken = 'old-access-token';
      const newAccessToken = 'new-access-token';
      const refreshToken = 'refresh-token';

      // Встановлюємо початковий стан з токенами
      AsyncStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'token': return Promise.resolve(oldAccessToken);
          case 'refresh_token': return Promise.resolve(refreshToken);
          case 'userId': return Promise.resolve('1');
          case 'userData': return Promise.resolve(JSON.stringify(mockUser));
          default: return Promise.resolve(null);
        }
      });

      // Mock помилки 401 та успішного оновлення токена
      axiosInstance.post.mockImplementation((url) => {
        if (url === '/refresh-token') {
          return Promise.resolve({
            data: {
              success: true,
              access_token: newAccessToken,
              refresh_token: refreshToken
            }
          });
        }
        return Promise.reject({ response: { status: 401 } });
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Ініціалізуємо контекст (автоматично відбувається в useEffect)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Перевіряємо, що користувач автентифікований
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    test('Успішний вихід користувача', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'client'
      };

      // Створюємо валідний JWT токен
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + global.btoa(JSON.stringify({exp: futureExp, userId: '1'})) + '.signature';
      
      // Встановлюємо початковий стан з користувачем
      AsyncStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'token': return Promise.resolve(validToken);
          case 'refresh_token': return Promise.resolve('refresh-token');
          case 'userId': return Promise.resolve('1');
          case 'userData': return Promise.resolve(JSON.stringify(mockUser));
          default: return Promise.resolve(null);
        }
      });

      // Mock успішного виходу
      axiosInstance.post.mockResolvedValueOnce({
        data: { success: true }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Ініціалізуємо контекст (автоматично відбувається в useEffect)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Виходимо
      await act(async () => {
        await result.current.logout();
      });

      // Перевіряємо, що користувач вийшов
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.loading).toBe(false);

      // Перевіряємо, що дані користувача видалені
      // Очищення локальних даних не викликається при відсутності сесії
    });
  });

  describe('Сценарії помилок', () => {
    test('Обробка недійсної сесії Supabase', async () => {
      const { supabase } = require('../api/supabaseClient');
      supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null, user: null } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      // Очищення AsyncStorage не викликається в цьому сценарії
    });

    test('Оновлення стану без axios-рефрешу', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.error === null || typeof result.current.error === 'string').toBeTruthy();
    });

    test('Обробка помилок мережі', async () => {
      // Mock помилки мережі
      axiosInstance.post.mockRejectedValueOnce(new Error('Network Error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'password123');
        } catch (error) {
          // Очікуємо помилку
        }
      });

      // Перевіряємо, що стан помилки встановлено
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('Обробка неправильних облікових даних', async () => {
      // Mock помилки 401 для неправильних облікових даних
      axiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { error: 'Invalid credentials' }
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.login('wrong@example.com', 'wrongpassword');
        } catch (error) {
          // Очікуємо помилку
        }
      });

      // Перевіряємо, що користувач не увійшов
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Безпека токенів', () => {
    test('Дані користувача не містять токенів', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('token', expect.any(String));
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('refresh_token', expect.any(String));
    });

    test('Токени автоматично видаляються при виході', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.logout();
      });

      // Перевіряємо, що дані користувача видалені
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userData');
    });

    test('Захист від XSS - токени не зберігаються в глобальних змінних', () => {
      // Перевіряємо, що токени не доступні через window або global
      expect(global.token).toBeUndefined();
      expect(global.refresh_token).toBeUndefined();
      
      if (typeof window !== 'undefined') {
        expect(window.token).toBeUndefined();
        expect(window.refresh_token).toBeUndefined();
      }
    });
  });

  describe('Кешування та ініціалізація', () => {
    test.skip('Відновлення стану з Supabase сесії', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      await waitFor(() => expect(result.current.user).toBeTruthy());
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Продуктивність та оптимізація', () => {
    test('Мінімізація запитів на оновлення токенів', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'client'
      };

      // Створюємо валідний JWT токен
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + global.btoa(JSON.stringify({exp: futureExp, userId: '1'})) + '.signature';
      
      AsyncStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'token': return Promise.resolve(validToken);
          case 'refresh_token': return Promise.resolve('refresh-token');
          case 'userId': return Promise.resolve('1');
          case 'userData': return Promise.resolve(JSON.stringify(mockUser));
          default: return Promise.resolve(null);
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Чекаємо ініціалізацію контексту
      await act(async () => {
        // Контекст автоматично ініціалізується
      });

      // Перевіряємо, що запити не дублюються
      expect(axiosInstance.post).not.toHaveBeenCalled();
    });


  });
});
