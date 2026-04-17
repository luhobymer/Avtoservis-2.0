const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getDb } = require('../db/d1');
const { resolveCurrentMechanic } = require('../utils/resolveCurrentMechanic');

async function getMechanicsBusyColumns(db) {
  try {
    const columns = await db.prepare('PRAGMA table_info(mechanics)').all();
    const names = new Set((columns || []).map((c) => c.name));
    return {
      hasBusyUntil: names.has('busy_until'),
      hasBusyReason: names.has('busy_reason'),
    };
  } catch (_) {
    return {
      hasBusyUntil: false,
      hasBusyReason: false,
    };
  }
}

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

    const busyColumns = await getMechanicsBusyColumns(db);
    if (!busyColumns.hasBusyUntil && !busyColumns.hasBusyReason) {
      return res.json({ busy_until: null, busy_reason: null });
    }

    const selectParts = [];
    if (busyColumns.hasBusyUntil) selectParts.push('busy_until');
    if (busyColumns.hasBusyReason) selectParts.push('busy_reason');
    const selectClause = selectParts.join(', ');

    const row = await db
      .prepare(
        `SELECT ${selectClause} FROM mechanics WHERE id = ?`
      )
      .get(effectiveMechanicId);

    if (!row) {
      return res.json({ busy_until: null, busy_reason: null });
    }

    res.json({
      busy_until: busyColumns.hasBusyUntil ? row.busy_until ?? null : null,
      busy_reason: busyColumns.hasBusyReason ? row.busy_reason ?? null : null
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

    const busyColumns = await getMechanicsBusyColumns(db);
    const setParts = [];
    const values = [];
    if (busyColumns.hasBusyUntil) {
      setParts.push('busy_until = ?');
      values.push(busy_until || null);
    }
    if (busyColumns.hasBusyReason) {
      setParts.push('busy_reason = ?');
      values.push(busy_reason || null);
    }

    if (setParts.length === 0) {
      return res.json({ success: true });
    }

    await db
      .prepare(
        `UPDATE mechanics SET ${setParts.join(', ')} WHERE id = ?`
      )
      .run(...values, effectiveMechanicId);

    res.json({ success: true });
  } catch (err) {
    console.error('[schedule][busy-status] POST Error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

module.exports = router;
