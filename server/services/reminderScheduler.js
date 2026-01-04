/**
 * Сервіс для автоматичної перевірки та відправки нагадувань
 */

const cron = require('node-cron');
const { supabase } = require('../config/supabase.js');
const logger = require('../middleware/logger.js');
const { sendPushNotification } = require('./pushNotificationService.js');

/**
 * Перевірка нагадувань, які потрібно відправити
 */
const checkAndSendReminders = async () => {
  try {
    logger.info('Початок перевірки нагадувань...');

    // Отримуємо нагадування, які потрібно відправити (за наступні 24 години)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: reminders, error } = await supabase
      .from('reminders')
      .select(
        `
        *,
        users!inner(id, email, phone),
        vehicles(brand, make, model, year, license_plate)
      `
      )
      .eq('is_completed', false)
      .lte('reminder_date', tomorrow.toISOString())
      .gte('reminder_date', new Date().toISOString());

    if (error) {
      logger.error('Помилка отримання нагадувань:', error);
      return;
    }

    if (!reminders || reminders.length === 0) {
      logger.info('Нагадувань для відправки не знайдено');
      return;
    }

    logger.info(`Знайдено ${reminders.length} нагадувань для відправки`);

    // Обробляємо кожне нагадування
    for (const reminder of reminders) {
      await processReminder(reminder);
    }

    logger.info('Завершено перевірку нагадувань');
  } catch (error) {
    logger.error('Помилка при перевірці нагадувань:', error);
  }
};

/**
 * Обробка окремого нагадування
 * @param {Object} reminder - об'єкт нагадування
 */
const processReminder = async (reminder) => {
  try {
    // Перевіряємо, чи не було вже відправлено сповіщення
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', reminder.user_id)
      .eq('type', 'reminder')
      .eq('reference_id', reminder.id)
      .single();

    if (existingNotification) {
      logger.info(`Сповіщення для нагадування ${reminder.id} вже відправлено`);
      return;
    }

    // Створюємо сповіщення в базі даних
    const notificationData = {
      user_id: reminder.user_id,
      type: 'reminder',
      title: getNotificationTitle(reminder),
      message: getNotificationMessage(reminder),
      reference_id: reminder.id,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (notificationError) {
      logger.error(
        `Помилка створення сповіщення для нагадування ${reminder.id}:`,
        notificationError
      );
      return;
    }

    // Отримуємо push-токени користувача
    const { data: pushTokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', reminder.user_id)
      .eq('is_active', true);

    // Відправляємо push-сповіщення
    if (pushTokens && pushTokens.length > 0) {
      for (const tokenData of pushTokens) {
        await sendPushNotification({
          to: tokenData.token,
          title: notificationData.title,
          body: notificationData.message,
          data: {
            type: 'reminder',
            reminderId: reminder.id,
            notificationId: notification.id,
          },
        });
      }
    }

    // Якщо нагадування повторюване, створюємо наступне
    if (reminder.is_recurring && reminder.recurring_interval) {
      await createNextRecurringReminder(reminder);
    }

    logger.info(`Успішно оброблено нагадування ${reminder.id}`);
  } catch (error) {
    logger.error(`Помилка обробки нагадування ${reminder.id}:`, error);
  }
};

/**
 * Створення наступного повторюваного нагадування
 * @param {Object} reminder - поточне нагадування
 */
const createNextRecurringReminder = async (reminder) => {
  try {
    const currentDate = new Date(reminder.reminder_date);
    let nextDate;

    switch (reminder.recurring_interval) {
      case 'daily':
        nextDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
        break;
      case 'weekly':
        nextDate = new Date(currentDate.setDate(currentDate.getDate() + 7));
        break;
      case 'monthly':
        nextDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
        break;
      case 'yearly':
        nextDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
        break;
      default:
        logger.warn(`Невідомий інтервал повторення: ${reminder.recurring_interval}`);
        return;
    }

    const nextReminderData = {
      user_id: reminder.user_id,
      vehicle_id: reminder.vehicle_id,
      title: reminder.title,
      description: reminder.description,
      reminder_type: reminder.reminder_type,
      reminder_date: nextDate.toISOString(),
      mileage_threshold: reminder.mileage_threshold,
      is_completed: false,
      is_recurring: true,
      recurring_interval: reminder.recurring_interval,
    };

    const { error } = await supabase.from('reminders').insert(nextReminderData);

    if (error) {
      logger.error(`Помилка створення наступного нагадування для ${reminder.id}:`, error);
    } else {
      logger.info(`Створено наступне повторюване нагадування для ${reminder.id}`);
    }
  } catch (error) {
    logger.error(`Помилка створення повторюваного нагадування:`, error);
  }
};

/**
 * Генерація заголовка сповіщення
 * @param {Object} reminder - нагадування
 * @returns {string} - заголовок
 */
const getNotificationTitle = (reminder) => {
  const typeMap = {
    maintenance: 'Нагадування про ТО',
    inspection: 'Нагадування про техогляд',
    insurance: 'Нагадування про страхування',
    custom: 'Нагадування',
  };

  return typeMap[reminder.reminder_type] || 'Нагадування';
};

/**
 * Генерація тексту сповіщення
 * @param {Object} reminder - нагадування
 * @returns {string} - текст повідомлення
 */
const getNotificationMessage = (reminder) => {
  let message = reminder.title;

  if (reminder.vehicles) {
    const vehicle = reminder.vehicles;
    const make = vehicle.brand || vehicle.make;
    message += ` для ${make} ${vehicle.model} (${vehicle.license_plate})`;
  }

  const reminderDate = new Date(reminder.reminder_date);
  const today = new Date();
  const diffTime = reminderDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    message += ' - сьогодні!';
  } else if (diffDays === 1) {
    message += ' - завтра!';
  } else if (diffDays > 1) {
    message += ` - через ${diffDays} днів`;
  }

  return message;
};

/**
 * Запуск планувальника нагадувань
 */
const startReminderScheduler = () => {
  // Перевіряємо нагадування кожні 30 хвилин
  cron.schedule('*/30 * * * *', () => {
    logger.info('Запуск планової перевірки нагадувань...');
    checkAndSendReminders();
  });

  // Також перевіряємо щодня о 9:00 ранку
  cron.schedule('0 9 * * *', () => {
    logger.info('Запуск щоденної перевірки нагадувань...');
    checkAndSendReminders();
  });

  logger.info('Планувальник нагадувань запущено');
};

/**
 * Зупинка планувальника нагадувань
 */
const stopReminderScheduler = () => {
  cron.destroy();
  logger.info('Планувальник нагадувань зупинено');
};

module.exports = {
  startReminderScheduler,
  stopReminderScheduler,
  checkAndSendReminders,
};
