const logger = require('./logger');

// Обробник помилок
const errorHandler = (err, req, res, next) => {
  // Логуємо помилку
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  // Визначаємо статус помилки
  const status = err.status || 500;
  const message = err.message || 'Внутрішня помилка сервера';

  // Якщо це помилка валідації
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Помилка валідації',
      errors: err.errors,
    });
  }

  // Якщо це помилка бази даних
  if (err.code === '23505') {
    // Postgres unique violation
    return res.status(409).json({
      message: 'Запис вже існує',
    });
  }

  // Якщо це помилка автентифікації
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      message: 'Необхідна автентифікація',
    });
  }

  // В режимі розробки відправляємо стек помилки
  const error = {
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(status).json(error);
};

module.exports = errorHandler;
