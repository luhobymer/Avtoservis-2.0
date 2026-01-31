import axiosAuth from './axiosConfig';
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';

// Функція для отримання сповіщень користувача
export const getUserNotifications = async (token) => {
  try {
    let userId = null;
    try {
      const storedUser = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
      if (storedUser && storedUser.id) {
        userId = storedUser.id;
      }
    } catch {}

    if (!userId) {
      return [];
    }

    const response = await axiosAuth.get('/api/notifications', {
      params: {
        user_id: userId,
      },
    });

    const rows = Array.isArray(response.data) ? response.data : [];

    const normalized = (rows || []).map((r) => {
      let parsedData = null;
      if (r && r.data != null) {
        if (typeof r.data === 'string') {
          try {
            parsedData = JSON.parse(r.data);
          } catch {
            parsedData = null;
          }
        } else {
          parsedData = r.data;
        }
      }

      return {
        id: r.id,
        title: r.title,
        message: r.message,
        createdAt: r.created_at,
        read: !!r.is_read,
        type: r.type,
        user_id: r.user_id,
        data: parsedData,
      };
    });

    return normalized;
  } catch (error) {
    console.error('[API] Критична помилка при отриманні сповіщень:', error);
    return [];
  }
};

 

// Функція для позначення сповіщення як прочитаного
export const markNotificationAsRead = async (notificationId, token) => {
  try {
    const response = await axiosAuth.post(`/api/notifications/${notificationId}/read`);
    return response.data;
  } catch (error) {
    console.error(`Помилка при позначенні сповіщення (ID: ${notificationId}) як прочитаного:`, error);
    throw error;
  }
};

// Функція для видалення сповіщення
export const deleteNotification = async (notificationId, token) => {
  try {
    await axiosAuth.delete(`/api/notifications/${notificationId}`);
    return { success: true };
  } catch (error) {
    console.error(`Помилка при видаленні сповіщення (ID: ${notificationId}):`, error);
    throw error;
  }
};

// Функція для отримання кількості непрочитаних сповіщень
export const getUnreadNotificationsCount = async (token) => {
  try {
    let userId = null;
    try {
      const storedUser = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
      if (storedUser && storedUser.id) {
        userId = storedUser.id;
      }
    } catch {}

    if (!userId) {
      return 0;
    }

    const response = await axiosAuth.get('/api/notifications', {
      params: {
        user_id: userId,
        limit: 100,
        offset: 0,
      },
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    const unread = rows.filter((r) => !r.is_read);

    return unread.length;
  } catch (error) {
    console.error('Помилка при отриманні кількості непрочитаних сповіщень:', error);
    throw error;
  }
};
