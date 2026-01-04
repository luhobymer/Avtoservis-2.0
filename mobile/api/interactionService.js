import { supabase } from './supabaseClient';

/**
 * Сервіс для взаємодії між різними ролями (клієнт, майстер, адмін)
 */

// Отримання всіх взаємодій для користувача
export const getUserInteractions = async (token) => {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.user?.id;
    if (!uid) return [];
    const { data: rows, error } = await supabase
      .from('interactions')
      .select('*')
      .or(`recipient_id.eq.${uid},sender_id.eq.${uid}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return rows || [];
  } catch (error) {
    console.error('[InteractionService] Помилка при отриманні взаємодій:', error);
    return [];
  }
};

// Створення нової взаємодії
export const createInteraction = async (interactionData, token) => {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.user?.id;
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
    const { data: rows, error } = await supabase
      .from('interactions')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return rows;
  } catch (error) {
    console.error('[InteractionService] Помилка при створенні взаємодії:', error);
    throw error;
  }
};

// Оновлення статусу взаємодії (прочитано/не прочитано)
export const updateInteractionStatus = async (interactionId, status, token) => {
  try {
    const { data: rows, error } = await supabase
      .from('interactions')
      .update({ status })
      .eq('id', interactionId)
      .select('*')
      .single();
    if (error) throw error;
    return rows;
  } catch (error) {
    console.error('[InteractionService] Помилка при оновленні статусу взаємодії:', error);
    throw error;
  }
};

// Отримання всіх взаємодій для конкретної сутності (наприклад, для запису на сервіс)
export const getEntityInteractions = async (entityType, entityId, token) => {
  try {
    const { data: rows, error } = await supabase
      .from('interactions')
      .select('*')
      .eq('related_entity', entityType)
      .eq('related_entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return rows || [];
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
    const { count, error } = await supabase
      .from('interactions')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', uid)
      .eq('status', 'unread');
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('[InteractionService] Помилка при отриманні кількості непрочитаних взаємодій:', error);
    return 0;
  }
};
