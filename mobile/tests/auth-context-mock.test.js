/**
 * Тест з мокованим контекстом автентифікації
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock для axiosConfig
jest.mock('../api/axiosConfig', () => {
  const mockAxiosAuth = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  };
  
  return {
    __esModule: true,
    default: mockAxiosAuth,
    axiosAuth: mockAxiosAuth,
    refreshAuthToken: jest.fn(),
    clearAuthData: jest.fn(),
  };
});

// Створюємо мокований AuthContext
const AuthContext = React.createContext();

// Мокований AuthProvider
const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Імітуємо useEffect для завантаження токена
  React.useEffect(() => {
    const loadToken = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (err) {
        console.error('Error loading user data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadToken();
  }, []);

  // Функція для входу в систему
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      // Імітуємо успішний вхід
      const userData = {
        id: '1',
        name: 'Тестовий користувач',
        email: email,
        role: 'client',
        phone: '+380123456789'
      };
      
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      setError('Помилка входу');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Функція для виходу з системи
  const logout = async () => {
    try {
      await AsyncStorage.removeItem('userData');
      setUser(null);
      return true;
    } catch (err) {
      return false;
    }
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Хук для використання контексту
const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Експортуємо мокований контекст і хук
export { AuthContext, AuthProvider, useAuth };

// Тести
describe('Тест з мокованим контекстом автентифікації', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  test('Початковий стан контексту автентифікації', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    
    // Використовуємо waitFor замість waitForNextUpdate
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('Функція входу встановлює дані користувача', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    
    // Використовуємо waitFor замість waitForNextUpdate
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    // Викликаємо функцію входу
    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });
    
    // Перевіряємо, що дані користувача були збережені
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('userData', expect.any(String));
    
    // Перевіряємо стан контексту
    expect(result.current.user).not.toBeNull();
    expect(result.current.user.email).toBe('test@example.com');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  test('Функція виходу очищає дані користувача', async () => {
    // Мокуємо наявність даних користувача
    const userData = {
      id: '1',
      name: 'Тестовий користувач',
      email: 'test@example.com',
      role: 'client',
      phone: '+380123456789'
    };
    
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(userData));
    
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    
    // Використовуємо waitFor замість waitForNextUpdate
    await waitFor(() => expect(result.current.user).not.toBeNull());
    
    // Перевіряємо, що користувач завантажений
    expect(result.current.isAuthenticated).toBe(true);
    
    // Викликаємо функцію виходу
    await act(async () => {
      await result.current.logout();
    });
    
    // Перевіряємо, що дані користувача були очищені
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userData');
    
    // Перевіряємо стан контексту
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});