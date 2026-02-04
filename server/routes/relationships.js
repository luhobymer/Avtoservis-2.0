const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const relationshipController = require('../controllers/relationshipController');

// Всі роути захищені авторизацією
router.use(auth);

// Запросити механіка
router.post('/invite', relationshipController.inviteMechanic);

// Отримати моїх механіків (для клієнта)
router.get('/mechanics', relationshipController.getClientMechanics);

// Отримати моїх клієнтів (для майстра)
router.get('/clients', relationshipController.getMechanicClients);

// Оновити статус (прийняти/відхилити)
router.put('/:id', relationshipController.updateStatus);

// Пошук майстрів
router.get('/search-masters', relationshipController.searchMasters);

module.exports = router;
