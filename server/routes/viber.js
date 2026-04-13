const express = require('express');
const router = express.Router();
const apiKeyMiddleware = require('../middleware/apiKey');
const viberController = require('../controllers/viberController');

router.use(apiKeyMiddleware);

router.get('/health', viberController.health);
router.post('/webhook', viberController.webhook);

module.exports = router;
