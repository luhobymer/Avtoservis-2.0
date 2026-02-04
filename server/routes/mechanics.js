const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const mechanicController = require('../controllers/mechanicController');
const mechanicServiceController = require('../controllers/mechanicServiceController');

function ensurePrivileged(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Немає токена, доступ заборонено' });
    }
    const role = String(req.user.role || '').toLowerCase();
    if (!['master', 'mechanic', 'admin'].includes(role)) {
      return res.status(403).json({ message: 'Ця дія доступна тільки для майстрів-механіків' });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
}

// Публічні роути
router.get('/', mechanicController.getAllMechanics);
router.get('/me', auth, ensurePrivileged, mechanicController.getCurrentMechanic);
router.get('/:id', mechanicController.getMechanicById);
router.get('/:id/schedule', mechanicController.getMechanicSchedule);
router.get('/:id/services', auth, mechanicServiceController.getMechanicServices);

router.put(
  '/:id/services/:serviceId',
  auth,
  ensurePrivileged,
  mechanicServiceController.setMechanicServiceEnabled
);

router.post(
  '/:id/services',
  auth,
  ensurePrivileged,
  mechanicServiceController.createMechanicService
);

router.put(
  '/:id/services/:serviceId/details',
  auth,
  ensurePrivileged,
  mechanicServiceController.updateMechanicServiceDetails
);

// Єдиний привілейований доступ до змін механіків має майстер-механік
const ensureMasterMechanic = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Немає токена, доступ заборонено' });
    }

    if (req.user.role !== 'master') {
      return res.status(403).json({
        message: 'Ця дія доступна тільки для майстрів-механіків',
      });
    }

    return next();
  } catch (err) {
    console.error('ensureMasterMechanic error:', err);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Захищені роути: змінювати механіків може лише майстер-механік
router.post('/', auth, ensureMasterMechanic, mechanicController.createMechanic);
router.put('/:id', auth, ensureMasterMechanic, mechanicController.updateMechanic);
router.delete('/:id', auth, ensureMasterMechanic, mechanicController.deleteMechanic);

module.exports = router;
