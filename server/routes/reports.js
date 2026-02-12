const express = require('express');
const auth = require('../middleware/auth');
const serviceRecordController = require('../controllers/serviceRecordController');

const router = express.Router();

router.get('/service-history/:vin', auth, serviceRecordController.exportServiceHistoryPdf);

module.exports = router;
