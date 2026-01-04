const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase.js');

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('client', 'mechanic', 'admin').default('client'),
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
  constructor({ email, password_hash, role, name, phone }) {
    this.email = email;
    this.password_hash = password_hash;
    this.role = role;
    this.name = name;
    this.phone = phone;
  }

  validate() {
    const { error } = userSchema.validate(this);
    return error;
  }

  static async findOne(query) {
    return await supabase
      .from('users')
      .select()
      .eq(Object.keys(query)[0], Object.values(query)[0])
      .single();
  }

  static async create(userData) {
    const { value: validatedData, error } = userSchema.validate(userData);
    if (error) throw new Error(error.details[0].message);

    const { data, error: supabaseError } = await supabase
      .from('users')
      .insert({
        ...validatedData,
        password_hash: await bcrypt.hash(userData.password, 10),
        phone: (() => {
          const rawPhone = validatedData.phone;
          const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');

          // Конвертація номера в єдиний формат
          const formattedPhone = cleanPhone.startsWith('0')
            ? '+380' + cleanPhone.slice(1)
            : cleanPhone;

          // Перевірка фінального формату
          if (!/^\+380\d{9}$/.test(formattedPhone)) {
            throw new Error(
              'Невірний формат телефону. Використовуйте формат +380XXXXXXXXX. Приклад: +380991234567'
            );
          }

          return formattedPhone;
        })(),
        created_at: new Date().toISOString(),
      })
      .single();

    if (supabaseError) throw new Error(supabaseError.message);
    return new User(data);
  }
}

// Видалено виклик User.init(), оскільки ми використовуємо Supabase, а не Sequelize

module.exports = User;
