const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const serviceController = require('../controllers/serviceController');

// Публічні роути
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);

// Захищені роути (тільки для адміністраторів)
router.post('/', auth, serviceController.createService);
router.put('/:id', auth, serviceController.updateService);
router.delete('/:id', auth, serviceController.deleteService);

module.exports = router;
