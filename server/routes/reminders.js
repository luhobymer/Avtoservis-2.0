const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getDb } = require('../db/d1');

const normalizeBoolean = (value) => (value ? 1 : 0);

const mapReminderRow = (row) => ({
  ...row,
  reminder_date: row.due_date,
  mileage_threshold: row.due_mileage,
  recurring_interval: row.recurrence_interval,
  is_completed: !!row.is_completed,
  is_recurring: !!row.is_recurring,
});

// @route   GET api/reminders
// @desc    Отримання нагадувань користувача
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const db = await getDb();
    const reminders = await db
      .prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY due_date ASC')
      .all(userId);

    res.json((reminders || []).map(mapReminderRow));
  } catch (error) {
    console.error('Помилка отримання нагадувань:', error);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// @route   POST api/reminders
// @desc    Створення нового нагадування
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      reminder_date,
      due_date,
      vehicle_vin,
      reminder_type,
      due_mileage,
      mileage_threshold,
      is_completed,
      is_recurring,
      recurrence_interval,
      recurring_interval,
      priority,
    } = req.body;

    const reminderId = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = await getDb();
    await db
      .prepare(
        `INSERT INTO reminders
        (id, user_id, vehicle_vin, title, description, reminder_type, due_date, due_mileage,
        is_completed, is_recurring, recurrence_interval, priority, notification_sent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        reminderId,
        userId,
        vehicle_vin || null,
        title,
        description || null,
        reminder_type || 'custom',
        reminder_date || due_date || null,
        due_mileage ?? mileage_threshold ?? null,
        normalizeBoolean(is_completed),
        normalizeBoolean(is_recurring),
        recurrence_interval || recurring_interval || null,
        priority || 'medium',
        0,
        now,
        now
      );

    const reminder = await db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId);
    res.status(201).json(mapReminderRow(reminder));
  } catch (error) {
    console.error('Помилка створення нагадування:', error);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// @route   PUT api/reminders/:id
// @desc    Оновлення нагадування
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const reminderId = req.params.id;
    const {
      title,
      description,
      reminder_date,
      due_date,
      vehicle_vin,
      reminder_type,
      due_mileage,
      mileage_threshold,
      is_completed,
      is_recurring,
      recurrence_interval,
      recurring_interval,
      priority,
    } = req.body;

    const now = new Date().toISOString();
    const db = await getDb();
    const result = await db
      .prepare(
        `UPDATE reminders
         SET title = ?, description = ?, reminder_type = ?, due_date = ?, due_mileage = ?,
             is_completed = ?, is_recurring = ?, recurrence_interval = ?, priority = ?,
             vehicle_vin = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        title,
        description || null,
        reminder_type || 'custom',
        reminder_date || due_date || null,
        due_mileage ?? mileage_threshold ?? null,
        normalizeBoolean(is_completed),
        normalizeBoolean(is_recurring),
        recurrence_interval || recurring_interval || null,
        priority || 'medium',
        vehicle_vin || null,
        now,
        reminderId,
        userId
      );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Нагадування не знайдено' });
    }

    const reminder = await db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId);
    res.json(mapReminderRow(reminder));
  } catch (error) {
    console.error('Помилка оновлення нагадування:', error);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// @route   DELETE api/reminders/:id
// @desc    Видалення нагадування
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const reminderId = req.params.id;

    const db = await getDb();
    await db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(reminderId, userId);
    res.json({ message: 'Нагадування видалено' });
  } catch (error) {
    console.error('Помилка видалення нагадування:', error);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

module.exports = router;
