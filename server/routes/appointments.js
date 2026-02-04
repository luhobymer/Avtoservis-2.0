const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth.js');
const appointmentController = require('../controllers/appointmentController.js');
const { getDb } = require('../db/d1');
const { checkAdmin } = require('../middleware/checkRole');

router.post(
  '/',
  auth,
  [
    body('service_id')
      .custom((value, { req }) => {
        const list = req.body.service_ids || req.body.serviceIds;
        if (Array.isArray(list) && list.length > 0) {
          return true;
        }
        if (value == null || String(value).trim() === '') {
          throw new Error("ID послуги обов'язковий");
        }
        return true;
      })
      .optional({ nullable: true }),
    body('mechanic_id')
      .custom((value, { req }) => {
        const role = String(req.user?.role || '').toLowerCase();
        if (['mechanic', 'master', 'admin'].includes(role)) {
          return true;
        }
        if (value == null || String(value).trim() === '') {
          throw new Error("ID механіка обов'язковий");
        }
        return true;
      })
      .optional({ nullable: true }),
    body('scheduled_time').isISO8601().withMessage('Невірний формат дати'),
  ],
  appointmentController.createAppointment
);

router.get('/', auth, async (req, res) => {
  try {
    const isMaster = req.user && req.user.role === 'master';
    const isAdminView = isMaster && String(req.query.admin || '') === '1';

    if (isAdminView) {
      return appointmentController.getAllAppointments(req, res);
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    return appointmentController.getUserAppointments(req, res);
  } catch (error) {
    console.error('[appointments][GET] Помилка:', error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

router.get('/:id', auth, appointmentController.getAppointmentById);

router.put('/:id', auth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const existingAppointment = await db
      .prepare('SELECT * FROM appointments WHERE id = ?')
      .get(req.params.id);

    if (!existingAppointment) {
      return res.status(404).json({
        msg: 'Запис не знайдено',
        requestedId: req.params.id,
      });
    }

    const isMaster = req.user.role === 'master';
    const isOwner = existingAppointment.user_id === req.user.id;

    if (!isMaster && !isOwner) {
      return res.status(403).json({
        msg: 'У вас немає прав для оновлення цього запису',
      });
    }

    const scheduledTime = req.body.scheduledTime ?? req.body.scheduled_time ?? null;
    const status = req.body.status ?? null;
    const serviceId = req.body.service_id ?? req.body.serviceId ?? null;
    const serviceIds = req.body.service_ids ?? req.body.serviceIds ?? null;
    const mechanicId = req.body.mechanic_id ?? req.body.mechanicId ?? null;
    const appointmentPrice = req.body.appointment_price ?? req.body.appointmentPrice ?? null;
    const appointmentDuration = req.body.appointment_duration ?? req.body.appointmentDuration ?? null;
    const vehicleVin = req.body.vehicle_vin ?? null;
    const notes = req.body.notes ?? null;
    const appointmentDate = req.body.appointment_date ?? null;
    const serviceType = req.body.service_type ?? null;

    const updateScheduledTime =
      scheduledTime !== null ? scheduledTime : existingAppointment.scheduled_time;
    const updateStatus = status !== null ? status : existingAppointment.status;
    const updateServiceId = serviceId !== null ? serviceId : existingAppointment.service_id;
    const normalizedServiceIds = Array.isArray(serviceIds)
      ? serviceIds.map((id) => (id == null ? '' : String(id).trim())).filter(Boolean)
      : [];
    const updateServiceIds =
      normalizedServiceIds.length > 0
        ? JSON.stringify(Array.from(new Set(normalizedServiceIds)))
        : (existingAppointment.service_ids ?? null);
    const updateMechanicId = mechanicId !== null ? mechanicId : existingAppointment.mechanic_id;
    const updateVehicleVin = vehicleVin !== null ? vehicleVin : existingAppointment.vehicle_vin;
    const updateNotes = notes !== null ? notes : existingAppointment.notes;
    const updateAppointmentDate =
      appointmentDate !== null ? appointmentDate : existingAppointment.appointment_date;
    const updateServiceType = serviceType !== null ? serviceType : existingAppointment.service_type;

    const appointmentColumns = await db.prepare('PRAGMA table_info(appointments)').all();
    const appointmentColumnNames = new Set((appointmentColumns || []).map((col) => col.name));
    const hasAppointmentPrice = appointmentColumnNames.has('appointment_price');
    const hasAppointmentDuration = appointmentColumnNames.has('appointment_duration');

    const updateAppointmentPrice =
      appointmentPrice !== null
        ? appointmentPrice === ''
          ? null
          : Number(appointmentPrice)
        : (existingAppointment.appointment_price ?? null);
    const updateAppointmentDuration =
      appointmentDuration !== null
        ? appointmentDuration === ''
          ? null
          : Number(appointmentDuration)
        : (existingAppointment.appointment_duration ?? null);

    const mechanicServicesTable = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mechanic_services'")
      .get();
    if (mechanicServicesTable && updateMechanicId) {
      const idsToCheck = [];
      if (updateServiceId) {
        idsToCheck.push(String(updateServiceId));
      }
      if (normalizedServiceIds.length > 0) {
        idsToCheck.push(...normalizedServiceIds);
      }
      const unique = Array.from(new Set(idsToCheck.filter(Boolean)));
      for (const sid of unique) {
        const row = await db
          .prepare(
            'SELECT ms.is_enabled, s.is_active FROM mechanic_services ms LEFT JOIN services s ON s.id = ms.service_id WHERE ms.mechanic_id = ? AND ms.service_id = ?'
          )
          .get(updateMechanicId, sid);
        const isEnabled = row && Number(row.is_enabled || 0) === 1;
        const isActive = row ? Number(row.is_active ?? 1) === 1 : false;
        if (!isEnabled || !isActive) {
          return res
            .status(400)
            .json({ message: 'Послуга недоступна для вибраного механіка' });
        }
      }
    }

    const updates = [
      'scheduled_time = ?',
      'status = ?',
      'service_id = ?',
      'service_ids = ?',
      'mechanic_id = ?',
      'vehicle_vin = ?',
      'notes = ?',
      'appointment_date = ?',
      'service_type = ?',
    ];
    const params = [
      updateScheduledTime,
      updateStatus,
      updateServiceId,
      updateServiceIds,
      updateMechanicId,
      updateVehicleVin,
      updateNotes,
      updateAppointmentDate,
      updateServiceType,
    ];
    if (hasAppointmentPrice) {
      updates.push('appointment_price = ?');
      params.push(Number.isFinite(updateAppointmentPrice) ? updateAppointmentPrice : null);
    }
    if (hasAppointmentDuration) {
      updates.push('appointment_duration = ?');
      params.push(Number.isFinite(updateAppointmentDuration) ? updateAppointmentDuration : null);
    }
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);

    await db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('[appointments][PUT] Помилка:', error);
    res.status(500).json({
      error: 'Помилка сервера при оновленні запису',
      details: error.message,
      requestedId: req.params.id,
    });
  }
});

router.put('/:id/status', auth, checkAdmin, appointmentController.updateAppointmentStatus);

router.delete('/:id', auth, async (req, res) => {
  try {
    const db = await getDb();
    const isMaster = req.user && req.user.role === 'master';

    if (isMaster) {
      await db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
    } else {
      await db
        .prepare('DELETE FROM appointments WHERE id = ? AND user_id = ?')
        .run(req.params.id, req.user.id);
    }
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
