const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const vehicleController = require('../controllers/vehicleController');

// Отримати всі автомобілі користувача
router.get('/', auth, vehicleController.getUserVehicles);

// Спеціальні шляхи повинні бути вище параметризованих
// Отримати автомобіль за номерним знаком
router.get('/license/:licensePlate', auth, vehicleController.getVehicleByLicensePlate);

// Отримати автомобіль за номерним знаком для Telegram бота (без авторизації)
router.get('/bot/license/:licensePlate', vehicleController.getVehicleByLicensePlateForBot);

// Отримати автомобіль за VIN
router.get('/:vin', auth, vehicleController.getVehicleByVin);

// Додати новий автомобіль
router.post(
  '/',
  [
    auth,
    check('vin', "VIN обов'язковий").not().isEmpty(),
    // Приймаємо або make або brand
    check('make').custom((value, { req }) => {
      if (!value && !req.body.brand) {
        throw new Error("Марка обов'язкова (make або brand)");
      }
      return true;
    }),
    check('model', "Модель обов'язкова").not().isEmpty(),
    check('year', 'Рік має бути числом').isNumeric(),
    check('mileage', 'Пробіг має бути числом').optional().isNumeric(),
    check('licensePlate', 'Номерний знак').optional(),
    check('license_plate', 'Номерний знак').optional(),
    check('color', 'Колір').optional(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    await vehicleController.addVehicle(req, res);
  }
);

// Оновити інформацію про автомобіль
router.put(
  '/:vin',
  [
    auth,
    check('make', 'Марка').optional(),
    check('brand', 'Марка').optional(),
    check('model', 'Модель').optional(),
    check('year', 'Рік має бути числом').optional().isNumeric(),
    check('mileage', 'Пробіг має бути числом').optional().isNumeric(),
    check('licensePlate', 'Номерний знак').optional(),
    check('license_plate', 'Номерний знак').optional(),
    check('color', 'Колір').optional(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    await vehicleController.updateVehicle(req, res);
  }
);

// Видалити автомобіль
router.delete('/:vin', auth, vehicleController.deleteVehicle);

module.exports = router;
