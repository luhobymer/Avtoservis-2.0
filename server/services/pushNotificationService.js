/**
 * Сервіс для відправки push-сповіщень через Expo
 */

const { Expo } = require('expo-server-sdk');
const logger = require('../middleware/logger.js');

// Створюємо новий Expo SDK клієнт
const expo = new Expo();

/**
 * Відправка push-сповіщення
 * @param {Object} notificationData - дані сповіщення
 * @param {string} notificationData.to - Expo push token
 * @param {string} notificationData.title - заголовок сповіщення
 * @param {string} notificationData.body - текст сповіщення
 * @param {Object} notificationData.data - додаткові дані
 * @returns {Promise<boolean>} - результат відправки
 */
const sendPushNotification = async (notificationData) => {
  try {
    const { to, title, body, data = {} } = notificationData;

    // Перевіряємо, чи є токен валідним Expo push token
    if (!Expo.isExpoPushToken(to)) {
      logger.warn(`Push token не є валідним Expo token: ${to}`);
      return false;
    }

    // Створюємо повідомлення
    const message = {
      to,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
    };

    // Відправляємо повідомлення
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        logger.error('Помилка відправки chunk push-сповіщень:', error);
      }
    }

    // Перевіряємо результати
    let hasError = false;
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        logger.error(`Помилка push-сповіщення: ${ticket.message}`);
        if (ticket.details && ticket.details.error) {
          logger.error(`Деталі помилки: ${ticket.details.error}`);
        }
        hasError = true;
      }
    }

    if (!hasError) {
      logger.info(`Push-сповіщення успішно відправлено на ${to}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Помилка відправки push-сповіщення:', error);
    return false;
  }
};

/**
 * Відправка множинних push-сповіщень
 * @param {Array} notifications - масив сповіщень
 * @returns {Promise<Object>} - результати відправки
 */
const sendMultiplePushNotifications = async (notifications) => {
  try {
    const messages = [];
    const validTokens = [];

    // Фільтруємо валідні токени та створюємо повідомлення
    for (const notification of notifications) {
      const { to, title, body, data = {} } = notification;

      if (Expo.isExpoPushToken(to)) {
        messages.push({
          to,
          sound: 'default',
          title,
          body,
          data,
          priority: 'high',
          channelId: 'default',
        });
        validTokens.push(to);
      } else {
        logger.warn(`Невалідний Expo push token: ${to}`);
      }
    }

    if (messages.length === 0) {
      logger.warn('Немає валідних токенів для відправки push-сповіщень');
      return { success: 0, failed: 0, total: 0 };
    }

    // Розбиваємо на chunks та відправляємо
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        logger.error('Помилка відправки chunk push-сповіщень:', error);
      }
    }

    // Підраховуємо результати
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'ok') {
        successCount++;
      } else {
        failedCount++;
        logger.error(`Помилка push-сповіщення для ${validTokens[i]}: ${ticket.message}`);
      }
    }

    logger.info(`Push-сповіщення відправлено: ${successCount} успішно, ${failedCount} з помилками`);

    return {
      success: successCount,
      failed: failedCount,
      total: messages.length,
    };
  } catch (error) {
    logger.error('Помилка відправки множинних push-сповіщень:', error);
    return { success: 0, failed: notifications.length, total: notifications.length };
  }
};

/**
 * Перевірка статусу доставки push-сповіщень
 * @param {Array} receiptIds - масив ID квитанцій
 * @returns {Promise<Object>} - статуси доставки
 */
const checkDeliveryStatus = async (receiptIds) => {
  try {
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    const receipts = {};

    for (const chunk of receiptIdChunks) {
      try {
        const receiptChunk = await expo.getPushNotificationReceiptsAsync(chunk);
        Object.assign(receipts, receiptChunk);
      } catch (error) {
        logger.error('Помилка отримання статусів доставки:', error);
      }
    }

    // Обробляємо результати
    const results = {
      delivered: 0,
      failed: 0,
      errors: [],
    };

    for (const receiptId in receipts) {
      const receipt = receipts[receiptId];
      if (receipt.status === 'ok') {
        results.delivered++;
      } else if (receipt.status === 'error') {
        results.failed++;
        results.errors.push({
          receiptId,
          error: receipt.message,
          details: receipt.details,
        });
        logger.error(`Помилка доставки push-сповіщення ${receiptId}: ${receipt.message}`);
      }
    }

    return results;
  } catch (error) {
    logger.error('Помилка перевірки статусу доставки:', error);
    return { delivered: 0, failed: receiptIds.length, errors: [error.message] };
  }
};

/**
 * Відправка сповіщення про новий запис
 * @param {Object} appointment - дані запису
 * @param {string} userToken - push token користувача
 */
const sendAppointmentNotification = async (appointment, userToken) => {
  const appointmentDate = new Date(appointment.scheduled_time);
  const formattedDate = appointmentDate.toLocaleDateString('uk-UA');
  const formattedTime = appointmentDate.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return await sendPushNotification({
    to: userToken,
    title: 'Новий запис на сервіс',
    body: `Ваш запис заплановано на ${formattedDate} о ${formattedTime}`,
    data: {
      type: 'appointment',
      appointmentId: appointment.id,
      date: appointment.scheduled_time,
    },
  });
};

/**
 * Відправка сповіщення про зміну статусу запису
 * @param {Object} appointment - дані запису
 * @param {string} userToken - push token користувача
 * @param {string} newStatus - новий статус
 */
const sendAppointmentStatusNotification = async (appointment, userToken, newStatus) => {
  const statusMessages = {
    confirmed: 'підтверджено',
    in_progress: 'розпочато виконання',
    completed: 'завершено',
    cancelled: 'скасовано',
  };

  const statusText = statusMessages[newStatus] || newStatus;

  return await sendPushNotification({
    to: userToken,
    title: 'Зміна статусу запису',
    body: `Статус вашого запису змінено на: ${statusText}`,
    data: {
      type: 'appointment_status',
      appointmentId: appointment.id,
      status: newStatus,
    },
  });
};

module.exports = {
  sendPushNotification,
  sendMultiplePushNotifications,
  checkDeliveryStatus,
  sendAppointmentNotification,
  sendAppointmentStatusNotification,
};
