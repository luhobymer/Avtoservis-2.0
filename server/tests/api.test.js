const request = require('supertest');
const app = require('../index');
const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

describe('API Tests', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    try {
      // Хешуємо пароль
      const hashedPassword = await bcrypt.hash('password123', 10);

      // Створюємо тестового користувача
      const { data: user, error } = await supabase
        .from('users')
        .insert([
          {
            email: 'test@example.com',
            password: hashedPassword,
            role: 'client',
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating test user:', error);
        throw error;
      }

      if (!user) {
        throw new Error('Failed to create test user');
      }

      userId = user.id;
      authToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Видаляємо тестового користувача
      if (userId) {
        await supabase.from('users').delete().eq('id', userId);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Auth Routes', () => {
    test('POST /api/auth/login - успішний вхід', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
    });

    test('GET /api/auth/me - отримання даних користувача', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', 'test@example.com');
    });
  });

  describe('Service Station Routes', () => {
    test('GET /api/stations - отримання списку СТО', async () => {
      const res = await request(app).get('/api/stations');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Services Routes', () => {
    test('GET /api/services - отримання списку послуг', async () => {
      const res = await request(app).get('/api/services');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Appointments Routes', () => {
    let appointmentId;

    test('POST /api/appointments - створення запису', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_id: 'test-service-id',
          scheduled_time: '2025-05-01T10:00:00Z',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      appointmentId = res.body.id;
    });

    test('GET /api/appointments - отримання списку записів', async () => {
      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('PUT /api/appointments/:id - оновлення запису', async () => {
      const res = await request(app)
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'confirmed',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'confirmed');
    });
  });

  describe('Vehicles Routes', () => {
    let vehicleId;

    test('POST /api/vehicles - додавання автомобіля', async () => {
      const res = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          vin: 'TEST1234567890',
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      vehicleId = res.body.id;
    });

    test('GET /api/vehicles - отримання списку автомобілів', async () => {
      const res = await request(app)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('PUT /api/vehicles/:id - оновлення автомобіля', async () => {
      const res = await request(app)
        .put(`/api/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mileage: 50000,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('mileage', 50000);
    });
  });
});
