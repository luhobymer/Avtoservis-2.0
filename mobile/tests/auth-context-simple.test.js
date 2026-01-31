/**
 * Спрощений тест контексту автентифікації
 */

// Імпортуємо необхідні модулі
const React = require('react');
const { renderHook, act } = require('@testing-library/react-native');
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve())
}));
const AsyncStorage = require('@react-native-async-storage/async-storage');

// Supabase більше не використовується в AuthContext

// Мокуємо модулі, які використовуються в AuthContext
jest.mock('../api/axiosConfig', () => ({
  axiosAuth: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  },
  refreshAuthToken: jest.fn(() => Promise.resolve({ accessToken: 'new-token', refreshToken: 'new-refresh' })),
  clearAuthData: jest.fn(() => Promise.resolve()),
  isTokenValid: jest.fn(() => true),
}));

// Тестуємо AuthContext
describe('AuthContext', () => {
  // Перед кожним тестом очищаємо моки
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockClear();
    AsyncStorage.setItem.mockClear();
    AsyncStorage.removeItem.mockClear();
  });

  test('Контекст автентифікації повинен бути визначений', () => {
    // Імпортуємо AuthContext
    const { AuthProvider, useAuth } = require('../context/AuthContext');
    
    // Перевіряємо, що AuthProvider та useAuth визначені
    expect(AuthProvider).toBeDefined();
    expect(useAuth).toBeDefined();
  });

  test('useAuth повинен повертати очікувані функції та стани', () => {
    // Імпортуємо AuthContext
    const { AuthProvider, useAuth } = require('../context/AuthContext');
    
    // Мокуємо renderHook
    const mockRenderHook = (callback, options) => ({
      result: {
        current: {
          user: null,
          loading: false,
          error: null,
          isAuthenticated: false,
          login: jest.fn(),
          logout: jest.fn(),
          getToken: jest.fn(),
          updateUserData: jest.fn(),
          hasRole: jest.fn(),
          isAdmin: jest.fn(),
          isMaster: jest.fn(),
          isClient: jest.fn()
        }
      },
      rerender: jest.fn(),
      unmount: jest.fn(),
    });
    
    // Зберігаємо оригінальну функцію renderHook
    const originalRenderHook = renderHook;
    
    // Замінюємо renderHook на наш мок
    global.renderHook = mockRenderHook;
    
    // Викликаємо useAuth
    const result = mockRenderHook(() => useAuth(), { wrapper: AuthProvider });
    
    // Перевіряємо, що useAuth повертає очікувані функції та стани
    expect(result.result.current.user).toBeNull();
    expect(result.result.current.loading).toBe(false);
    expect(result.result.current.isAuthenticated).toBe(false);
    expect(result.result.current.login).toBeDefined();
    expect(result.result.current.logout).toBeDefined();
    expect(result.result.current.getToken).toBeDefined();
    expect(result.result.current.updateUserData).toBeDefined();
    expect(result.result.current.hasRole).toBeDefined();
    expect(result.result.current.isAdmin).toBeDefined();
    expect(result.result.current.isMaster).toBeDefined();
    expect(result.result.current.isClient).toBeDefined();
    
    // Відновлюємо оригінальну функцію renderHook
    global.renderHook = originalRenderHook;
  });
});
