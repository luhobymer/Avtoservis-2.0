const express = require('express');
const router = express.Router();
const registryController = require('../controllers/registryController');

router.get('/', registryController.searchVehicle);

module.exports = router;
