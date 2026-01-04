/**
 * Детальний тест для AuthContext.js
 * Покриває всі основні функції автентифікації
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// Мокуємо всі зовнішні залежності
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));
const AsyncStorage = require('@react-native-async-storage/async-storage');

jest.mock('../api/supabaseClient', () => {
  const auth = {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
    signInWithPassword: jest.fn(({ email }) => Promise.resolve({
      data: {
        session: { access_token: 'token', refresh_token: 'refresh' },
        user: { id: '1', email }
      },
      error: null
    })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    signUp: jest.fn()
  };
  const builder = () => ({
    select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
    insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
    update: jest.fn(() => ({ eq: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })) })),
    delete: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
    order: jest.fn(() => Promise.resolve({ data: [], error: null })),
    eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
    single: jest.fn(() => Promise.resolve({ data: null, error: null }))
  });
  return { supabase: { auth, from: jest.fn(() => builder()) } };
});

jest.mock('../utils/secureStorage', () => ({
  __esModule: true,
  default: {
    secureGet: jest.fn(),
    secureSet: jest.fn(),
    secureRemove: jest.fn(),
  },
  SECURE_STORAGE_KEYS: {
    TOKEN: 'secure_token',
    REFRESH_TOKEN: 'secure_refresh_token',
    USER_ID: 'secure_user_id',
    USER_DATA: 'secure_user_data',
  },
}));

// Мокуємо React Native компоненти
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

describe('AuthContext - Детальне тестування', () => {
  let AuthProvider, useAuth;
  let mockSecureStorage;
  let supabase;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSecureStorage = require('../utils/secureStorage').default;
    supabase = require('../api/supabaseClient').supabase;

    const singleFn = jest.fn(() => Promise.resolve({ data: null, error: null }));
    const eqFn = jest.fn(() => ({ single: singleFn }));
    const selectFn = jest.fn(() => ({ eq: eqFn }));

    const insertSingleFn = jest.fn(() => Promise.resolve({ data: null, error: null }));
    const insertSelectFn = jest.fn(() => ({ single: insertSingleFn }));
    const insertFn = jest.fn(() => ({ select: insertSelectFn }));

    supabase.from.mockImplementation(() => ({
      select: selectFn,
      insert: insertFn
    }));
    
    const AuthContext = require('../context/AuthContext');
    AuthProvider = AuthContext.AuthProvider;
    useAuth = AuthContext.useAuth;
  });

  describe('Ініціалізація AuthProvider', () => {
    test('повинен ініціалізуватися з правильними початковими значеннями', async () => {
      mockSecureStorage.secureGet.mockResolvedValue(null);
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      // Початковий стан
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      
      // Чекаємо завершення ініціалізації
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      expect(result.current.loading).toBe(false);
    });

    test('повинен завантажувати збережені дані автентифікації', async () => {
      const mockUserData = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'client',
        phone: '+380123456789'
      };
      
      supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'valid_token', refresh_token: 'refresh_token', user: { id: '1' } } } });
      mockSecureStorage.secureGet.mockResolvedValueOnce(mockUserData);
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      expect(result.current.user).toEqual(mockUserData);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    test('повинен очищати дані при невалідному токені', async () => {
      supabase.auth.getSession.mockRejectedValue(new Error('session error'));
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      expect(mockSecureStorage.secureRemove).toHaveBeenCalledWith('secure_token');
      expect(mockSecureStorage.secureRemove).toHaveBeenCalledWith('secure_refresh_token');
      expect(mockSecureStorage.secureRemove).toHaveBeenCalledWith('secure_user_id');
      expect(mockSecureStorage.secureRemove).toHaveBeenCalledWith('secure_user_data');
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('повинен створювати fallback-користувача при відсутності запису в БД', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'valid_token',
            refresh_token: 'refresh_token',
            user: { id: '1', email: 'test@example.com' }
          }
        }
      });
      mockSecureStorage.secureGet.mockResolvedValueOnce(null);
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      expect(result.current.user).toEqual({
        id: '1',
        name: 'Користувач',
        email: 'test@example.com',
        role: 'client',
        phone: ''
      });
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Функція login', () => {
    test('повинен успішно виконувати вхід', async () => {
      const dbUser = { id: '1', name: 'Користувач з БД', email: 'test@example.com', role: 'client', phone: '' };
      const single = supabase.from().select().eq().single;
      single.mockResolvedValue({ data: dbUser, error: null });
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: { access_token: 'new_token', refresh_token: 'new_refresh_token' },
          user: { id: '1', email: 'test@example.com' }
        },
        error: null
      });
      mockSecureStorage.secureGet.mockResolvedValue(null);
      mockSecureStorage.secureSet.mockResolvedValue(true);
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      await waitFor(() => expect(result.current.user).not.toBeNull());
      expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
      expect(mockSecureStorage.secureSet).toHaveBeenCalledWith('secure_token', 'new_token');
      expect(mockSecureStorage.secureSet).toHaveBeenCalledWith('secure_refresh_token', 'new_refresh_token');
      expect(result.current.user).toEqual({
        id: '1',
        name: 'Користувач з БД',
        email: 'test@example.com',
        role: 'client',
        phone: ''
      });
      expect(result.current.isAuthenticated).toBe(true);
    });

    test('повинен обробляти помилки входу', async () => {
      supabase.auth.signInWithPassword.mockRejectedValue(new Error('Невірний email або пароль'));
      mockSecureStorage.secureGet.mockResolvedValue(null);
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'wrong_password');
      });
      
      expect(loginResult).toBe(false);
      expect(result.current.error).toBe('Невірний email або пароль');
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    test('повинен створювати дефолтні дані, якщо користувача в БД немає', async () => {
      const single = supabase.from().select().eq().single;
      single.mockResolvedValue({ data: null, error: null });
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: { access_token: 'new_token', refresh_token: 'new_refresh_token' },
          user: { id: '1', email: 'test@example.com' }
        },
        error: null
      });
      mockSecureStorage.secureGet.mockResolvedValue(null);
      mockSecureStorage.secureSet.mockResolvedValue(true);
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      
      await waitFor(() => expect(result.current.user).not.toBeNull());
      expect(result.current.user).toEqual({
        id: '1',
        name: 'Користувач',
        email: 'test@example.com',
        role: 'client',
        phone: ''
      });
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Функція register', () => {
    test('повинен успішно реєструвати користувача', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { user: { id: '1', email: 'new@example.com' } },
        error: null
      });
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      let registerResult;
      await act(async () => {
        registerResult = await result.current.register({
          email: 'new@example.com',
          password: 'password',
          name: 'New User',
          role: 'client',
          phone: '+380123456789'
        });
      });
      
      expect(registerResult).toEqual({ success: true, requiresEmailConfirmation: false });
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password'
      });
    });
    
    test('повинен обробляти помилки реєстрації', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'Email вже використовується' }
      });
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      let registerResult;
      await act(async () => {
        registerResult = await result.current.register({
          email: 'new@example.com',
          password: 'password',
          name: 'New User',
          role: 'client',
          phone: '+380123456789'
        });
      });
      
      expect(registerResult).toEqual({
        success: false,
        error: 'Email вже використовується'
      });
    });
  });

  describe('Функція logout', () => {
    test('повинен успішно виконувати вихід', async () => {
      supabase.auth.signOut.mockResolvedValue({ error: null });
      mockSecureStorage.secureGet.mockResolvedValue(null);
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      act(() => {
        result.current.setUser({ id: 1, email: 'test@example.com' });
      });
      
      let logoutResult;
      await act(async () => {
        logoutResult = await result.current.logout();
      });
      
      expect(logoutResult).toBe(true);
      expect(supabase.auth.signOut).toHaveBeenCalled();
      await waitFor(() => expect(result.current.user).toBeNull());
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Функція getToken', () => {
    test('повинен повертати валідний токен', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'valid_token' } } });
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      let token;
      await act(async () => {
        token = await result.current.getToken();
      });
      
      expect(token).toBe('valid_token');
    });

    test('повинен повертати null без сесії', async () => {
      supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      const token = await result.current.getToken();
      expect(token).toBeNull();
    });

    // Видаляємо тест оновлення токена – використовується Supabase сесія
  });

  describe('Функції ролей', () => {
    test('hasRole повинен правильно перевіряти ролі', async () => {
      const mockUserData = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        phone: '+380123456789'
      };
      
      supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'valid_token', refresh_token: 'refresh_token', user: { id: '1' } } } });
      mockSecureStorage.secureGet.mockResolvedValueOnce(mockUserData);
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      
      expect(result.current.hasRole('admin')).toBe(true);
      expect(result.current.hasRole('client')).toBe(false);
      expect(result.current.hasRole(['admin', 'master'])).toBe(true);
      expect(result.current.isAdmin()).toBe(true);
      expect(result.current.isMaster()).toBe(false);
      expect(result.current.isClient()).toBe(false);
    });
  });

  describe('Функція updateUserData', () => {
    test('повинен оновлювати дані користувача', async () => {
      const initialUserData = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'client',
        phone: '+380123456789'
      };
      
      const updatedData = {
        name: 'Updated User',
        phone: '+380987654321'
      };
      
      mockSecureStorage.secureGet.mockResolvedValue(null);
      AsyncStorage.getItem
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(initialUserData));
      mockSecureStorage.secureSet.mockResolvedValue(true);
      AsyncStorage.setItem.mockResolvedValue(true);
      
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateUserData(updatedData);
      });
      
      expect(updateResult).toBe(true);
      expect(result.current.user.name).toBe('Updated User');
      expect(result.current.user.phone).toBe('+380987654321');
      // Email не змінюється
    });
  });
});
