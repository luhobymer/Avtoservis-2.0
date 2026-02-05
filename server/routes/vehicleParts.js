const express = require('express');
const router = express.Router();
const vehiclePartsController = require('../controllers/vehiclePartsController');
const auth = require('../middleware/auth');

router.get('/', auth, vehiclePartsController.listForUser);
router.post('/', auth, vehiclePartsController.createPart);
router.get('/appointment/:appointmentId', auth, vehiclePartsController.listForAppointment);
router.get('/:vin', auth, vehiclePartsController.listForVehicle);

module.exports = router;
