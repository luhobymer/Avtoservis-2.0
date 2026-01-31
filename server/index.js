const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Імпорт конфігурацій
const corsOptions = require('./config/cors');

// Імпорт middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

// Імпорт роутів
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const serviceStationRoutes = require('./routes/serviceStations');
const serviceRoutes = require('./routes/services');
const appointmentRoutes = require('./routes/appointments');
const mechanicRoutes = require('./routes/mechanics');
const vehicleRoutes = require('./routes/vehicles');
const serviceRecordRoutes = require('./routes/serviceRecords');
const reminderRoutes = require('./routes/reminders');
const notificationRoutes = require('./routes/notifications');
const interactionRoutes = require('./routes/interactions');
const deviceRoutes = require('./routes/deviceTokens');
const registryRoutes = require('./routes/registry');
const { getDb } = require('./db/d1');

const app = express();

// Імпорт планувальника нагадувань
const { startReminderScheduler } = require('./services/reminderScheduler');

// Базові middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression()); // Додаємо стиснення відповідей

// Безпека
app.use(helmet());
app.use(cors(corsOptions));

// Логування
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 100, // Максимум 100 запитів від одного IP
  message: { message: 'Забагато запитів. Спробуйте пізніше.' },
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Роути API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stations', serviceStationRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/mechanics', mechanicRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/service-records', serviceRecordRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/vehicle-registry', registryRoutes);

// Роут для Telegram-бота
const telegramRoutes = require('./routes/telegram');
app.use('/api/telegram', telegramRoutes);

// Обробка помилок 404
app.use((req, res) => {
  res.status(404).json({
    message: 'Не знайдено',
    path: req.originalUrl,
  });
});

// Глобальний обробник помилок
app.use(errorHandler);

// Запуск сервера
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SCHEDULER_ENABLED = String(process.env.SCHEDULER_ENABLED || 'false').toLowerCase() === 'true';

if (require.main === module) {
  Promise.resolve()
    .then(() => getDb())
    .catch((err) => {
      logger.error('Помилка ініціалізації D1:', err);
    });

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(
      `Сервер запущено в режимі ${NODE_ENV} на порту ${PORT} (доступний з усіх інтерфейсів)`
    );

    if (SCHEDULER_ENABLED) {
      try {
        startReminderScheduler();
        logger.info('Планувальник нагадувань увімкнено через SCHEDULER_ENABLED=true');
      } catch (err) {
        logger.error('Помилка запуску планувальника нагадувань:', err);
      }
    } else {
      logger.info('Планувальник нагадувань вимкнено (SCHEDULER_ENABLED=false)');
    }
  });

  process.on('unhandledRejection', (err) => {
    logger.error('Необроблена Promise помилка:', err);
  });

  process.on('uncaughtException', (err) => {
    console.error('Необроблена помилка:', err);
    process.exit(1);
  });
}

module.exports = app;
