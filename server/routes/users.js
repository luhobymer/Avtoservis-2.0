const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth.js');
const authController = require('../controllers/authController.js');
const controllers = require('../controllers/users.js');
const { getDb } = require('../db/d1');

const adminAuth = async (req, res, next) => {
  try {
    const db = await getDb();
    const user = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.user.id);

    const role = String(user?.role || '').toLowerCase();
    if (!user || !['master', 'mechanic'].includes(role)) {
      return res.status(403).json({ msg: 'Access denied. Master privileges required.' });
    }
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

router.post(
  '/login',
  check('email', 'Некоректний email').optional().isEmail(),
  check('identifier', 'Некоректний ідентифікатор').optional().isString(),
  check('password', 'Пароль повинен містити щонайменше 8 символів').isLength({ min: 8 }),
  (req, res) => {
    const { email, identifier } = req.body || {};
    if (!identifier && email) {
      req.body.identifier = email;
    }
    if (!req.body?.identifier) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_CREDENTIALS',
        message: 'Необхідно вказати email або identifier',
      });
    }
    return authController.login(req, res);
  }
);

router.get('/me', auth, authController.getCurrentUser);

router.get('/', auth, adminAuth, controllers.listUsers);

router.get('/:id/settings', auth, controllers.getUserSettings);
router.put('/:id/settings', auth, controllers.updateUserSettings);

router.get('/:id', auth, controllers.getUserById);

router.put(
  '/:id',
  auth,
  adminAuth,
  check('name', 'Name is required').optional(),
  check('email', 'Please include a valid email').optional().isEmail(),
  check('phone', 'Phone number is required').optional(),
  check('role', 'Некоректна роль')
    .optional()
    .isIn(['client', 'master', 'mechanic']),
  controllers.updateUserById
);

router.delete('/:id', auth, adminAuth, controllers.deleteUserById);

router.post(
  '/register',
  check('email', 'Некоректний email').optional().isEmail(),
  check('password', 'Пароль повинен містити щонайменше 8 символів').isLength({ min: 8 }),
  (req, res) => authController.register(req, res)
);

router.put(
  '/profile',
  auth,
  check('name', 'Імʼя обовʼязкове').not().isEmpty(),
  check('phone', 'Телефон обовʼязковий').not().isEmpty(),
  controllers.updateUserProfile
);

module.exports = router;
