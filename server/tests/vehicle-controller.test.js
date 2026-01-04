/**
 * Детальний тест для vehicleController.js
 * Покриває всі операції управління автомобілями користувачів
 */

const vehicleController = require('../controllers/vehicleController');

// Мокуємо Supabase
jest.mock('../config/supabaseClient.js', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
  },
}));

describe('VehicleController - Детальне тестування', () => {
  let req, res, mockSupabase;

  beforeEach(() => {
    // Налаштовуємо req та res об'єкти
    req = {
      params: {},
      body: {},
      user: { id: 1 },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Переконуємося що status повертає сам res об'єкт
    res.status.mockReturnValue(res);

    // Отримуємо мокований Supabase
    mockSupabase = require('../config/supabaseClient.js').supabase;

    // Очищуємо всі моки
    jest.clearAllMocks();

    // Скидаємо моки до початкового стану
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.delete.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.in.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.limit.mockReturnValue(mockSupabase);
  });

  describe('getUserVehicles функція', () => {
    test('повинен успішно отримувати автомобілі користувача', async () => {
      const mockVehicles = [
        {
          id: 1,
          vin: 'WBAFR9C50DD123456',
          make: 'BMW',
          model: 'X5',
          year: 2020,
          color: 'Чорний',
          license_plate: 'AA1234BB',
          mileage: 50000,
          user_id: 1,
          service_history: [
            {
              id: 1,
              service_type: 'Заміна масла',
              scheduled_time: '2024-01-15T10:00:00Z',
              status: 'completed',
              completion_notes: 'Виконано успішно',
            },
          ],
        },
        {
          id: 2,
          vin: 'WBAFR9C50DD789012',
          make: 'BMW',
          model: 'X3',
          year: 2019,
          color: 'Білий',
          license_plate: 'BB5678CC',
          mileage: 75000,
          user_id: 1,
          service_history: [],
        },
      ];

      mockSupabase.order.mockResolvedValue({ data: mockVehicles, error: null });

      await vehicleController.getUserVehicles(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('vehicles');
      expect(mockSupabase.select).toHaveBeenCalledWith(`
        *,
        service_history:appointments(
          id,
          service_type,
          scheduled_time,
          status,
          completion_notes
        )
      `);
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 1);
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(res.json).toHaveBeenCalledWith(mockVehicles);
    });

    test('повинен повертати порожній масив якщо у користувача немає автомобілів', async () => {
      mockSupabase.order.mockResolvedValue({ data: [], error: null });

      await vehicleController.getUserVehicles(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    test('повинен обробляти помилки бази даних', async () => {
      mockSupabase.order.mockResolvedValue({ data: null, error: new Error('Database error') });

      await vehicleController.getUserVehicles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен обробляти серверні помилки', async () => {
      mockSupabase.order.mockRejectedValue(new Error('Server error'));

      await vehicleController.getUserVehicles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('getVehicleByVin функція', () => {
    test('повинен успішно отримувати автомобіль за VIN', async () => {
      const mockVehicle = {
        id: 1,
        vin: 'WBAFR9C50DD123456',
        make: 'BMW',
        model: 'X5',
        year: 2020,
        color: 'Чорний',
        license_plate: 'AA1234BB',
        mileage: 50000,
        user_id: 1,
        service_history: [
          {
            id: 1,
            service_type: 'Заміна масла',
            scheduled_time: '2024-01-15T10:00:00Z',
            status: 'completed',
            completion_notes: 'Виконано успішно',
            mechanics: {
              id: 1,
              first_name: 'Іван',
              last_name: 'Петров',
            },
          },
        ],
      };

      req.params.vin = 'WBAFR9C50DD123456';

      mockSupabase.single.mockResolvedValue({ data: mockVehicle, error: null });

      await vehicleController.getVehicleByVin(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('vehicles');
      expect(mockSupabase.select).toHaveBeenCalledWith(`
        *,
        service_history:appointments(
          id,
          service_type,
          scheduled_time,
          status,
          completion_notes,
          mechanics(id, first_name, last_name)
        )
      `);
      expect(mockSupabase.eq).toHaveBeenCalledWith('vin', 'WBAFR9C50DD123456');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 1);
      expect(res.json).toHaveBeenCalledWith(mockVehicle);
    });

    test('повинен повертати 404 якщо автомобіль не знайдено', async () => {
      req.params.vin = 'NONEXISTENT123456';

      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await vehicleController.getVehicleByVin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Автомобіль не знайдено' });
    });

    test('повинен обробляти помилки бази даних', async () => {
      req.params.vin = 'WBAFR9C50DD123456';

      mockSupabase.single.mockResolvedValue({ data: null, error: new Error('Database error') });

      await vehicleController.getVehicleByVin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.params.vin = 'WBAFR9C50DD123456';

      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await vehicleController.getVehicleByVin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('addVehicle функція', () => {
    test('повинен успішно додавати новий автомобіль', async () => {
      const newVehicleData = {
        vin: 'WBAFR9C50DD123456',
        make: 'BMW',
        model: 'X5',
        year: 2020,
        color: 'Чорний',
        license_plate: 'AA1234BB',
        mileage: 50000,
      };

      const createdVehicle = {
        id: 1,
        user_id: 1,
        ...newVehicleData,
        created_at: '2024-01-01T10:00:00Z',
      };

      req.body = newVehicleData;

      // Перевірка існуючого VIN
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      // Створення автомобіля
      mockSupabase.single.mockResolvedValueOnce({ data: createdVehicle, error: null });

      await vehicleController.addVehicle(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('vehicles');
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        {
          user_id: 1,
          ...newVehicleData,
        },
      ]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdVehicle);
    });

    test('повинен повертати помилку якщо VIN вже існує', async () => {
      const existingVehicle = {
        id: 1,
        vin: 'WBAFR9C50DD123456',
        user_id: 2,
      };

      req.body = {
        vin: 'WBAFR9C50DD123456',
        make: 'BMW',
        model: 'X5',
        year: 2020,
      };

      mockSupabase.single.mockResolvedValue({ data: existingVehicle, error: null });

      await vehicleController.addVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Автомобіль з таким VIN вже існує' });
    });

    test('повинен обробляти помилки створення', async () => {
      req.body = {
        vin: 'WBAFR9C50DD123456',
        make: 'BMW',
        model: 'X5',
        year: 2020,
      };

      // VIN не існує
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      // Помилка створення
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Creation failed'),
      });

      await vehicleController.addVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.body = {
        vin: 'WBAFR9C50DD123456',
        make: 'BMW',
      };

      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await vehicleController.addVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test("повинен додавати автомобіль з усіма обов'язковими полями", async () => {
      const completeVehicleData = {
        vin: 'WBAFR9C50DD789012',
        make: 'Mercedes-Benz',
        model: 'E-Class',
        year: 2021,
        color: 'Сірий',
        license_plate: 'CC9999DD',
        mileage: 25000,
      };

      const createdVehicle = {
        id: 2,
        user_id: 1,
        ...completeVehicleData,
      };

      req.body = completeVehicleData;

      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: createdVehicle, error: null });

      await vehicleController.addVehicle(req, res);

      expect(mockSupabase.insert).toHaveBeenCalledWith([
        {
          user_id: 1,
          ...completeVehicleData,
        },
      ]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdVehicle);
    });
  });

  describe('updateVehicle функція', () => {
    test('повинен успішно оновлювати автомобіль', async () => {
      const updateData = {
        make: 'BMW',
        model: 'X5 Updated',
        year: 2021,
        color: 'Синій',
        license_plate: 'AA9999BB',
        mileage: 55000,
      };

      const updatedVehicle = {
        id: 1,
        vin: 'WBAFR9C50DD123456',
        user_id: 1,
        ...updateData,
        updated_at: '2024-01-01T12:00:00Z',
      };

      req.params.vin = 'WBAFR9C50DD123456';
      req.body = updateData;

      mockSupabase.single.mockResolvedValue({ data: updatedVehicle, error: null });

      await vehicleController.updateVehicle(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('vehicles');
      expect(mockSupabase.update).toHaveBeenCalledWith(updateData);
      expect(mockSupabase.eq).toHaveBeenCalledWith('vin', 'WBAFR9C50DD123456');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 1);
      expect(res.json).toHaveBeenCalledWith(updatedVehicle);
    });

    test('повинен повертати 404 якщо автомобіль для оновлення не знайдено', async () => {
      const updateData = {
        make: 'BMW',
        model: 'X5',
      };

      req.params.vin = 'NONEXISTENT123456';
      req.body = updateData;

      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await vehicleController.updateVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Автомобіль не знайдено' });
    });

    test('повинен обробляти помилки оновлення', async () => {
      req.params.vin = 'WBAFR9C50DD123456';
      req.body = { make: 'BMW' };

      mockSupabase.single.mockResolvedValue({ data: null, error: new Error('Update failed') });

      await vehicleController.updateVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.params.vin = 'WBAFR9C50DD123456';
      req.body = { make: 'BMW' };

      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await vehicleController.updateVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен оновлювати тільки передані поля', async () => {
      const partialUpdateData = {
        mileage: 60000,
        color: 'Червоний',
      };

      const updatedVehicle = {
        id: 1,
        vin: 'WBAFR9C50DD123456',
        make: 'BMW',
        model: 'X5',
        year: 2020,
        license_plate: 'AA1234BB',
        user_id: 1,
        ...partialUpdateData,
      };

      req.params.vin = 'WBAFR9C50DD123456';
      req.body = partialUpdateData;

      mockSupabase.single.mockResolvedValue({ data: updatedVehicle, error: null });

      await vehicleController.updateVehicle(req, res);

      expect(mockSupabase.update).toHaveBeenCalledWith(partialUpdateData);
      expect(res.json).toHaveBeenCalledWith(updatedVehicle);
    });
  });

  describe('deleteVehicle функція', () => {
    test('повинен обробляти серверні помилки', async () => {
      req.params.vin = 'WBAFR9C50DD123456';

      mockSupabase.limit.mockRejectedValue(new Error('Server error'));

      await vehicleController.deleteVehicle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('Інтеграційні тести', () => {
    test('повинен правильно обробляти ланцюжок викликів Supabase для getUserVehicles', async () => {
      const mockVehicles = [{ id: 1, vin: 'TEST123' }];

      // Перевіряємо, що методи викликаються в правильному порядку
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValue({ data: mockVehicles, error: null });

      await vehicleController.getUserVehicles(req, res);

      expect(mockSupabase.from).toHaveBeenCalled();
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalled();
      expect(mockSupabase.order).toHaveBeenCalled();
    });

    test('повинен правильно передавати user_id через всі операції', async () => {
      req.user.id = 123;

      mockSupabase.order.mockResolvedValue({ data: [], error: null });

      await vehicleController.getUserVehicles(req, res);

      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 123);
    });

    test('повинен правильно обробляти VIN параметри', async () => {
      const testVin = 'WBAFR9C50DD123456';
      req.params.vin = testVin;

      mockSupabase.single.mockResolvedValue({ data: { vin: testVin }, error: null });

      await vehicleController.getVehicleByVin(req, res);

      expect(mockSupabase.eq).toHaveBeenCalledWith('vin', testVin);
    });
  });
});
