const { getDb } = require('../db/d1');

const toInt = (value, fallback) => {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
};

const parseInsertId = (meta) => {
  if (!meta) return null;
  if (meta.last_row_id != null) return meta.last_row_id;
  if (meta.lastInsertRowid != null) return meta.lastInsertRowid;
  if (meta.lastInsertRowID != null) return meta.lastInsertRowID;
  return null;
};

exports.listParts = async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit, 100), 1), 1000);
    const offset = Math.max(toInt(req.query.offset, 0), 0);
    const db = await getDb();

    const rows = await db
      .prepare('SELECT * FROM parts ORDER BY id DESC LIMIT ? OFFSET ?')
      .all(limit, offset);

    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.getPartById = async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    if (!id) return res.status(400).json({ message: 'Некоректний id' });

    const db = await getDb();
    const part = await db.prepare('SELECT * FROM parts WHERE id = ?').get(id);
    if (!part) return res.status(404).json({ message: 'Запчастину не знайдено' });
    res.json(part);
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.createPart = async (req, res) => {
  try {
    const { name, article, manufacturer, price, warranty_period, description, part_number } =
      req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: "Поле 'name' є обов'язковим" });
    }

    const db = await getDb();
    const meta = await db
      .prepare(
        'INSERT INTO parts (name, article, manufacturer, price, warranty_period, description, part_number) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        name.trim(),
        article || null,
        manufacturer || null,
        price != null && price !== '' ? Number(price) : null,
        warranty_period != null && warranty_period !== '' ? Number(warranty_period) : null,
        description || null,
        part_number || null
      );

    const insertedId = parseInsertId(meta);
    if (insertedId == null) {
      return res.status(201).json({ ok: true });
    }

    const created = await db.prepare('SELECT * FROM parts WHERE id = ?').get(insertedId);
    res.status(201).json(created || { id: insertedId });
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.updatePart = async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    if (!id) return res.status(400).json({ message: 'Некоректний id' });

    const { name, article, manufacturer, price, warranty_period, description, part_number } =
      req.body || {};

    const db = await getDb();
    const existing = await db.prepare('SELECT * FROM parts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ message: 'Запчастину не знайдено' });

    const next = {
      name: name != null ? String(name) : existing.name,
      article: article !== undefined ? article : existing.article,
      manufacturer: manufacturer !== undefined ? manufacturer : existing.manufacturer,
      price: price !== undefined ? (price === '' ? null : Number(price)) : existing.price,
      warranty_period:
        warranty_period !== undefined
          ? warranty_period === ''
            ? null
            : Number(warranty_period)
          : existing.warranty_period,
      description: description !== undefined ? description : existing.description,
      part_number: part_number !== undefined ? part_number : existing.part_number,
    };

    if (!next.name || !String(next.name).trim()) {
      return res.status(400).json({ message: "Поле 'name' є обов'язковим" });
    }

    await db
      .prepare(
        'UPDATE parts SET name = ?, article = ?, manufacturer = ?, price = ?, warranty_period = ?, description = ?, part_number = ? WHERE id = ?'
      )
      .run(
        String(next.name).trim(),
        next.article || null,
        next.manufacturer || null,
        Number.isFinite(next.price) ? next.price : null,
        Number.isFinite(next.warranty_period) ? next.warranty_period : null,
        next.description || null,
        next.part_number || null,
        id
      );

    const updated = await db.prepare('SELECT * FROM parts WHERE id = ?').get(id);
    res.json(updated || { id });
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.deletePart = async (req, res) => {
  try {
    const id = toInt(req.params.id, null);
    if (!id) return res.status(400).json({ message: 'Некоректний id' });
    const db = await getDb();
    await db.prepare('DELETE FROM parts WHERE id = ?').run(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

