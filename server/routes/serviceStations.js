const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const serviceStationController = require('../controllers/serviceStationController');

// Публічні роути
router.get('/', serviceStationController.getAllStations);
router.get('/:id', serviceStationController.getStationById);

// Захищені роути (тільки для адміністраторів)
router.post('/', auth, serviceStationController.createStation);
router.put('/:id', auth, serviceStationController.updateStation);
router.delete('/:id', auth, serviceStationController.deleteStation);

module.exports = router;
