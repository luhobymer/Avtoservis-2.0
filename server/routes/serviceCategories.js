const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { getDb } = require('../db/d1');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .prepare(
        'SELECT id, name, description, created_at, updated_at FROM service_categories ORDER BY name'
      )
      .all();
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    return res.status(500).json({ message: 'Помилка сервера', details: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (!['master', 'mechanic'].includes(role)) {
      return res.status(403).json({ message: 'Ця дія доступна тільки для майстрів-механіків' });
    }

    const name = req.body?.name ? String(req.body.name).trim() : '';
    const description = req.body?.description ? String(req.body.description).trim() : null;
    if (!name) {
      return res.status(400).json({ message: "Поле 'name' обов'язкове" });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO service_categories (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, name, description, now, now);

    const created = await db.prepare('SELECT * FROM service_categories WHERE id = ?').get(id);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ message: 'Помилка сервера', details: err.message });
  }
});

module.exports = router;
