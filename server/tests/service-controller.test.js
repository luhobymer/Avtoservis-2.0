/**
 * Детальний тест для serviceController.js
 * Покриває всі CRUD операції для послуг
 */

jest.mock('../config/supabaseClient.js', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 1, name: 'Test Service' }, error: null }),
  },
}));

const serviceController = require('../controllers/serviceController');

describe('ServiceController - Детальне тестування', () => {
  let req, res, mockSupabase;

  beforeEach(() => {
    // Налаштовуємо req та res об'єкти
    req = {
      params: {},
      body: {},
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Отримуємо мокований Supabase
    const { supabase } = require('../config/supabaseClient.js');
    mockSupabase = supabase;

    // Очищуємо всі моки
    jest.clearAllMocks();

    // Скидаємо моки до початкового стану
    Object.values(mockSupabase).forEach((mock) => {
      if (typeof mock.mockReturnThis === 'function') {
        mock.mockReturnThis();
      }
    });
  });

  describe('getAllServices функція', () => {
    test('повинен успішно отримувати всі послуги', async () => {
      const mockServices = [
        {
          id: 1,
          name: 'Заміна масла',
          description: 'Заміна моторного масла та фільтра',
          price: 500,
          duration: 60,
          service_stations: {
            id: 1,
            name: 'СТО №1',
          },
        },
        {
          id: 2,
          name: 'Діагностика двигуна',
          description: "Комп'ютерна діагностика двигуна",
          price: 300,
          duration: 30,
          service_stations: {
            id: 2,
            name: 'СТО №2',
          },
        },
      ];

      mockSupabase.select.mockResolvedValue({ data: mockServices, error: null });

      await serviceController.getAllServices(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('services');
      expect(mockSupabase.select).toHaveBeenCalledWith('*, service_stations (id, name)');
      expect(res.json).toHaveBeenCalledWith(mockServices);
    });

    test('повинен обробляти помилки бази даних', async () => {
      mockSupabase.select.mockResolvedValue({ data: null, error: new Error('Database error') });

      await serviceController.getAllServices(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен обробляти серверні помилки', async () => {
      mockSupabase.select.mockRejectedValue(new Error('Server error'));

      await serviceController.getAllServices(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('getServiceById функція', () => {
    test('повинен успішно отримувати послугу за ID', async () => {
      const mockService = {
        id: 1,
        name: 'Заміна масла',
        description: 'Заміна моторного масла та фільтра',
        price: 500,
        duration: 60,
        service_stations: {
          id: 1,
          name: 'СТО №1',
        },
        service_categories: {
          id: 1,
          name: 'Технічне обслуговування',
        },
      };

      req.params.id = '1';

      mockSupabase.single.mockResolvedValue({ data: mockService, error: null });

      await serviceController.getServiceById(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('services');
      expect(mockSupabase.select).toHaveBeenCalledWith(`
        *,
        service_stations (id, name),
        service_categories (id, name)
      `);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(res.json).toHaveBeenCalledWith(mockService);
    });

    test('повинен повертати 404 якщо послугу не знайдено', async () => {
      req.params.id = '999';

      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await serviceController.getServiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Послугу не знайдено' });
    });

    test('повинен обробляти помилки бази даних', async () => {
      req.params.id = '1';

      mockSupabase.single.mockResolvedValue({ data: null, error: new Error('Database error') });

      await serviceController.getServiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.params.id = '1';

      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await serviceController.getServiceById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('createService функція', () => {
    test('повинен успішно створювати нову послугу', async () => {
      const newServiceData = {
        name: 'Заміна гальмівних колодок',
        description: 'Заміна передніх та задніх гальмівних колодок',
        price: 800,
        duration: 120,
        service_station_id: 1,
        category_id: 2,
      };

      const createdService = {
        id: 3,
        ...newServiceData,
        created_at: '2024-01-01T10:00:00Z',
      };

      req.body = newServiceData;

      mockSupabase.single.mockResolvedValue({ data: createdService, error: null });

      await serviceController.createService(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('services');
      expect(mockSupabase.insert).toHaveBeenCalledWith([newServiceData]);
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdService);
    });

    test('повинен обробляти помилки створення', async () => {
      const newServiceData = {
        name: 'Тест послуга',
        description: 'Тестова послуга',
        price: 100,
        duration: 30,
        service_station_id: 1,
        category_id: 1,
      };

      req.body = newServiceData;

      mockSupabase.single.mockResolvedValue({ data: null, error: new Error('Creation failed') });

      await serviceController.createService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.body = {
        name: 'Тест послуга',
        price: 100,
      };

      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await serviceController.createService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test("повинен створювати послугу з усіма обов'язковими полями", async () => {
      const completeServiceData = {
        name: 'Повна діагностика',
        description: 'Повна діагностика автомобіля',
        price: 1500,
        duration: 180,
        service_station_id: 2,
        category_id: 3,
      };

      const createdService = {
        id: 4,
        ...completeServiceData,
      };

      req.body = completeServiceData;

      mockSupabase.single.mockResolvedValue({ data: createdService, error: null });

      await serviceController.createService(req, res);

      expect(mockSupabase.insert).toHaveBeenCalledWith([completeServiceData]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdService);
    });
  });

  describe('updateService функція', () => {
    test('повинен успішно оновлювати послугу', async () => {
      const updateData = {
        name: 'Оновлена назва послуги',
        description: 'Оновлений опис послуги',
        price: 600,
        duration: 90,
        service_station_id: 2,
        category_id: 3,
      };

      const updatedService = {
        id: 1,
        ...updateData,
        updated_at: '2024-01-01T12:00:00Z',
      };

      req.params.id = '1';
      req.body = updateData;

      mockSupabase.single.mockResolvedValue({ data: updatedService, error: null });

      await serviceController.updateService(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('services');
      expect(mockSupabase.update).toHaveBeenCalledWith(updateData);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(res.json).toHaveBeenCalledWith(updatedService);
    });

    test('повинен повертати 404 якщо послугу для оновлення не знайдено', async () => {
      const updateData = {
        name: 'Оновлена назва',
        price: 500,
      };

      req.params.id = '999';
      req.body = updateData;

      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await serviceController.updateService(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Послугу не знайдено' });
    });

    test('повинен обробляти помилки оновлення', async () => {
      req.params.id = '1';
      req.body = { name: 'Тест' };

      mockSupabase.single.mockResolvedValue({ data: null, error: new Error('Update failed') });

      await serviceController.updateService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.params.id = '1';
      req.body = { name: 'Тест' };

      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await serviceController.updateService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен оновлювати тільки передані поля', async () => {
      const partialUpdateData = {
        price: 750,
        duration: 100,
      };

      const updatedService = {
        id: 1,
        name: 'Існуюча назва',
        description: 'Існуючий опис',
        ...partialUpdateData,
      };

      req.params.id = '1';
      req.body = partialUpdateData;

      mockSupabase.single.mockResolvedValue({ data: updatedService, error: null });

      await serviceController.updateService(req, res);

      expect(mockSupabase.update).toHaveBeenCalledWith(partialUpdateData);
      expect(res.json).toHaveBeenCalledWith(updatedService);
    });
  });

  describe('deleteService функція', () => {
    test('повинен успішно видаляти послугу', async () => {
      req.params.id = '1';

      // Мокуємо успішний ланцюжок викликів
      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });

      await serviceController.deleteService(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('services');
      expect(mockDelete).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    test('повинен обробляти помилки видалення', async () => {
      req.params.id = '1';

      // Мокуємо ланцюжок викликів з помилкою
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: new Error('Delete failed') }),
        }),
      });

      await serviceController.deleteService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.params.id = '1';

      // Мокуємо ланцюжок викликів з відхиленням промісу
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockRejectedValue(new Error('Server error')),
        }),
      });

      await serviceController.deleteService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    test('повинен видаляти послугу навіть якщо вона не існує (idempotent)', async () => {
      req.params.id = '999';

      // Мокуємо успішний ланцюжок викликів для неіснуючого запису
      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });

      await serviceController.deleteService(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('Інтеграційні тести', () => {
    test('повинен викликати всі необхідні методи', async () => {
      req.params.id = '1';
      const mockService = { id: 1, name: 'Test Service' };

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValue({ data: mockService, error: null });

      await serviceController.getServiceById(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('services');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(mockSupabase.single).toHaveBeenCalled();
    });

    test('повинен правильно передавати параметри через ланцюжок', async () => {
      req.params.id = '123';

      mockSupabase.single.mockResolvedValue({ data: { id: 123 }, error: null });

      await serviceController.getServiceById(req, res);

      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123');
    });
  });
});
