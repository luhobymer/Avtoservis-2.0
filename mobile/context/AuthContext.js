import React, { createContext, useContext, useState, useEffect } from 'react';
let AsyncStorage;
try {
  const mod = require('@react-native-async-storage/async-storage');
  AsyncStorage = mod.default || mod;
} catch (e) {
  AsyncStorage = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    clear: async () => {}
  };
}
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';
import { supabase } from '../api/supabaseClient';
import { registerForPushNotifications, sendPushTokenToServer } from '../api/pushNotificationsService';

const APP_STATE_KEY = 'app_state';
const CURRENT_SCHEMA_VERSION = 1;

const ensureAppStateMigrated = async () => {
  try {
    const rawState = await AsyncStorage.getItem(APP_STATE_KEY);
    let state = null;
    if (rawState) {
      try {
        state = JSON.parse(rawState);
      } catch {
        state = null;
      }
    }
    const currentVersion = state && typeof state.schemaVersion === 'number' ? state.schemaVersion : 0;
    if (currentVersion >= CURRENT_SCHEMA_VERSION) {
      return;
    }
    if (currentVersion < 1) {
      const offlineVehiclesRaw = await AsyncStorage.getItem('offlineVehicles');
      if (offlineVehiclesRaw) {
        try {
          await AsyncStorage.setItem('legacy_offlineVehicles', offlineVehiclesRaw);
        } catch {}
        await AsyncStorage.removeItem('offlineVehicles');
      }
    }
    const newState = {
      ...(state || {}),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastMigratedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify(newState));
  } catch (e) {
    console.error('[AppState] Error during migration:', e);
  }
};

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const clearAuthData = async () => {
    try {
      await secureStorage.secureRemove(SECURE_STORAGE_KEYS.TOKEN);
      await secureStorage.secureRemove(SECURE_STORAGE_KEYS.REFRESH_TOKEN);
      await secureStorage.secureRemove(SECURE_STORAGE_KEYS.USER_ID);
      await secureStorage.secureRemove(SECURE_STORAGE_KEYS.USER_DATA);
      await AsyncStorage.removeItem('userData');
      setUser(null);
    } catch (e) {}
  };

  // Завантаження даних автентифікації при запуску додатку
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        setLoading(true);
        await ensureAppStateMigrated();
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        const authUser = session?.user;
        if (session?.access_token && authUser?.id) {
          await secureStorage.secureSet(SECURE_STORAGE_KEYS.TOKEN, session.access_token);
          if (session.refresh_token) {
            await secureStorage.secureSet(SECURE_STORAGE_KEYS.REFRESH_TOKEN, session.refresh_token);
          }
          await secureStorage.secureSet(SECURE_STORAGE_KEYS.USER_ID, authUser.id.toString());
          let userData = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
          if (!userData) {
            const { data: dbUser } = await supabase
              .from('users')
              .select('id, name, email, role, phone')
              .eq('id', authUser.id)
              .single();
            if (dbUser) {
              await secureStorage.secureSet(SECURE_STORAGE_KEYS.USER_DATA, dbUser);
              userData = dbUser;
            } else {
              userData = {
                id: authUser.id,
                name: 'Користувач',
                email: authUser.email,
                role: 'client',
                phone: ''
              };
              await secureStorage.secureSet(SECURE_STORAGE_KEYS.USER_DATA, userData);
            }
          }
          if (userData) setUser(userData);
        }
      } catch (err) {
        console.error('[Auth] Error loading authentication data:', err);
        await clearAuthData();
      } finally {
        setLoading(false);
      }
    };

    // Видаляємо локальну функцію clearAuthData, оскільки ми імпортуємо її з axiosConfig
    // Використовуємо імпортовану функцію clearAuthData замість локальної

    loadAuthData();
  }, []);

  useEffect(() => {
    const registerDeviceToken = async () => {
      try {
        if (!user) return;
        const expoToken = await registerForPushNotifications();
        const { data } = await supabase.auth.getSession();
        const authToken = data?.session?.access_token || null;
        if (expoToken) {
          await sendPushTokenToServer(expoToken, authToken);
        }
      } catch {}
    };
    registerDeviceToken();
  }, [user]);

  // Функція для входу в систему
  const login = async (identifier, password) => {
    setLoading(true);
    setError(null);
    try {
      let payload = { password };
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^(\+?380)\d{9}$/;
      if (emailRegex.test(identifier)) {
        payload.email = identifier;
        console.log('[Auth] Attempting login with email:', identifier);
      } else if (phoneRegex.test(identifier)) {
        payload.phone = identifier;
        console.log('[Auth] Attempting login with phone:', identifier);
      } else {
        throw new Error('Невірний формат email або телефону');
      }
      if (emailRegex.test(identifier)) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
        if (error) throw error;
        const session = data?.session;
        const authUser = data?.user;
        if (!session || !authUser) throw new Error('Помилка автентифікації');
        await secureStorage.secureSet(SECURE_STORAGE_KEYS.TOKEN, session.access_token);
        if (session.refresh_token) {
          await secureStorage.secureSet(SECURE_STORAGE_KEYS.REFRESH_TOKEN, session.refresh_token);
        }
        await secureStorage.secureSet(SECURE_STORAGE_KEYS.USER_ID, authUser.id.toString());
        const { data: dbUser } = await supabase
          .from('users')
          .select('id, name, email, role, phone')
          .eq('id', authUser.id)
          .single();
        const userData = dbUser || { id: authUser.id, name: 'Користувач', email: authUser.email, role: 'client', phone: '' };
        await secureStorage.secureSet(SECURE_STORAGE_KEYS.USER_DATA, userData);
        setUser(userData);
        return true;
      } else if (phoneRegex.test(identifier)) {
        throw new Error('Вхід за телефоном недоступний');
      } else {
        throw new Error('Невірний формат email або телефону');
      }
    } catch (err) {
      console.error('[Auth] Login error:', err);
      let errorMessage = 'Помилка входу';
      if (err.isAuthError) {
        errorMessage = err.customMessage || 'Помилка автентифікації';
      } else if (err.isNetworkError) {
        errorMessage = err.customMessage || 'Проблеми з мережею';
      } else if (err.isTimeoutError) {
        errorMessage = err.customMessage || 'Час очікування вичерпано';
      } else if (err.status && err.data?.message) {
        errorMessage = err.data.message;
      } else if (err.status && err.data?.error_description) {
        errorMessage = err.data.error_description;
      } else if (err.message) {
        errorMessage = err.message;
      }
      if (err?.message === 'Network request failed' || err?.name === 'AuthRetryableFetchError') {
        errorMessage = 'Проблеми з мережею. Перевірте інтернет-з\'єднання';
      } else if (err?.message === 'Invalid login credentials' || err?.data?.error_description === 'Invalid login credentials') {
        errorMessage = 'Невірний email або пароль';
      }
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password
      });
      if (error) return { success: false, error: error.message };
      const user = data?.user;
      const uid = user?.id;
      if (uid) {
        await supabase.from('users').insert({ id: uid, email: payload.email, name: payload.name, role: payload.role, phone: payload.phone }).select().single();
      }
      const requiresEmailConfirmation = !user?.email_confirmed_at;
      return { success: true, requiresEmailConfirmation };
    } catch (err) {
      let errorMessage = 'Помилка реєстрації';
      if (err.isAuthError) {
        errorMessage = err.customMessage || 'Помилка автентифікації';
      } else if (err.isNetworkError) {
        errorMessage = err.customMessage || 'Проблеми з мережею';
      } else if (err.isTimeoutError) {
        errorMessage = err.customMessage || 'Час очікування вичерпано';
      } else if (err.message) {
        errorMessage = err.message;
      }
      if (err?.message === 'Network request failed' || err?.name === 'AuthRetryableFetchError') {
        errorMessage = 'Проблеми з мережею. Перевірте інтернет-з\'єднання';
      }
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Функція для виходу з системи
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      await secureStorage.secureRemove(SECURE_STORAGE_KEYS.TOKEN);
      await secureStorage.secureRemove(SECURE_STORAGE_KEYS.REFRESH_TOKEN);
      await secureStorage.secureRemove(SECURE_STORAGE_KEYS.USER_ID);
      await secureStorage.secureRemove(SECURE_STORAGE_KEYS.USER_DATA);
      await AsyncStorage.removeItem('userData');
      setUser(null);
      console.log('[Auth] User logged out successfully');
      return true;
    } catch (err) {
      console.error('[Auth] Error during logout:', err);
      return false;
    }
  };
  
  // Функція для отримання токена з перевіркою терміну дії
  const getToken = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || null;
      return token;
    } catch (error) {
      console.error('[Auth] Error getting token:', error);
      return null;
    }
  };

  // Функція для оновлення даних користувача
  const updateUserData = async (updatedData) => {
    try {
      // Отримуємо поточні дані користувача з SecureStore
      let userData = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
      
      // Якщо даних немає в SecureStore, перевіряємо AsyncStorage (для зворотної сумісності)
      if (!userData) {
        console.log('[Auth] Дані користувача не знайдено в SecureStore, перевіряємо AsyncStorage');
        const userDataString = await AsyncStorage.getItem('userData');
        
        if (userDataString) {
          try {
            userData = JSON.parse(userDataString);
          } catch (parseError) {
            console.error('[Auth] Помилка при парсингу даних користувача з AsyncStorage:', parseError);
            return false;
          }
        }
      }
      
      if (!userData) {
        console.log('[Auth] No user data found');
        return false;
      }
      
      // Оновлюємо дані користувача
      const newUserData = { ...userData, ...updatedData };
      
      // Зберігаємо оновлені дані в обох сховищах для зворотної сумісності
      await secureStorage.secureSet(SECURE_STORAGE_KEYS.USER_DATA, newUserData);
      await AsyncStorage.setItem('userData', JSON.stringify(newUserData));
      setUser(newUserData);
      
      console.log('[Auth] User data updated successfully');
      return true;
    } catch (error) {
      console.error('[Auth] Error updating user data:', error);
      return false;
    }
  };

  // Функція для перевірки ролі користувача
  const hasRole = (requiredRole) => {
    if (!user) return false;
    
    // Перевіряємо, чи має користувач необхідну роль
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole;
  };

  // Функція для перевірки, чи є користувач адміністратором
  const isAdmin = () => {
    return hasRole(['admin', 'master_admin']);
  };

  // Функція для перевірки, чи є користувач майстром
  const isMaster = () => {
    return hasRole(['master', 'master_admin']);
  };

  // Функція для перевірки, чи є користувач клієнтом
  const isClient = () => {
    return hasRole('client');
  };

  // Функція для отримання даних користувача з сервера
  const getUserData = async (token, userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, phone, role, created_at')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return { user: data };
    } catch (error) {
      console.error('[Auth] Error fetching user data:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        getToken,
        updateUserData,
        getUserData,
        hasRole,
        isAdmin,
        isMaster,
        isClient,
        setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
