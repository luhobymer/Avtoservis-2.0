const crypto = require('crypto');
const { getDb } = require('../db/d1');
const vehicleController = require('../controllers/vehicleController');

describe('VehicleController - D1 інтеграційні тести', () => {
  let req;
  let res;

  const makeRes = () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    response.status.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    req = { params: {}, body: {}, user: { id: null } };
    res = makeRes();
    jest.clearAllMocks();
  });

  describe('getUserVehicles', () => {
    test('повинен повертати автомобілі користувача з історією і записами', async () => {
      const db = getDb();
      const now = new Date().toISOString();
      const userId = crypto.randomUUID();
      const vehicleId = crypto.randomUUID();
      const vin = `VIN-${crypto.randomUUID()}`;
      const serviceId = crypto.randomUUID();
      const appointmentId = crypto.randomUUID();
      const historyId = crypto.randomUUID();

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'user@example.com', 'hashed', 'client', now, now);

      db.prepare(
        'INSERT INTO vehicles (id, user_id, vin, make, model, year, color, license_plate, mileage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(vehicleId, userId, vin, 'BMW', 'X5', 2020, 'Чорний', 'AA1234BB', 50000, now, now);

      db.prepare(
        'INSERT INTO services (id, name, description, price, duration, service_station_id, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(serviceId, 'Oil Change', 'Desc', 500, 60, null, null, now, now);

      db.prepare(
        'INSERT INTO appointments (id, user_id, vehicle_id, vehicle_vin, service_id, mechanic_id, scheduled_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(appointmentId, userId, vehicleId, vin, serviceId, null, now, 'confirmed', now, now);

      db.prepare(
        'INSERT INTO service_history (id, user_id, vehicle_id, vehicle_vin, service_type, mileage, service_date, description, cost, mechanic_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        historyId,
        userId,
        vehicleId,
        vin,
        'Заміна масла',
        50000,
        now,
        'Виконано',
        500,
        null,
        now,
        now
      );

      req.user.id = userId;

      await vehicleController.getUserVehicles(req, res);

      const payload = res.json.mock.calls[0][0];
      expect(Array.isArray(payload)).toBe(true);
      const vehicle = payload.find((item) => item.id === vehicleId);
      expect(vehicle).toBeTruthy();
      expect(vehicle).toEqual(
        expect.objectContaining({
          id: vehicleId,
          vin,
          user_id: userId,
          make: 'BMW',
          model: 'X5',
        })
      );
      expect(vehicle.licensePlate).toBe('AA1234BB');
      expect(vehicle.appointments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: appointmentId,
            service_id: serviceId,
          }),
        ])
      );
      expect(vehicle.service_history.length).toBeGreaterThan(0);
    });

    test('повинен повертати порожній масив якщо у користувача немає автомобілів', async () => {
      const userId = crypto.randomUUID();
      req.user.id = userId;

      await vehicleController.getUserVehicles(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    test('повинен повертати помилку якщо не вказано користувача', async () => {
      req.user = null;

      await vehicleController.getUserVehicles(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Не вказано користувача' });
    });
  });

  describe('getVehicleByVin', () => {
    test('повинен успішно отримувати автомобіль за VIN з деталями', async () => {
      const db = getDb();
      const now = new Date().toISOString();
      const userId = crypto.randomUUID();
      const vehicleId = crypto.randomUUID();
      const vin = `VIN-${crypto.randomUUID()}`;
      const serviceId = crypto.randomUUID();
      const mechanicId = crypto.randomUUID();

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'user@example.com', 'hashed', 'client', now, now);

      db.prepare(
        'INSERT INTO vehicles (id, user_id, vin, make, model, year, color, license_plate, mileage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(vehicleId, userId, vin, 'BMW', 'X5', 2020, 'Чорний', 'AA1234BB', 50000, now, now);

      db.prepare(
        'INSERT INTO services (id, name, description, price, duration, service_station_id, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(serviceId, 'Oil Change', 'Desc', 500, 60, null, null, now, now);

      db.prepare(
        'INSERT INTO mechanics (id, first_name, last_name, phone, email, specialization_id, service_station_id, experience_years, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(mechanicId, 'Іван', 'Петренко', null, null, null, null, 5, now, now);

      db.prepare(
        'INSERT INTO appointments (id, user_id, vehicle_id, vehicle_vin, service_id, mechanic_id, scheduled_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        userId,
        vehicleId,
        vin,
        serviceId,
        mechanicId,
        now,
        'confirmed',
        now,
        now
      );

      req.user.id = userId;
      req.params.vin = vin;

      await vehicleController.getVehicleByVin(req, res);

      const result = res.json.mock.calls[0][0];
      expect(result).toEqual(
        expect.objectContaining({
          id: vehicleId,
          vin,
          user_id: userId,
          make: 'BMW',
          model: 'X5',
        })
      );
      expect(result.licensePlate).toBe('AA1234BB');
      expect(result.appointments.length).toBe(1);
      expect(result.appointments[0]).toEqual(
        expect.objectContaining({
          services: expect.objectContaining({
            name: 'Oil Change',
          }),
          mechanics: expect.objectContaining({
            id: mechanicId,
            first_name: 'Іван',
            last_name: 'Петренко',
          }),
        })
      );
    });

    test('повинен повертати 404 якщо автомобіль не знайдено', async () => {
      const userId = crypto.randomUUID();
      req.user.id = userId;
      req.params.vin = `VIN-${crypto.randomUUID()}`;

      await vehicleController.getVehicleByVin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Автомобіль не знайдено' });
    });
  });

  describe('addVehicle', () => {
    test('повинен успішно додавати новий автомобіль з нормалізованим номерним знаком', async () => {
      const db = getDb();
      const now = new Date().toISOString();
      const userId = crypto.randomUUID();

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'user@example.com', 'hashed', 'client', now, now);

      req.user.id = userId;
      req.body = {
        vin: `VIN-${crypto.randomUUID()}`,
        make: 'BMW',
        model: 'X5',
        year: 2020,
        color: 'Чорний',
        mileage: 50000,
        license_plate: 'aa 1234 bb',
      };

      await vehicleController.addVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const created = res.json.mock.calls[0][0];
      expect(created).toEqual(
        expect.objectContaining({
          vin: req.body.vin,
          make: 'BMW',
          model: 'X5',
          user_id: userId,
        })
      );
      expect(created.licensePlate).toBe('AA1234BB');
      const row = db
        .prepare('SELECT license_plate FROM vehicles WHERE vin = ? AND user_id = ?')
        .get(req.body.vin, userId);
      expect(row.license_plate).toBe('AA1234BB');
    });

    test('повинен повертати помилку якщо VIN вже існує', async () => {
      const db = getDb();
      const now = new Date().toISOString();
      const userId = crypto.randomUUID();
      const vin = `VIN-${crypto.randomUUID()}`;

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'user@example.com', 'hashed', 'client', now, now);

      db.prepare(
        'INSERT INTO vehicles (id, user_id, vin, make, model, year, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), userId, vin, 'BMW', 'X5', 2020, now, now);

      req.user.id = userId;
      req.body = {
        vin,
        make: 'BMW',
        model: 'X5',
        year: 2020,
      };

      await vehicleController.addVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Автомобіль з таким VIN вже існує' });
    });
  });

  describe('updateVehicle', () => {
    test('повинен успішно оновлювати автомобіль і номерний знак', async () => {
      const db = getDb();
      const now = new Date().toISOString();
      const userId = crypto.randomUUID();
      const vehicleId = crypto.randomUUID();
      const vin = `VIN-${crypto.randomUUID()}`;

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'user@example.com', 'hashed', 'client', now, now);

      db.prepare(
        'INSERT INTO vehicles (id, user_id, vin, make, model, year, color, license_plate, mileage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(vehicleId, userId, vin, 'BMW', 'X5', 2020, 'Чорний', 'AA1234BB', 50000, now, now);

      req.user.id = userId;
      req.params.vin = vin;
      req.body = {
        model: 'X5 Updated',
        year: 2021,
        color: 'Синій',
        mileage: 55000,
        license_plate: 'aa 9999 bb',
      };

      await vehicleController.updateVehicle(req, res);

      const updated = res.json.mock.calls[0][0];
      expect(updated).toEqual(
        expect.objectContaining({
          id: vehicleId,
          vin,
          model: 'X5 Updated',
          year: 2021,
          color: 'Синій',
          mileage: 55000,
        })
      );
      expect(updated.licensePlate).toBe('AA9999BB');
      const row = db
        .prepare('SELECT license_plate FROM vehicles WHERE vin = ? AND user_id = ?')
        .get(vin, userId);
      expect(row.license_plate).toBe('AA9999BB');
    });

    test('повинен повертати 404 якщо автомобіль для оновлення не знайдено', async () => {
      const userId = crypto.randomUUID();
      req.user.id = userId;
      req.params.vin = `VIN-${crypto.randomUUID()}`;
      req.body = { model: 'X5' };

      await vehicleController.updateVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Автомобіль не знайдено' });
    });
  });

  describe('deleteVehicle', () => {
    test('повинен повертати помилку якщо є активні записи на обслуговування', async () => {
      const db = getDb();
      const now = new Date().toISOString();
      const userId = crypto.randomUUID();
      const vehicleId = crypto.randomUUID();
      const vin = `VIN-${crypto.randomUUID()}`;
      const appointmentId = crypto.randomUUID();

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'user@example.com', 'hashed', 'client', now, now);

      db.prepare(
        'INSERT INTO vehicles (id, user_id, vin, make, model, year, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(vehicleId, userId, vin, 'BMW', 'X5', 2020, now, now);

      db.prepare(
        "INSERT INTO appointments (id, user_id, vehicle_id, vehicle_vin, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)"
      ).run(appointmentId, userId, vehicleId, vin, now, now);

      req.user.id = userId;
      req.params.vin = vin;

      await vehicleController.deleteVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Неможливо видалити автомобіль з активними записами на обслуговування',
      });
    });

    test('повинен видаляти автомобіль без активних записів', async () => {
      const db = getDb();
      const now = new Date().toISOString();
      const userId = crypto.randomUUID();
      const vehicleId = crypto.randomUUID();
      const vin = `VIN-${crypto.randomUUID()}`;

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'user@example.com', 'hashed', 'client', now, now);

      db.prepare(
        'INSERT INTO vehicles (id, user_id, vin, make, model, year, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(vehicleId, userId, vin, 'BMW', 'X5', 2020, now, now);

      req.user.id = userId;
      req.params.vin = vin;

      await vehicleController.deleteVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();

      const row = db
        .prepare('SELECT id FROM vehicles WHERE vin = ? AND user_id = ?')
        .get(vin, userId);
      expect(row).toBeUndefined();
    });
  });
});
