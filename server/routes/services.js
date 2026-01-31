const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkAdmin } = require('../middleware/checkRole');
const serviceController = require('../controllers/serviceController');

// Публічні роути
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);

// Захищені роути (тільки для адміністраторів)
router.post('/', auth, checkAdmin, serviceController.createService);
router.put('/:id', auth, checkAdmin, serviceController.updateService);
router.delete('/:id', auth, checkAdmin, serviceController.deleteService);

module.exports = router;
