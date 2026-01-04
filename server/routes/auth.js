const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

/**
 * Маршрути для автентифікації та управління користувачами
 */

// Основні маршрути автентифікації
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh-token', authController.refreshToken); // Новий маршрут для оновлення токенів
router.get('/me', auth, authController.getCurrentUser);

// Маршрути для двофакторної автентифікації
router.get('/2fa/generate', auth, authController.generateTwoFactorSecret);
router.post('/2fa/verify', auth, authController.verifyAndEnableTwoFactor);
router.post('/2fa/disable', auth, authController.disableTwoFactor);

module.exports = router;
