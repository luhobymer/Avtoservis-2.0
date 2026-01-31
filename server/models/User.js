const Joi = require('joi');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('../db/d1');

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string()
    .valid('client', 'mechanic', 'admin', 'master', 'master_admin')
    .default('client'),
  name: Joi.string().max(100),
  phone: Joi.string()
    .pattern(/^\+380\d{9}$/)
    .required()
    .messages({
      'string.pattern.base':
        'Невірний формат телефону. Використовуйте формат +380XXXXXXXXX. Приклад: +380991234567',
    }),
  created_at: Joi.date()
    .iso()
    .default(() => new Date()),
});

class User {
  constructor({ email, password, role, name, phone }) {
    this.email = email;
    this.password = password;
    this.role = role;
    this.name = name;
    this.phone = phone;
  }

  validate() {
    const { error } = userSchema.validate(this);
    return error;
  }

  static async findOne(query) {
    const criteria = query?.where || query;
    if (!criteria || Object.keys(criteria).length === 0) {
      return { data: null, error: new Error('Invalid query') };
    }

    const [field, value] = Object.entries(criteria)[0];
    const db = await getDb();
    const row = await db.prepare(`SELECT * FROM users WHERE ${field} = ? LIMIT 1`).get(value);
    return { data: row || null, error: null };
  }

  static async create(userData) {
    const { value: validatedData, error } = userSchema.validate(userData);
    if (error) throw new Error(error.details[0].message);

    const rawPhone = validatedData.phone;
    const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? '+380' + cleanPhone.slice(1) : cleanPhone;

    if (!/^\+380\d{9}$/.test(formattedPhone)) {
      throw new Error(
        'Невірний формат телефону. Використовуйте формат +380XXXXXXXXX. Приклад: +380991234567'
      );
    }

    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO users (id, email, password, role, name, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        validatedData.email || null,
        await bcrypt.hash(userData.password, 10),
        validatedData.role || 'client',
        validatedData.name || null,
        formattedPhone,
        now,
        now
      );

    const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return new User(row);
  }

  static async findAll() {
    const db = await getDb();
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  }

  static async count() {
    const db = await getDb();
    const row = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    return row?.count || 0;
  }
}

module.exports = User;
