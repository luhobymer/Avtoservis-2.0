/**
 * Сервіс для автоматичної перевірки та відправки нагадувань
 */

const crypto = require('crypto');
const cron = require('node-cron');
const { getDb, getExistingColumn } = require('../db/d1');
const logger = require('../middleware/logger.js');
const { sendPushNotification } = require('./pushNotificationService.js');
const { ensureVapidConfigured, sendWebPushToUser } = require('./webPushService.js');

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

const getNotificationSentColumn = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(reminders)').all();
  const columnNames = new Set(columns.map((column) => column.name));
  return ['notification_sent', 'notificationSent'].find((column) => columnNames.has(column));
};

const getReminderEnabledColumn = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(reminders)').all();
  const columnNames = new Set(columns.map((column) => column.name));
  return ['is_enabled', 'enabled'].find((column) => columnNames.has(column));
};

const ensureReminderEnabledColumn = async (db) => {
  try {
    const enabledCol = await getReminderEnabledColumn(db);
    if (enabledCol) return enabledCol;
    await db.prepare('ALTER TABLE reminders ADD COLUMN is_enabled INTEGER DEFAULT 1').run();
    return 'is_enabled';
  } catch (err) {
    logger.warn('[reminders] failed to ensure is_enabled column:', { message: err?.message });
    return await getReminderEnabledColumn(db);
  }
};

/**
 * Перевірка нагадувань, які потрібно відправити
 */
const checkAndSendReminders = async () => {
  const report = {
    due: 0,
    processed: 0,
    created: 0,
    skipped_existing: 0,
    skipped_flag: 0,
    skipped_disabled: 0,
    errors: 0,
  };
  try {
    logger.info('Початок перевірки нагадувань...');

    // Отримуємо нагадування, які потрібно відправити (за наступні 24 години)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const db = await getDb();

    await ensureReminderEnabledColumn(db);

    const notificationSentColumn = await getNotificationSentColumn(db);
    const notificationSentFilter = notificationSentColumn
      ? ` AND r.${notificationSentColumn} = 0`
      : '';

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
        WHERE r.is_completed = 0
          AND r.due_date IS NOT NULL
          AND date(r.due_date) <= date(?)
          AND date(r.due_date) >= date(?)${notificationSentFilter}`
      )
      .all(tomorrow.toISOString(), new Date().toISOString());

    const reminders = reminderRows.map(mapReminderRow);

    report.due = reminders.length;

    if (!reminders || reminders.length === 0) {
      logger.info('Нагадувань для відправки не знайдено');
      return report;
    }

    logger.info(`Знайдено ${reminders.length} нагадувань для відправки`);

    // Обробляємо кожне нагадування
    for (const reminder of reminders) {
      const result = await processReminder(reminder);
      report.processed += 1;
      if (result?.created) report.created += 1;
      if (result?.reason === 'existing') report.skipped_existing += 1;
      if (result?.reason === 'flag') report.skipped_flag += 1;
      if (result?.reason === 'disabled') report.skipped_disabled += 1;
      if (result?.reason === 'error') report.errors += 1;
    }

    logger.info('Завершено перевірку нагадувань');
    return report;
  } catch (error) {
    logger.error('Помилка при перевірці нагадувань:', error);
    report.errors += 1;
    return report;
  }
};

/**
 * Обробка окремого нагадування
 * @param {Object} reminder - об'єкт нагадування
 */
const processReminder = async (reminder) => {
  try {
    const isEnabled = (() => {
      if (typeof reminder?.is_enabled !== 'undefined') return Boolean(reminder.is_enabled);
      if (typeof reminder?.enabled !== 'undefined') return Boolean(reminder.enabled);
      return true;
    })();

    if (!isEnabled) {
      logger.info(`Нагадування ${reminder.id} вимкнене (is_enabled=0), пропускаємо`);
      return { created: false, reason: 'disabled' };
    }

    // Перевіряємо, чи не було вже відправлено сповіщення
    const db = await getDb();
    const readColumn = await getExistingColumn('notifications', ['is_read', 'read']);
    const notificationSentColumn = await getNotificationSentColumn(db);
    if (notificationSentColumn && reminder?.[notificationSentColumn]) {
      logger.info(`Нагадування ${reminder.id} вже має прапорець notification_sent, пропускаємо`);
      return { created: false, reason: 'flag' };
    }

    const existingNotification = await db
      .prepare(
        `SELECT id FROM notifications
         WHERE user_id = ? AND type = ? AND data LIKE ?
         LIMIT 1`
      )
      .get(reminder.user_id, 'reminder', `%"reminderId":"${reminder.id}"%`);

    if (existingNotification) {
      logger.info(`Сповіщення для нагадування ${reminder.id} вже відправлено`);
      if (notificationSentColumn) {
        try {
          await db
            .prepare(
              `UPDATE reminders SET ${notificationSentColumn} = 1, updated_at = ? WHERE id = ?`
            )
            .run(new Date().toISOString(), reminder.id);
        } catch (updateError) {
          logger.warn(
            `Не вдалося оновити прапорець notification_sent для ${reminder.id}:`,
            updateError
          );
        }
      }
      return { created: false, reason: 'existing' };
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
      data: JSON.stringify({
        type: 'reminder',
        reminderId: reminder.id,
        reminder_id: reminder.id,
        vehicle_vin: reminder.vehicle_vin || null,
      }),
    };

    try {
      await db
        .prepare(
          `INSERT INTO notifications
          (id, user_id, type, title, message, ${readColumn}, created_at, status, data)
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
      return { created: false, reason: 'error' };
    }

    if (notificationSentColumn) {
      try {
        await db
          .prepare(
            `UPDATE reminders SET ${notificationSentColumn} = 1, updated_at = ? WHERE id = ?`
          )
          .run(new Date().toISOString(), reminder.id);
      } catch (updateError) {
        logger.warn(
          `Не вдалося оновити прапорець notification_sent для ${reminder.id}:`,
          updateError
        );
      }
    }

    try {
      const vapid = ensureVapidConfigured();
      if (vapid.ok) {
        await sendWebPushToUser(reminder.user_id, {
          title: notificationData.title,
          body: notificationData.message,
          data: {
            url: `/reminders?reminderId=${encodeURIComponent(reminder.id)}`,
            type: 'reminder',
            reminder_id: reminder.id,
            vehicle_vin: reminder.vehicle_vin || null,
          },
        });
      }
    } catch (err) {
      logger.warn('Web push send failed:', { message: err?.message });
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
    return { created: true };
  } catch (error) {
    logger.error(`Помилка обробки нагадування ${reminder.id}:`, error);
    return { created: false, reason: 'error' };
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
