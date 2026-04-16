const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getDb } = require('../db/d1');
const { resolveCurrentMechanic } = require('../utils/resolveCurrentMechanic');

// Отримати статус зайнятості механіка
router.get('/busy-status', auth, async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const canViewOtherMechanic = ['admin', 'master'].includes(role);
    const requestedMechanicId = req.query.mechanic_id ? String(req.query.mechanic_id) : '';

    const db = await getDb();

    const mechanic = await resolveCurrentMechanic(req.user, {
      createIfMissing: true,
      enableAllServices: true,
    });
    const currentMechanicId = mechanic?.id ? String(mechanic.id) : '';
    const effectiveMechanicId =
      requestedMechanicId && canViewOtherMechanic ? requestedMechanicId : currentMechanicId;

    if (!effectiveMechanicId) {
      return res.json({ busy_until: null, busy_reason: null });
    }
    const row = await db
      .prepare(
        `SELECT busy_until, busy_reason FROM mechanics WHERE id = ?`
      )
      .get(effectiveMechanicId);

    if (!row) {
      return res.json({ busy_until: null, busy_reason: null });
    }

    res.json({
      busy_until: row.busy_until,
      busy_reason: row.busy_reason
    });
  } catch (err) {
    console.error('[schedule][busy-status] Error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Встановити статус зайнятості механіка
router.post('/busy-status', auth, async (req, res) => {
  try {
    const { mechanic_id, busy_until, busy_reason } = req.body;
    const role = String(req.user?.role || '').toLowerCase();
    const canSetOtherMechanic = ['admin', 'master'].includes(role);

    const db = await getDb();

    const mechanic = await resolveCurrentMechanic(req.user, {
      createIfMissing: true,
      enableAllServices: true,
    });
    const currentMechanicId = mechanic?.id ? String(mechanic.id) : '';
    const requestedMechanicId = mechanic_id ? String(mechanic_id) : '';
    const effectiveMechanicId =
      requestedMechanicId && canSetOtherMechanic ? requestedMechanicId : currentMechanicId;

    if (!effectiveMechanicId) {
      return res.status(400).json({ message: 'mechanic_id is required' });
    }
    await db
      .prepare(
        `UPDATE mechanics SET busy_until = ?, busy_reason = ? WHERE id = ?`
      )
      .run(busy_until || null, busy_reason || null, effectiveMechanicId);

    res.json({ success: true });
  } catch (err) {
    console.error('[schedule][busy-status] POST Error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

module.exports = router;
