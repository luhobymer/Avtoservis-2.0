/**
 * Admin routes
 */

const express = require('express');
const crypto = require('crypto');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth.js');
const { getDb } = require('../db/d1');

const router = express.Router();

// Middleware to check if user is master-mechanic (єдиний тип адміністратора)
const adminAuth = async (req, res, next) => {
  try {
    const db = await getDb();
    const user = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.user.id);

    if (!user || user.role !== 'master') {
      return res.status(403).json({ msg: 'Access denied. Master privileges required.' });
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
    const db = await getDb();
    const users = await db
      .prepare(
        'SELECT id, email, name, phone, role, created_at, updated_at FROM users ORDER BY created_at DESC'
      )
      .all();
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
    const db = await getDb();
    const user = await db
      .prepare(
        'SELECT id, email, name, phone, role, created_at, updated_at FROM users WHERE id = ?'
      )
      .get(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
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
    check('role', 'Role is required').isIn(['client', 'master']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone, role } = req.body;

    try {
      // Check if user exists
      const db = await getDb();
      const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);

      if (existingUser) {
        return res.status(400).json({ msg: 'User already exists' });
      }

      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      const hashedPassword = await bcrypt.hash(password, 10);
      await db
        .prepare(
          `INSERT INTO users (id, name, email, password, phone, role, email_verified, email_verified_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(userId, name, email, hashedPassword, phone, role, 1, now, now, now);

      const user = await db
        .prepare(
          'SELECT id, name, email, phone, role, created_at, updated_at FROM users WHERE id = ?'
        )
        .get(userId);

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
    check('role', 'Role must be client or master').optional().isIn(['client', 'master']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, role, password } = req.body;

    try {
      const db = await getDb();
      const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);

      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }

      // Prepare update data
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (role) updateData.role = role;
      if (password) updateData.password = await bcrypt.hash(password, 10);

      const fields = Object.keys(updateData);
      if (fields.length > 0) {
        const setClause = fields.map((field) => `${field} = ?`).join(', ');
        const values = fields.map((field) => updateData[field]);
        await db
          .prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`)
          .run(...values, new Date().toISOString(), req.params.id);
      }

      const updatedUser = await db
        .prepare(
          'SELECT id, email, name, phone, role, created_at, updated_at FROM users WHERE id = ?'
        )
        .get(req.params.id);

      if (!updatedUser) {
        return res.status(404).json({ msg: 'User not found' });
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
    const db = await getDb();
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({ msg: 'Cannot delete your own account' });
    }

    await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

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
    const db = await getDb();
    const userCount = (await db.prepare('SELECT COUNT(*) as count FROM users').get()).count;
    const vehicleCount = (await db.prepare('SELECT COUNT(*) as count FROM vehicles').get()).count;
    const appointmentCount = (await db.prepare('SELECT COUNT(*) as count FROM appointments').get())
      .count;
    const serviceRecordCount = (
      await db.prepare('SELECT COUNT(*) as count FROM service_records').get()
    ).count;

    const appointmentsByStatusRaw = await db
      .prepare('SELECT status, COUNT(*) as count FROM appointments GROUP BY status')
      .all();

    const appointmentsByStatus = {};
    appointmentsByStatusRaw.forEach((item) => {
      appointmentsByStatus[item.status] = item.count;
    });

    const recentAppointments = (
      await db
        .prepare(
          'SELECT id, service_type, status, scheduled_time, appointment_date, created_at FROM appointments ORDER BY created_at DESC LIMIT 5'
        )
        .all()
    ).map((row) => ({
      id: row.id,
      serviceType: row.service_type ?? row.serviceType ?? null,
      status: row.status,
      scheduledDate: row.scheduled_time ?? row.appointment_date ?? null,
    }));

    const recentServiceRecords = (
      await db
        .prepare(
          'SELECT id, service_type, service_date, mileage, description, created_at FROM service_records ORDER BY service_date DESC LIMIT 5'
        )
        .all()
    ).map((row) => ({
      id: row.id,
      serviceType: row.service_type ?? row.description ?? null,
      mileage: row.mileage,
      serviceDate: row.service_date,
    }));

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
    const db = await getDb();
    const vehicles = (
      await db
        .prepare(
          `SELECT v.*, u.name as user_name, u.email as user_email
         FROM vehicles v
         LEFT JOIN users u ON u.id = v.user_id
         ORDER BY v.created_at DESC`
        )
        .all()
    ).map((vehicle) => ({
      ...vehicle,
      users:
        vehicle.user_name || vehicle.user_email
          ? { name: vehicle.user_name, email: vehicle.user_email }
          : null,
    }));
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
    const db = await getDb();
    const appointments = (
      await db
        .prepare(
          `SELECT a.*, v.make as vehicle_make, v.model as vehicle_model, v.license_plate as vehicle_license_plate,
                u.name as user_name, u.email as user_email
         FROM appointments a
         LEFT JOIN vehicles v ON v.vin = a.vehicle_vin
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.scheduled_time DESC`
        )
        .all()
    ).map((appointment) => ({
      ...appointment,
      vehicles:
        appointment.vehicle_make || appointment.vehicle_model || appointment.vehicle_license_plate
          ? {
              make: appointment.vehicle_make,
              model: appointment.vehicle_model,
              licensePlate: appointment.vehicle_license_plate,
            }
          : null,
      users:
        appointment.user_name || appointment.user_email
          ? { name: appointment.user_name, email: appointment.user_email }
          : null,
    }));
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
    const db = await getDb();
    const serviceRecords = (
      await db
        .prepare(
          `SELECT sr.*, v.make as vehicle_make, v.model as vehicle_model, v.license_plate as vehicle_license_plate
         FROM service_records sr
         LEFT JOIN vehicles v ON v.id = sr.vehicle_id
         ORDER BY sr.service_date DESC`
        )
        .all()
    ).map((record) => ({
      ...record,
      vehicles:
        record.vehicle_make || record.vehicle_model || record.vehicle_license_plate
          ? {
              make: record.vehicle_make,
              model: record.vehicle_model,
              licensePlate: record.vehicle_license_plate,
            }
          : null,
    }));
    res.json(serviceRecords);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
