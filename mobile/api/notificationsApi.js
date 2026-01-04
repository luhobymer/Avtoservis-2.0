import { supabase } from './supabaseClient';

// Функція для отримання сповіщень користувача
export const getUserNotifications = async (token) => {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.user?.id;
    if (!uid) return [];
    const { data: rows, error } = await supabase
      .from('notifications')
      .select('id, title, message, created_at, is_read, type, user_id, data')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const normalized = (rows || []).map(r => ({
      id: r.id,
      title: r.title,
      message: r.message,
      createdAt: r.created_at,
      read: !!r.is_read,
      type: r.type,
      user_id: r.user_id,
      data: r.data || null
    }));
    return normalized;
  } catch (error) {
    console.error('[API] Критична помилка при отриманні сповіщень:', error);
    return [];
  }
};

 

// Функція для позначення сповіщення як прочитаного
export const markNotificationAsRead = async (notificationId, token) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Помилка при позначенні сповіщення (ID: ${notificationId}) як прочитаного:`, error);
    throw error;
  }
};

// Функція для видалення сповіщення
export const deleteNotification = async (notificationId, token) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error(`Помилка при видаленні сповіщення (ID: ${notificationId}):`, error);
    throw error;
  }
};

// Функція для отримання кількості непрочитаних сповіщень
export const getUnreadNotificationsCount = async (token) => {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.user?.id;
    if (!uid) return 0;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('is_read', false);
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Помилка при отриманні кількості непрочитаних сповіщень:', error);
    throw error;
  }
};
