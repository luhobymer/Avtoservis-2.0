/**
 * Сервіс для автоматичної перевірки та відправки нагадувань
 */

const crypto = require('crypto');
const cron = require('node-cron');
const { getDb } = require('../db/d1');
const logger = require('../middleware/logger.js');
const { sendPushNotification } = require('./pushNotificationService.js');

const mapReminderRow = (row) => {
  const {
    user_id_ref,
    user_email,
    user_phone,
    vehicle_make,
    vehicle_model,
    vehicle_year,
    vehicle_license_plate,
    ...reminder
  } = row;

  return {
    ...reminder,
    reminder_date: row.due_date,
    recurring_interval: row.recurrence_interval,
    is_completed: !!row.is_completed,
    is_recurring: !!row.is_recurring,
    users: user_id_ref ? { id: user_id_ref, email: user_email, phone: user_phone } : null,
    vehicles:
      vehicle_make || vehicle_model || vehicle_year || vehicle_license_plate
        ? {
            brand: vehicle_make,
            make: vehicle_make,
            model: vehicle_model,
            year: vehicle_year,
            license_plate: vehicle_license_plate,
          }
        : null,
  };
};

const getActiveColumn = async (db, tableName) => {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const columnNames = new Set(columns.map((column) => column.name));
  return ['is_active', 'isActive', 'active'].find((column) => columnNames.has(column));
};

/**
 * Перевірка нагадувань, які потрібно відправити
 */
const checkAndSendReminders = async () => {
  try {
    logger.info('Початок перевірки нагадувань...');

    // Отримуємо нагадування, які потрібно відправити (за наступні 24 години)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const db = await getDb();
    const reminderRows = await db
      .prepare(
        `SELECT r.*,
          u.id AS user_id_ref,
          u.email AS user_email,
          u.phone AS user_phone,
          v.make AS vehicle_make,
          v.model AS vehicle_model,
          v.year AS vehicle_year,
          v.license_plate AS vehicle_license_plate
        FROM reminders r
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN vehicles v ON v.vin = r.vehicle_vin
        WHERE r.is_completed = 0 AND r.due_date <= ? AND r.due_date >= ?`
      )
      .all(tomorrow.toISOString(), new Date().toISOString());

    const reminders = reminderRows.map(mapReminderRow);

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
    const db = await getDb();
    const existingNotification = await db
      .prepare(
        `SELECT id FROM notifications
         WHERE user_id = ? AND type = ? AND data LIKE ?
         LIMIT 1`
      )
      .get(reminder.user_id, 'reminder', `%"reminderId":"${reminder.id}"%`);

    if (existingNotification) {
      logger.info(`Сповіщення для нагадування ${reminder.id} вже відправлено`);
      return;
    }

    // Створюємо сповіщення в базі даних
    const notificationId = crypto.randomUUID();
    const notificationData = {
      id: notificationId,
      user_id: reminder.user_id,
      type: 'reminder',
      title: getNotificationTitle(reminder),
      message: getNotificationMessage(reminder),
      is_read: 0,
      created_at: new Date().toISOString(),
      status: 'pending',
      data: JSON.stringify({ type: 'reminder', reminderId: reminder.id }),
    };

    try {
      await db
        .prepare(
          `INSERT INTO notifications
          (id, user_id, type, title, message, is_read, created_at, status, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          notificationData.id,
          notificationData.user_id,
          notificationData.type,
          notificationData.title,
          notificationData.message,
          notificationData.is_read,
          notificationData.created_at,
          notificationData.status,
          notificationData.data
        );
    } catch (notificationError) {
      logger.error(
        `Помилка створення сповіщення для нагадування ${reminder.id}:`,
        notificationError
      );
      return;
    }

    // Отримуємо push-токени користувача
    const pushTokensTable = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='push_tokens'")
      .get();
    const pushTokens = [];

    if (pushTokensTable) {
      const activeColumn = await getActiveColumn(db, 'push_tokens');
      const query = activeColumn
        ? `SELECT token FROM push_tokens WHERE user_id = ? AND ${activeColumn} = 1`
        : 'SELECT token FROM push_tokens WHERE user_id = ?';
      pushTokens.push(...(await db.prepare(query).all(reminder.user_id)));
    } else {
      logger.info('Таблиця push_tokens не знайдена, push-сповіщення пропущено');
    }

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
            notificationId,
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
    const currentDate = new Date(reminder.reminder_date || reminder.due_date);
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

    const nextReminderId = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = await getDb();
    await db
      .prepare(
        `INSERT INTO reminders
          (id, user_id, vehicle_vin, title, description, reminder_type, due_date, due_mileage,
          is_completed, is_recurring, recurrence_interval, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nextReminderId,
        reminder.user_id,
        reminder.vehicle_vin || null,
        reminder.title,
        reminder.description || null,
        reminder.reminder_type || 'custom',
        nextDate.toISOString(),
        reminder.due_mileage ?? reminder.mileage_threshold ?? null,
        0,
        1,
        reminder.recurring_interval,
        now,
        now
      );

    logger.info(`Створено наступне повторюване нагадування для ${reminder.id}`);
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
 */
const getNotificationMessage = (reminder) => {
  let message = reminder?.title || 'Нагадування';

  const vehicle = reminder?.vehicles || null;
  if (vehicle) {
    const make = vehicle.make || vehicle.brand || '';
    const model = vehicle.model || '';
    const vehicleLabel = [make, model].filter(Boolean).join(' ');
    const lp = vehicle.license_plate ? ` (${vehicle.license_plate})` : '';
    if (vehicleLabel || lp) {
      message += ` для ${vehicleLabel}${lp}`.trimEnd();
    }
  }

  const dueDateValue = reminder?.reminder_date || reminder?.due_date || null;
  const dueMileage = reminder?.due_mileage ?? reminder?.mileage_threshold ?? null;

  if (dueDateValue) {
    const reminderDate = new Date(dueDateValue);
    if (!Number.isNaN(reminderDate.getTime())) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfReminder = new Date(reminderDate);
      startOfReminder.setHours(0, 0, 0, 0);

      const diffMs = startOfReminder.getTime() - startOfToday.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) message += ' - сьогодні!';
      else if (diffDays === 1) message += ' - завтра!';
      else if (diffDays > 1) message += ` - через ${diffDays} днів`;
    }
  } else if (dueMileage != null) {
    message += ` - поріг пробігу ${dueMileage} км`;
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
