const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const mechanicController = require('../controllers/mechanicController');

// Публічні роути
router.get('/', mechanicController.getAllMechanics);
router.get('/:id', mechanicController.getMechanicById);
router.get('/:id/schedule', mechanicController.getMechanicSchedule);

// Захищені роути (тільки для адміністраторів)
router.post('/', auth, mechanicController.createMechanic);
router.put('/:id', auth, mechanicController.updateMechanic);
router.delete('/:id', auth, mechanicController.deleteMechanic);

module.exports = router;
