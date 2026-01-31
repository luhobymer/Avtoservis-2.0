/**
 * Тест контексту автентифікації
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

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
    clearAuthData: jest.fn(() => Promise.resolve())
  };
});

describe('Тест контексту автентифікації', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  test('Початковий стан контексту автентифікації', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.loading).toBe(true);
  });
});
