/**
 * Сервіс для відправки push-сповіщень через Expo
 */

const logger = require('../middleware/logger.js');

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
    void notificationData;
    logger.warn('Push-сповіщення вимкнені без Expo або іншого провайдера.');
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
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return { success: 0, failed: 0, total: 0 };
    }
    logger.warn('Push-сповіщення вимкнені без Expo або іншого провайдера.');
    return { success: 0, failed: notifications.length, total: notifications.length };
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
    const results = {
      delivered: 0,
      failed: receiptIds.length,
      errors: [],
    };
    logger.warn('Push-сповіщення вимкнені без Expo або іншого провайдера.');
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
