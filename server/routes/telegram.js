const express = require('express');
const router = express.Router();
const apiKeyMiddleware = require('../middleware/apiKey');
const auth = require('../middleware/auth');
const telegramController = require('../controllers/telegramController');
const authController = require('../controllers/authController');
const userController = require('../controllers/users');
const vehicleController = require('../controllers/vehicleController');

/**
 * Маршрути для Telegram-бота
 * Всі маршрути захищені middleware для перевірки API ключа
 */

// Застосовуємо middleware для перевірки API ключа до всіх маршрутів
router.use(apiKeyMiddleware);

router.post('/users/login', authController.login);
router.post('/users/update', auth, userController.updateUserProfile);
router.get('/me', auth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    phone: req.user.phone,
    role: req.user.role,
  });
});

// Маршрути для роботи з автомобілями
router.get(
  '/vehicles/:userId',
  auth,
  async (req, res, next) => {
    const requestedId = req.params.userId;
    if (requestedId !== req.user.id && req.user.role !== 'master') {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  },
  vehicleController.getUserVehicles
);
// Додавання авто для Telegram (перевіряє обов'язковість user_id)
router.post(
  '/vehicles',
  auth,
  (req, res, next) => {
    if (!req.body.user_id) {
      return res.status(400).json({ message: "user_id обов'язковий для Telegram API" });
    }
    if (req.body.user_id !== req.user.id && req.user.role !== 'master') {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  },
  vehicleController.addVehicle
);

// Маршрути для роботи з послугами
router.get('/services', telegramController.getAllServices);

// Маршрути для роботи зі станціями обслуговування
router.get('/stations', telegramController.getAllStations);

// Маршрути для роботи з записами на обслуговування
router.post('/appointments', auth, telegramController.createAppointment);
router.get(
  '/appointments/:userId',
  auth,
  async (req, res, next) => {
    const requestedId = req.params.userId;
    if (requestedId !== req.user.id && req.user.role !== 'master') {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  },
  telegramController.getUserAppointments
);

module.exports = router;
