import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const baseURL = import.meta.env.VITE_API_BASE_URL || '';
const tokenStorageKey = 'auth_token';
const refreshTokenStorageKey = 'refresh_token';

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true
});

const setAuthHeader = (token) => {
  if (token) {
    axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axiosInstance.defaults.headers.common.Authorization;
  }
};

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem(tokenStorageKey);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use((response) => response, async (error) => {
  const originalRequest = error && error.config ? error.config : null;
  const status = error && error.response ? error.response.status : null;

  if (
    originalRequest &&
    status === 401 &&
    !originalRequest._retry &&
    typeof originalRequest.url === 'string' &&
    !originalRequest.url.includes('/api/auth/login') &&
    !originalRequest.url.includes('/api/auth/register') &&
    !originalRequest.url.includes('/api/auth/refresh-token')
  ) {
    originalRequest._retry = true;
    try {
      const storedRefreshToken = localStorage.getItem(refreshTokenStorageKey);
      if (!storedRefreshToken) {
        return Promise.reject(error);
      }
      const refreshResponse = await axios.post(
        `${baseURL}/api/auth/refresh-token`,
        { refresh_token: storedRefreshToken },
        { withCredentials: true }
      );
      const refreshData = refreshResponse?.data || null;
      const newAccessToken = refreshData?.token || refreshData?.accessToken || null;
      const newRefreshToken =
        refreshData?.refresh_token || refreshData?.refreshToken || null;
      if (newAccessToken) {
        localStorage.setItem(tokenStorageKey, newAccessToken);
        setAuthHeader(newAccessToken);
      }
      if (newRefreshToken) {
        localStorage.setItem(refreshTokenStorageKey, newRefreshToken);
      }
      return axiosInstance(originalRequest);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  return Promise.reject(error);
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  const hasRole = (role) => (user?.role || '').toLowerCase() === role;
  // Єдиний привілейований тип користувача — майстер-механік (role = 'master')
  const isAdmin = () => hasRole('master');
  const isMaster = () => hasRole('master');
  const isClient = () => hasRole('client');

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        setLoading(true);
        const storedToken = localStorage.getItem(tokenStorageKey);
        if (storedToken) {
          setAuthHeader(storedToken);
        }
        const res = await axiosInstance.get('/api/auth/me');
        const apiUser = res?.data?.user || null;
        if (apiUser) {
          setUser(apiUser);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkLoggedIn();
  }, []);

  const login = async (credentials) => {
    setError(null);
    try {
      const response = await axiosInstance.post(
        '/api/auth/login',
        {
          email: credentials.email,
          password: credentials.password
        },
        { withCredentials: true }
      );
      const apiUser = response?.data?.user;
      const token = response?.data?.token || response?.data?.accessToken || null;
      const refreshToken =
        response?.data?.refresh_token || response?.data?.refreshToken || null;
      if (!apiUser) {
        const msg = 'Не вдалося отримати дані користувача';
        setError(msg);
        throw new Error(msg);
      }
      if (token) {
        localStorage.setItem(tokenStorageKey, token);
        setAuthHeader(token);
      }
      if (refreshToken) {
        localStorage.setItem(refreshTokenStorageKey, refreshToken);
      }
      setUser(apiUser);
      setIsAuthenticated(true);
      return apiUser;
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Помилка автентифікації';
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (userData) => {
    try {
      const fullName = [userData.name, userData.lastName, userData.patronymic]
        .filter(Boolean)
        .join(' ')
        .trim();
      const response = await axiosInstance.post(
        '/api/auth/register',
        {
          name: fullName || userData.name,
          email: userData.email,
          phone: userData.phone,
          password: userData.password,
          role: userData.role || 'client',
          firstName: userData.name,
          lastName: userData.lastName,
          patronymic: userData.patronymic,
          region: userData.region,
          city: userData.city
        },
        { withCredentials: true }
      );
      return {
        success: true,
        message:
          response?.data?.message ||
          'Реєстрація успішна! Будь ласка, перевірте вашу електронну пошту для підтвердження.',
        requiresEmailConfirmation: !!response?.data?.requiresEmailConfirmation
      };
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Помилка реєстрації';
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post('/api/auth/logout', {});
    } catch (error) {
      void error;
    } finally {
      localStorage.removeItem(tokenStorageKey);
      localStorage.removeItem(refreshTokenStorageKey);
      setAuthHeader(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateProfile = async (userData) => {
    if (!user) {
      throw new Error('Користувач не автентифікований');
    }
    const payload = {
      name: userData.name,
      phone: userData.phone,
      newPassword: userData.newPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      patronymic: userData.patronymic,
      region: userData.region,
      city: userData.city
    };
    try {
      const response = await axiosInstance.put('/api/auth/profile', payload);
      const updatedUser = response?.data?.user || { ...user, ...userData };
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Помилка оновлення профілю';
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        error,
        login,
        register,
        logout,
        updateProfile,
        hasRole,
        isAdmin,
        isMaster,
        isClient
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
