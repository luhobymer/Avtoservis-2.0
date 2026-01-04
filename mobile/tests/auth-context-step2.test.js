/**
 * Поступовий тест контексту автентифікації - Крок 2
 * Тестування з мокованим axiosConfig
 */

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  post: jest.fn(),
  get: jest.fn(),
}));

// Mock axiosConfig
jest.mock('../api/axiosConfig', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  },
  axiosAuth: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  },
  refreshAuthToken: jest.fn(),
  clearAuthData: jest.fn(),
}));

// Мінімальна реалізація контексту автентифікації
const AuthContext = React.createContext();

const useAuth = () => {
  return React.useContext(AuthContext);
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Спрощена функція входу
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

  // Спрощена функція виходу
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

describe('Поступовий тест контексту автентифікації - Крок 2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  test('Початковий стан контексту автентифікації', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  test('Функція входу встановлює дані користувача', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });
    
    expect(result.current.user).not.toBeNull();
    expect(result.current.user.email).toBe('test@example.com');
    expect(result.current.isAuthenticated).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  test('Функція виходу очищає дані користувача', async () => {
    // Спочатку входимо
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });
    
    expect(result.current.isAuthenticated).toBe(true);
    
    // Потім виходимо
    await act(async () => {
      await result.current.logout();
    });
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });
});