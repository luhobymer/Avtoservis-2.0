/**
 * User routes for authentication and registration
 */

const express = require('express');
console.log('[users.js] Маршрути користувача завантажено');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth.js');
const controllers = require('../controllers/users.js');
console.log('[DEBUG] controllers:', controllers);
console.log('[DEBUG] getUserProfile:', controllers.getUserProfile);

// @route   POST api/users/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/login',
  check('email', 'Некоректний email').isEmail(),
  check('password', 'Пароль повинен містити щонайменше 8 символів').isLength({ min: 8 }),
  controllers.loginUser
);

// @route   GET api/users/me
// @desc    Get current user data
// @access  Private
router.get('/me', auth, controllers.getUserProfile);

// @route   POST api/users/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  check('email', 'Некоректний email').isEmail(),
  check('password', 'Пароль повинен містити щонайменше 8 символів').isLength({ min: 8 }),
  check('name', 'Імʼя обовʼязкове').not().isEmpty(),
  check('phone', 'Телефон обовʼязковий').not().isEmpty(),
  check('role', 'Роль обовʼязкова').not().isEmpty(),
  controllers.registerUser
);

// @route   PUT api/users/profile
// @desc    Оновлення профілю користувача
// @access  Private
router.put(
  '/profile',
  auth,
  check('name', 'Імʼя обовʼязкове').not().isEmpty(),
  check('phone', 'Телефон обовʼязковий').not().isEmpty(),
  controllers.updateUserProfile
);

module.exports = router;
