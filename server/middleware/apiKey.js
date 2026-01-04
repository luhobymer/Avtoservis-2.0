/**
 * Middleware для перевірки API ключа
 * Використовується для авторизації запитів від Telegram-бота
 */
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  try {
    // Отримуємо API ключ з заголовків
    const apiKey = req.header('x-api-key');

    if (!apiKey) {
      logger.warn('Спроба доступу без API ключа');
      return res.status(401).json({
        success: false,
        error: 'Відсутній API ключ',
        details: 'Для доступу до API необхідно надати ключ',
      });
    }

    // Перевіряємо, чи співпадає ключ з тим, що в змінних середовища
    const validApiKey = process.env.SERVER_API_KEY;

    if (!validApiKey) {
      logger.error('SERVER_API_KEY не знайдено в змінних середовища');
      return res.status(500).json({
        success: false,
        error: 'Помилка конфігурації сервера',
        details: 'Відсутній ключ API на сервері',
      });
    }

    if (apiKey !== validApiKey) {
      logger.warn('Спроба доступу з недійсним API ключем');
      return res.status(403).json({
        success: false,
        error: 'Недійсний API ключ',
        details: 'Наданий ключ API не є дійсним',
      });
    }

    // Якщо ключ валідний, продовжуємо виконання запиту
    next();
  } catch (error) {
    logger.error('Помилка при перевірці API ключа:', error);
    return res.status(500).json({
      success: false,
      error: 'Помилка сервера',
      details: 'Виникла помилка при перевірці API ключа',
    });
  }
};
