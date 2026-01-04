const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { supabase } = require('../config/supabase.js');

// @route   GET api/reminders
// @desc    Отримання нагадувань користувача
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .order('reminder_date', { ascending: true });

    if (error) {
      console.error('Помилка отримання нагадувань:', error);
      return res.status(500).json({ message: 'Помилка сервера' });
    }

    res.json(reminders || []);
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
    const { title, description, reminder_date, vehicle_vin } = req.body;

    const { data: reminder, error } = await supabase
      .from('reminders')
      .insert({
        user_id: userId,
        title,
        description,
        reminder_date,
        vehicle_vin,
      })
      .select()
      .single();

    if (error) {
      console.error('Помилка створення нагадування:', error);
      return res.status(500).json({ message: 'Помилка сервера' });
    }

    res.status(201).json(reminder);
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
    const { title, description, reminder_date, vehicle_vin } = req.body;

    const { data: reminder, error } = await supabase
      .from('reminders')
      .update({
        title,
        description,
        reminder_date,
        vehicle_vin,
      })
      .eq('id', reminderId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Помилка оновлення нагадування:', error);
      return res.status(500).json({ message: 'Помилка сервера' });
    }

    if (!reminder) {
      return res.status(404).json({ message: 'Нагадування не знайдено' });
    }

    res.json(reminder);
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

    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId)
      .eq('user_id', userId);

    if (error) {
      console.error('Помилка видалення нагадування:', error);
      return res.status(500).json({ message: 'Помилка сервера' });
    }

    res.json({ message: 'Нагадування видалено' });
  } catch (error) {
    console.error('Помилка видалення нагадування:', error);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

module.exports = router;
