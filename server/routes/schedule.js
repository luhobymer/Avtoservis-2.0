const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

// Отримати статус зайнятості механіка
router.get('/busy-status', auth, async (req, res) => {
  try {
    const mechanicId = req.query.mechanic_id;
    if (!mechanicId) {
      return res.status(400).json({ message: 'mechanic_id parameter is required' });
    }

    const db = await require('../db').getDb();
    const row = await db
      .prepare(
        `SELECT busy_until, busy_reason FROM mechanics WHERE id = ?`
      )
      .get(mechanicId);

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
    if (!mechanic_id) {
      return res.status(400).json({ message: 'mechanic_id is required' });
    }

    const db = await require('../db').getDb();
    await db
      .prepare(
        `UPDATE mechanics SET busy_until = ?, busy_reason = ? WHERE id = ?`
      )
      .run(busy_until || null, busy_reason || null, mechanic_id);

    res.json({ success: true });
  } catch (err) {
    console.error('[schedule][busy-status] POST Error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

module.exports = router;
