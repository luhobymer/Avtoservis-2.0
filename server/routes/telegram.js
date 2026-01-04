const express = require('express');
const router = express.Router();
const apiKeyMiddleware = require('../middleware/apiKey');
const telegramController = require('../controllers/telegramController');
const userController = require('../controllers/users');
const vehicleController = require('../controllers/vehicleController');

/**
 * Маршрути для Telegram-бота
 * Всі маршрути захищені middleware для перевірки API ключа
 */

// Застосовуємо middleware для перевірки API ключа до всіх маршрутів
router.use(apiKeyMiddleware);

// Маршрути для роботи з користувачами
router.post('/users/login', userController.loginUser);
router.post('/users/update', userController.updateUserProfile);

// Маршрути для роботи з автомобілями
router.get('/vehicles/:userId', vehicleController.getUserVehicles);
// Додавання авто для Telegram (перевіряє обов'язковість user_id)
router.post(
  '/vehicles',
  (req, res, next) => {
    if (!req.body.user_id) {
      return res.status(400).json({ message: "user_id обов'язковий для Telegram API" });
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
router.post('/appointments', telegramController.createAppointment);
router.get('/appointments/:userId', telegramController.getUserAppointments);

module.exports = router;
