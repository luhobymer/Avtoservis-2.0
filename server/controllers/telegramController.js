const { supabase } = require('../config/supabase.js');
const logger = require('../utils/logger.js');
const userController = require('./users');
const serviceController = require('./serviceController');
const serviceStationController = require('./serviceStationController');
const appointmentController = require('./appointmentController');
const vehicleController = require('./vehicleController');

/**
 * Контролер для обробки запитів від Telegram-бота
 */

// Отримати всі послуги
exports.getAllServices = async (req, res) => {
  try {
    logger.info('Telegram bot: запит на отримання всіх послуг');
    return serviceController.getAllServices(req, res);
  } catch (err) {
    logger.error('Telegram bot: помилка отримання послуг:', err);
    res.status(500).json({ success: false, error: 'Помилка сервера', details: err.message });
  }
};

// Отримати всі станції обслуговування
exports.getAllStations = async (req, res) => {
  try {
    logger.info('Telegram bot: запит на отримання всіх станцій');
    return serviceStationController.getAllStations(req, res);
  } catch (err) {
    logger.error('Telegram bot: помилка отримання станцій:', err);
    res.status(500).json({ success: false, error: 'Помилка сервера', details: err.message });
  }
};

// Створити новий запис на обслуговування
exports.createAppointment = async (req, res) => {
  try {
    logger.info('Telegram bot: запит на створення запису на обслуговування');

    // Перевіряємо наявність необхідних даних
    const { service_id, mechanic_id, scheduled_time, user_id } = req.body;

    if (!service_id || !mechanic_id || !scheduled_time || !user_id) {
      return res.status(400).json({
        success: false,
        error: "Відсутні обов'язкові поля",
        details: 'Необхідно вказати service_id, mechanic_id, scheduled_time та user_id',
      });
    }

    // Перевіряємо існування користувача
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'Користувача не знайдено',
        details: 'Користувач з вказаним ID не існує',
      });
    }

    // Модифікуємо запит для використання ID користувача з тіла запиту
    req.user = { id: user_id };

    return appointmentController.createAppointment(req, res);
  } catch (err) {
    logger.error('Telegram bot: помилка створення запису:', err);
    res.status(500).json({ success: false, error: 'Помилка сервера', details: err.message });
  }
};

// Отримати записи користувача
exports.getUserAppointments = async (req, res) => {
  try {
    logger.info('Telegram bot: запит на отримання записів користувача');

    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Відсутній ID користувача',
        details: 'Необхідно вказати ID користувача',
      });
    }

    // Модифікуємо запит для використання ID користувача з параметрів
    req.user = { id: userId };

    return appointmentController.getUserAppointments(req, res);
  } catch (err) {
    logger.error('Telegram bot: помилка отримання записів користувача:', err);
    res.status(500).json({ success: false, error: 'Помилка сервера', details: err.message });
  }
};
