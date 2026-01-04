import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';

const AuthContext = createContext();

 

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  const hasRole = (role) => (user?.role || '').toLowerCase() === role;
  const isAdmin = () => hasRole('admin');
  const isMaster = () => hasRole('master');
  const isClient = () => hasRole('client');

  useEffect(() => {}, []);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.user) {
          const authUser = session.user;
          const { data: dbUser } = await supabase
            .from('users')
            .select('id, name, email, phone, role, created_at')
            .eq('id', authUser.id)
            .single();
          const userData = dbUser || {
            id: authUser.id,
            email: authUser.email,
            name: authUser.user_metadata?.name || '',
            phone: authUser.user_metadata?.phone || ''
          };
          setUser(userData);
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    });
    if (error) {
      const msg = error.message || 'Помилка автентифікації';
      setError(msg);
      throw new Error(msg);
    }
    const authUser = data.user;
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at')
      .eq('id', authUser.id)
      .single();
    const userData = dbUser || {
      id: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.name || '',
      phone: authUser.user_metadata?.phone || ''
    };
    setUser(userData);
    setIsAuthenticated(true);
    setError(null);
    return userData;
  };

  const register = async (userData) => {
    const { error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          name: userData.name,
          phone: userData.phone
        }
      }
    });
    if (error) {
      const msg = error.message || 'Помилка реєстрації';
      throw new Error(msg);
    }
    return {
      success: true,
      message: 'Реєстрація успішна! Будь ласка, перевірте вашу електронну пошту для підтвердження.',
      requiresEmailConfirmation: true
    };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateProfile = async (userData) => {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    if (!authUser) throw new Error('Користувач не автентифікований');
    let nextUser = user;
    if (userData.name || userData.phone) {
      const { data, error } = await supabase
        .from('users')
        .update({ name: userData.name, phone: userData.phone })
        .eq('id', authUser.id)
        .select('id, name, email, phone, role, created_at')
        .single();
      if (error) throw error;
      nextUser = data || nextUser;
    }
    if (userData.newPassword) {
      const { error } = await supabase.auth.updateUser({ password: userData.newPassword });
      if (error) throw new Error(error.message);
    }
    setUser(nextUser);
    return nextUser;
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
