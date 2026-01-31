const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkAdmin } = require('../middleware/checkRole');
const serviceStationController = require('../controllers/serviceStationController');

// Публічні роути
router.get('/', serviceStationController.getAllStations);
router.get('/:id', serviceStationController.getStationById);

// Захищені роути (тільки для адміністраторів)
router.post('/', auth, checkAdmin, serviceStationController.createStation);
router.put('/:id', auth, checkAdmin, serviceStationController.updateStation);
router.delete('/:id', auth, checkAdmin, serviceStationController.deleteStation);

module.exports = router;
