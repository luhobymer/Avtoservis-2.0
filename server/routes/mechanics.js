const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const mechanicController = require('../controllers/mechanicController');

// Публічні роути
router.get('/', mechanicController.getAllMechanics);
router.get('/:id', mechanicController.getMechanicById);
router.get('/:id/schedule', mechanicController.getMechanicSchedule);

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
