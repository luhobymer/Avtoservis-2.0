const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const maintenanceController = require('../controllers/maintenanceController');

router.get('/:vin', auth, maintenanceController.getSchedule);
router.post('/init-default/:vin', auth, maintenanceController.initDefaultSchedule);
router.post('/', auth, maintenanceController.addItem);
router.put('/:id', auth, maintenanceController.updateItem);
router.delete('/:id', auth, maintenanceController.deleteItem);

module.exports = router;
