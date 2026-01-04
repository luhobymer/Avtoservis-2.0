/**
 * Admin routes
 */

const express = require('express');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth.js');
const supabase = require('../config/supabase.js');
const User = require('../models/User.js');
const Vehicle = require('../models/Vehicle.js');
const Appointment = require('../models/Appointment.js');
const ServiceRecord = require('../models/ServiceRecord.js');

const router = express.Router();

// Middleware to check if user is admin
const adminAuth = async (req, res, next) => {
  try {
    // u0412u0438u043au043eu0440u0438u0441u0442u043eu0432u0443u0454u043cu043e u043cu0435u0442u043eu0434 findOne u0437u0430u043cu0456u0441u0442u044c findByPk u0434u043bu044f Supabase
    const { data: user, error } = await User.findOne({ id: req.user.id });

    if (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({ msg: 'Server error', details: error.message });
    }

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
    }
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @route   GET api/admin/users
// @desc    Get all users
// @access  Admin
router.get('/users', [auth, adminAuth], async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
    });
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/admin/users/:id
// @desc    Get user by ID
// @access  Admin
router.get('/users/:id', [auth, adminAuth], async (req, res) => {
  try {
    const { data: user, error } = await User.findOne({ id: req.params.id });
    if (error || !user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/admin/users
// @desc    Create a new user
// @access  Admin
router.post(
  '/users',
  [
    auth,
    adminAuth,
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    check('phone', 'Phone number is required').not().isEmpty(),
    check('role', 'Role is required').isIn(['client', 'admin']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone, role } = req.body;

    try {
      // Check if user exists
      let user = await User.findOne({ where: { email } });

      if (user) {
        return res.status(400).json({ msg: 'User already exists' });
      }

      // Create new user
      user = await User.create({
        name,
        email,
        password,
        phone,
        role,
      });

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   PUT api/admin/users/:id
// @desc    Update a user
// @access  Admin
router.put(
  '/users/:id',
  [
    auth,
    adminAuth,
    check('name', 'Name is required').optional(),
    check('email', 'Please include a valid email').optional().isEmail(),
    check('phone', 'Phone number is required').optional(),
    check('role', 'Role must be client or admin').optional().isIn(['client', 'admin']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, role, password } = req.body;

    try {
      const { data: user, error: findError } = await User.findOne({ id: req.params.id });

      if (findError || !user) {
        return res.status(404).json({ msg: 'User not found' });
      }

      // Prepare update data
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (role) updateData.role = role;
      if (password) updateData.password_hash = await bcrypt.hash(password, 10);

      // Update user in Supabase
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', req.params.id)
        .select('id, email, name, phone, role, created_at')
        .single();

      if (updateError) {
        return res.status(500).json({ msg: 'Error updating user', details: updateError.message });
      }

      res.json(updatedUser);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   DELETE api/admin/users/:id
// @desc    Delete a user
// @access  Admin
router.delete('/users/:id', [auth, adminAuth], async (req, res) => {
  try {
    const { data: user, error } = await User.findOne({ id: req.params.id });
    if (error || !user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({ msg: 'Cannot delete your own account' });
    }

    // Delete user from Supabase
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) {
      return res.status(500).json({ msg: 'Error deleting user', details: deleteError.message });
    }

    res.json({ msg: 'User removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/admin/stats
// @desc    Get system statistics
// @access  Admin
router.get('/stats', [auth, adminAuth], async (req, res) => {
  try {
    const userCount = await User.count();
    const vehicleCount = await Vehicle.count();
    const appointmentCount = await Appointment.count();
    const serviceRecordCount = await ServiceRecord.count();

    // Get counts by status
    const appointmentsByStatusRaw = await Appointment.count({
      group: ['status'],
    });

    // Convert to a more usable format
    const appointmentsByStatus = {};
    appointmentsByStatusRaw.forEach((item) => {
      appointmentsByStatus[item.status] = item.count;
    });

    // Get recent appointments
    const recentAppointments = await Appointment.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'serviceType', 'status', 'scheduledDate'],
    });

    // Get recent service records
    const recentServiceRecords = await ServiceRecord.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'serviceType', 'mileage', 'serviceDate'],
    });

    res.json({
      userCount,
      vehicleCount,
      appointmentCount,
      serviceRecordCount,
      appointmentsByStatus,
      recentAppointments,
      recentServiceRecords,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/admin/vehicles
// @desc    Get all vehicles
// @access  Admin
router.get('/vehicles', [auth, adminAuth], async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({
      include: [{ model: User, attributes: ['name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(vehicles);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/admin/appointments
// @desc    Get all appointments
// @access  Admin
router.get('/appointments', [auth, adminAuth], async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      include: [
        { model: Vehicle, attributes: ['make', 'model', 'licensePlate'] },
        { model: User, attributes: ['name', 'email'] },
      ],
      order: [['scheduledDate', 'DESC']],
    });
    res.json(appointments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/admin/service-records
// @desc    Get all service records
// @access  Admin
router.get('/service-records', [auth, adminAuth], async (req, res) => {
  try {
    const serviceRecords = await ServiceRecord.findAll({
      include: [{ model: Vehicle, attributes: ['make', 'model', 'licensePlate'] }],
      order: [['serviceDate', 'DESC']],
    });
    res.json(serviceRecords);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
