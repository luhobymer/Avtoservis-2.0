const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { checkAdmin } = require('../middleware/checkRole');
const paymentsController = require('../controllers/paymentsController');

router.get('/', auth, checkAdmin, paymentsController.listPayments);

module.exports = router;
