const express = require('express');
const auth = require('../middleware/auth');
const insuranceController = require('../controllers/insuranceController');

const router = express.Router();

router.get('/', auth, insuranceController.listInsurances);
router.post('/', auth, insuranceController.createInsurance);
router.put('/:id', auth, insuranceController.updateInsurance);
router.delete('/:id', auth, insuranceController.deleteInsurance);

module.exports = router;
