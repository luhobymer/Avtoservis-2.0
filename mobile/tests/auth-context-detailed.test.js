import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve())
}));

jest.mock('../utils/secureStorage', () => ({
  __esModule: true,
  default: {
    secureGet: jest.fn(),
    secureSet: jest.fn(),
    secureRemove: jest.fn()
  },
  SECURE_STORAGE_KEYS: {
    TOKEN: 'secure_token',
    REFRESH_TOKEN: 'secure_refresh_token',
    USER_ID: 'secure_user_id',
    USER_DATA: 'secure_user_data'
  }
}));

jest.mock('../api/axiosConfig', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn()
  }
}));

jest.mock('../api/pushNotificationsService', () => ({
  registerForPushNotifications: jest.fn(() => Promise.resolve('expo-token')),
  sendPushTokenToServer: jest.fn(() => Promise.resolve(true))
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios'
  }
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');

describe('AuthContext - Детальне тестування', () => {
  let AuthProvider;
  let useAuth;
  let mockSecureStorage;
  let axiosAuth;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureStorage = require('../utils/secureStorage').default;
    axiosAuth = require('../api/axiosConfig').default;
    const AuthContext = require('../context/AuthContext');
    AuthProvider = AuthContext.AuthProvider;
    useAuth = AuthContext.useAuth;
  });

  describe('Ініціалізація AuthProvider', () => {
    test('повинен ініціалізуватися з правильними початковими значеннями', async () => {
      mockSecureStorage.secureGet.mockResolvedValueOnce(null);
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
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
      mockSecureStorage.secureGet.mockResolvedValueOnce(mockUserData);
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.user).toEqual(mockUserData);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Функція login', () => {
    test('повинен успішно виконувати вхід', async () => {
      const dbUser = {
        id: 1,
        name: 'Користувач з БД',
        email: 'test@example.com',
        role: 'client',
        phone: ''
      };
      axiosAuth.post.mockResolvedValueOnce({
        data: {
          user: dbUser,
          token: 'new_token'
        }
      });
      mockSecureStorage.secureGet.mockResolvedValueOnce(null);
      mockSecureStorage.secureSet.mockResolvedValue(true);
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      await waitFor(() => expect(result.current.user).not.toBeNull());
      expect(axiosAuth.post).toHaveBeenCalledWith('/api/auth/login', {
        identifier: 'test@example.com',
        password: 'password'
      });
      expect(mockSecureStorage.secureSet).toHaveBeenCalledWith('secure_token', 'new_token');
      expect(result.current.user).toEqual(dbUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    test('повинен обробляти помилки входу', async () => {
      axiosAuth.post.mockRejectedValueOnce(new Error('Невірний email або пароль'));
      mockSecureStorage.secureGet.mockResolvedValueOnce(null);
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

    test('повинен створювати дефолтні дані, якщо користувача немає в відповіді', async () => {
      axiosAuth.post.mockResolvedValueOnce({
        data: {
          user: null,
          token: 'new_token'
        }
      });
      mockSecureStorage.secureGet.mockResolvedValueOnce(null);
      mockSecureStorage.secureSet.mockResolvedValue(true);
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      await waitFor(() => expect(result.current.user).not.toBeNull());
      expect(result.current.user).toEqual({
        id: null,
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
      axiosAuth.post.mockResolvedValueOnce({
        data: {
          user: { id: 1, email: 'new@example.com' },
          requiresEmailConfirmation: false
        }
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
      expect(axiosAuth.post).toHaveBeenCalledWith('/api/auth/register', {
        name: 'New User',
        email: 'new@example.com',
        phone: '+380123456789',
        password: 'password',
        role: 'client'
      });
    });

    test('повинен обробляти помилки реєстрації', async () => {
      axiosAuth.post.mockRejectedValueOnce(new Error('Email вже використовується'));
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
      mockSecureStorage.secureGet.mockResolvedValueOnce(null);
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
      expect(mockSecureStorage.secureRemove).toHaveBeenCalledWith('secure_token');
      expect(mockSecureStorage.secureRemove).toHaveBeenCalledWith('secure_refresh_token');
      expect(mockSecureStorage.secureRemove).toHaveBeenCalledWith('secure_user_id');
      expect(mockSecureStorage.secureRemove).toHaveBeenCalledWith('secure_user_data');
      await waitFor(() => expect(result.current.user).toBeNull());
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Функція getToken', () => {
    test('повинен повертати валідний токен', async () => {
      mockSecureStorage.secureGet.mockImplementation((key) => {
        if (key === 'secure_token') {
          return Promise.resolve('valid_token');
        }
        return Promise.resolve(null);
      });
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      let token;
      await act(async () => {
        token = await result.current.getToken();
      });
      expect(token).toBe('valid_token');
    });

    test('повинен повертати null, якщо токена немає', async () => {
      mockSecureStorage.secureGet.mockResolvedValueOnce(null);
      const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      const token = await result.current.getToken();
      expect(token).toBeNull();
    });
  });

  describe('Функції ролей', () => {
    test('hasRole та isAdmin/isMaster/isClient працюють коректно', async () => {
      const mockUserData = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        phone: '+380123456789'
      };
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
      mockSecureStorage.secureGet.mockImplementation((key) => {
        if (key === 'secure_user_data') {
          return Promise.resolve(initialUserData);
        }
        return Promise.resolve(null);
      });
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
    });
  });
});
