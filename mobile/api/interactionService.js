import axiosAuth from './axiosConfig';
import secureStorage, { SECURE_STORAGE_KEYS } from '../utils/secureStorage';

/**
 * Сервіс для взаємодії між різними ролями (клієнт, майстер, адмін)
 */

// Отримання всіх взаємодій для користувача
export const getUserInteractions = async (token) => {
  try {
    const storedUser = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
    const uid = storedUser?.id;
    if (!uid) return [];
    const response = await axiosAuth.get('/api/interactions', {
      params: { user_id: uid }
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows;
  } catch (error) {
    console.error('[InteractionService] Помилка при отриманні взаємодій:', error);
    return [];
  }
};

// Створення нової взаємодії
export const createInteraction = async (interactionData, token) => {
  try {
    const storedUser = await secureStorage.secureGet(SECURE_STORAGE_KEYS.USER_DATA, true);
    const uid = storedUser?.id;
    const payload = {
      sender_id: interactionData.senderId || uid,
      sender_role: interactionData.senderRole,
      sender_name: interactionData.senderName,
      recipient_id: interactionData.recipientId,
      recipient_role: interactionData.recipientRole,
      recipient_name: interactionData.recipientName,
      message: interactionData.message,
      type: interactionData.type || 'message',
      status: 'unread',
      related_entity: interactionData.relatedEntity || null,
      related_entity_id: interactionData.relatedEntityId || null
    };
    const response = await axiosAuth.post('/api/interactions', payload);
    return response.data;
  } catch (error) {
    console.error('[InteractionService] Помилка при створенні взаємодії:', error);
    throw error;
  }
};

// Оновлення статусу взаємодії (прочитано/не прочитано)
export const updateInteractionStatus = async (interactionId, status, token) => {
  try {
    const response = await axiosAuth.put(`/api/interactions/${interactionId}`, { status });
    return response.data;
  } catch (error) {
    console.error('[InteractionService] Помилка при оновленні статусу взаємодії:', error);
    throw error;
  }
};

// Отримання всіх взаємодій для конкретної сутності (наприклад, для запису на сервіс)
export const getEntityInteractions = async (entityType, entityId, token) => {
  try {
    const response = await axiosAuth.get('/api/interactions', {
      params: { related_entity: entityType, related_entity_id: entityId }
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows;
  } catch (error) {
    console.error('[InteractionService] Помилка при отриманні взаємодій для сутності:', error);
    return [];
  }
};

// Отримання кількості непрочитаних взаємодій для користувача
export const getUnreadInteractionsCount = async (userId, token) => {
  try {
    const uid = userId;
    if (!uid) return 0;
    const response = await axiosAuth.get('/api/interactions', {
      params: { recipient_id: uid, status: 'unread' }
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.length;
  } catch (error) {
    console.error('[InteractionService] Помилка при отриманні кількості непрочитаних взаємодій:', error);
    return 0;
  }
};
