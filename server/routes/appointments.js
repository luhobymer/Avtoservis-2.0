const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase.js');
const auth = require('../middleware/auth.js');
const appointmentController = require('../controllers/appointmentController.js');

// Створення нового запису
router.post(
  '/',
  auth,
  [
    body('service_id').notEmpty().withMessage("ID послуги обов'язковий"),
    body('mechanic_id').notEmpty().withMessage("ID механіка обов'язковий"),
    body('scheduled_time').isISO8601().withMessage('Невірний формат дати'),
  ],
  appointmentController.createAppointment
);

// Отримання всіх записів користувача
router.get('/', auth, appointmentController.getUserAppointments);

// Отримання запису за ID
router.get('/:id', auth, appointmentController.getAppointmentById);

// Оновлення запису
router.put('/:id', auth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.warn('[appointments][PUT] Неавторизований доступ');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    console.log(
      '[appointments][PUT] Оновлення запису:',
      req.params.id,
      'для користувача:',
      req.user.id
    );
    console.log('[appointments][PUT] Дані для оновлення:', req.body);

    // Спочатку перевіряємо чи існує запис
    const { data: existingAppointment, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (checkError || !existingAppointment) {
      console.warn('[appointments][PUT] Запис не знайдено:', req.params.id);
      return res.status(404).json({
        msg: 'Запис не знайдено',
        requestedId: req.params.id,
      });
    }

    // Оновлюємо запис
    const { data, error } = await supabase
      .from('appointments')
      .update({
        scheduled_time: req.body.scheduledTime,
        status: req.body.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*, vehicles(*)');

    if (error) {
      console.error('[appointments][PUT] Помилка оновлення:', error);
      throw error;
    }

    console.log('[appointments][PUT] Успішно оновлено запис:', data[0]);
    console.log('[DEBUG] Appointment data:', data[0]);
    res.json({
      id: data[0].id,
      scheduledTime: data[0].scheduled_time,
      status: data[0].status,
      vehicle_vin: data[0].vehicle_vin,
    });
  } catch (error) {
    console.error('[appointments][PUT] Помилка:', error);
    res.status(500).json({
      error: 'Помилка сервера при оновленні запису',
      details: error.message,
      requestedId: req.params.id,
    });
  }
});

// Видалення запису
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
