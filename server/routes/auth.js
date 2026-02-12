const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const usersController = require('../controllers/users');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, authController.login);
router.post('/google', loginLimiter, authController.googleLogin);
router.post('/google/complete-profile', auth, authController.completeGoogleProfile);
router.post('/register', loginLimiter, authController.register);
router.post('/verify-email', loginLimiter, authController.verifyEmail);
router.post('/refresh-token', refreshLimiter, authController.refreshToken);
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);
router.get('/me', auth, authController.getCurrentUser);
router.post('/logout', refreshLimiter, authController.logout);
router.put('/profile', auth, usersController.updateUserProfile);

router.get('/2fa/generate', auth, authController.generateTwoFactorSecret);
router.post('/2fa/verify', auth, twoFactorLimiter, authController.verifyAndEnableTwoFactor);
router.post('/2fa/disable', auth, authController.disableTwoFactor);

module.exports = router;
