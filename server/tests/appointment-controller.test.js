// Mock the supabase client using __mocks__
// Mock supabase client
const mockSupabase = {
  from: jest.fn(),
  select: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  order: jest.fn(),
};

jest.mock('../config/supabaseClient.js', () => ({
  supabase: mockSupabase,
}));

const {
  getAllAppointments,
  getAppointmentById,
  getUserAppointments,
  createAppointment,
  updateAppointmentStatus,
  cancelAppointment,
} = require('../controllers/appointmentController');

describe('AppointmentController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { id: 1 },
    };
    res = {
      json: jest.fn(),
      status: jest.fn(() => res),
    };
    jest.clearAllMocks();
  });

  describe('getAllAppointments', () => {
    beforeEach(() => {
      // Reset all mocks
      mockSupabase.from.mockClear();
      mockSupabase.select.mockClear();
      mockSupabase.order.mockClear();
    });

    it('should return all appointments with related data', async () => {
      const mockAppointments = [
        {
          id: 1,
          appointment_date: '2024-01-15T10:00:00Z',
          status: 'confirmed',
          users: { id: 1, email: 'user@example.com' },
          services: { id: 1, name: 'Заміна масла', price: 500, duration: 60 },
          mechanics: { id: 1, first_name: 'Іван', last_name: 'Петренко' },
          service_stations: { id: 1, name: 'СТО №1' },
        },
      ];

      // Mock the chain
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValue({
        data: mockAppointments,
        error: null,
      });

      await getAllAppointments(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.order).toHaveBeenCalledWith('appointment_date', { ascending: true });
      expect(res.json).toHaveBeenCalledWith(mockAppointments);
    });

    it('should handle database error', async () => {
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await getAllAppointments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle server error', async () => {
      mockSupabase.select.mockRejectedValue(new Error('Server error'));

      await getAllAppointments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('getAppointmentById', () => {
    beforeEach(() => {
      req.params.id = '1';
    });

    it('should return appointment by id with related data', async () => {
      const mockAppointment = {
        id: 1,
        appointment_date: '2024-01-15T10:00:00Z',
        status: 'confirmed',
        users: { id: 1, email: 'user@example.com' },
        services: { id: 1, name: 'Заміна масла', price: 500, duration: 60 },
        mechanics: { id: 1, first_name: 'Іван', last_name: 'Петренко' },
        service_stations: { id: 1, name: 'СТО №1' },
      };

      mockSupabase.single.mockResolvedValue({
        data: mockAppointment,
        error: null,
      });

      await getAppointmentById(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(mockSupabase.single).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockAppointment);
    });

    it('should return 404 when appointment not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await getAppointmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Запис не знайдено' });
    });

    it('should handle database error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await getAppointmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('getUserAppointments', () => {
    it('should return user appointments ordered by date', async () => {
      const mockAppointments = [
        {
          id: 1,
          appointment_date: '2024-01-15T10:00:00Z',
          status: 'confirmed',
          services: { id: 1, name: 'Заміна масла', price: 500, duration: 60 },
          mechanics: { id: 1, first_name: 'Іван', last_name: 'Петренко' },
          service_stations: { id: 1, name: 'СТО №1' },
        },
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockAppointments,
        error: null,
      });

      await getUserAppointments(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 1);
      expect(mockSupabase.order).toHaveBeenCalledWith('appointment_date', { ascending: true });
      expect(res.json).toHaveBeenCalledWith(mockAppointments);
    });

    it('should handle database error', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await getUserAppointments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('createAppointment', () => {
    beforeEach(() => {
      req.body = {
        service_id: 1,
        mechanic_id: 1,
        appointment_date: '2024-01-15T10:00:00Z',
        notes: 'Тестові нотатки',
        car_info: 'Toyota Camry 2020',
      };
    });

    it('should create new appointment successfully when time is available', async () => {
      // Reset all mocks first
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.insert.mockReturnValue(mockSupabase);

      const mockCreatedAppointment = {
        id: 1,
        user_id: 1,
        ...req.body,
        status: 'pending',
      };

      // Mock check for existing appointment - none found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // No rows found
      });

      // Mock create appointment
      mockSupabase.single.mockResolvedValueOnce({
        data: mockCreatedAppointment,
        error: null,
      });

      await createAppointment(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
      expect(mockSupabase.eq).toHaveBeenCalledWith('mechanic_id', 1);
      expect(mockSupabase.eq).toHaveBeenCalledWith('appointment_date', '2024-01-15T10:00:00Z');
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        {
          user_id: 1,
          service_id: 1,
          mechanic_id: 1,
          appointment_date: '2024-01-15T10:00:00Z',
          notes: 'Тестові нотатки',
          car_info: 'Toyota Camry 2020',
          status: 'pending',
        },
      ]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCreatedAppointment);
    });

    it('should return 400 when time slot is already taken', async () => {
      // Reset all mocks first
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      // Mock check for existing appointment - found one
      mockSupabase.single.mockResolvedValue({
        data: { id: 2, mechanic_id: 1, appointment_date: '2024-01-15T10:00:00Z' },
        error: null,
      });

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Цей час вже зайнято' });
    });

    it('should handle database error during availability check', async () => {
      // Reset all mocks first
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle database error during creation', async () => {
      // Reset all mocks first
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.insert.mockReturnValue(mockSupabase);

      // Mock successful availability check
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock creation error
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle server error', async () => {
      // Reset all mocks first
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('updateAppointmentStatus', () => {
    beforeEach(() => {
      req.params.id = '1';
      req.body = {
        status: 'completed',
        completion_notes: 'Роботу виконано успішно',
      };
    });

    it('should update appointment status successfully', async () => {
      // Reset all mocks first
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);

      const mockUpdatedAppointment = {
        id: 1,
        status: 'completed',
        completion_notes: 'Роботу виконано успішно',
        completed_at: expect.any(Date),
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUpdatedAppointment,
        error: null,
      });

      await updateAppointmentStatus(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'completed',
        completion_notes: 'Роботу виконано успішно',
        completed_at: expect.any(Date),
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(res.json).toHaveBeenCalledWith(mockUpdatedAppointment);
    });

    it('should not set completed_at when status is not completed', async () => {
      req.body.status = 'confirmed';

      // Reset all mocks first
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      const mockUpdatedAppointment = {
        id: 1,
        status: 'confirmed',
        completion_notes: 'Роботу виконано успішно',
        completed_at: null,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUpdatedAppointment,
        error: null,
      });

      await updateAppointmentStatus(req, res);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'confirmed',
        completion_notes: 'Роботу виконано успішно',
        completed_at: null,
      });
    });

    it('should return 404 when appointment not found', async () => {
      // Reset all mocks first
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await updateAppointmentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Запис не знайдено' });
    });

    it('should handle database error', async () => {
      // Reset all mocks first
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await updateAppointmentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('cancelAppointment', () => {
    beforeEach(() => {
      req.params.id = '1';
      // Reset all mocks
      mockSupabase.from.mockClear();
      mockSupabase.select.mockClear();
      mockSupabase.eq.mockClear();
      mockSupabase.update.mockClear();
      mockSupabase.single.mockClear();
    });

    it('should cancel appointment successfully when more than 24 hours before', async () => {
      // Set appointment date to be more than 24 hours in the future
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);

      // Mock the chain for checking appointment
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 1,
          user_id: 1,
          appointment_date: futureDate.toISOString(),
        },
        error: null,
      });

      // Mock the chain for update operation
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue({
        error: null,
      });

      await cancelAppointment(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 1);
      expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'cancelled' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Запис скасовано' });
    });

    it('should return 404 when appointment not found', async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await cancelAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Запис не знайдено' });
    });

    it('should return 400 when trying to cancel less than 24 hours before appointment', async () => {
      // Set appointment date to be less than 24 hours in the future
      const nearFutureDate = new Date();
      nearFutureDate.setHours(nearFutureDate.getHours() + 12); // 12 hours in future

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      mockSupabase.single.mockResolvedValue({
        data: {
          id: 1,
          user_id: 1,
          appointment_date: nearFutureDate.toISOString(),
        },
        error: null,
      });

      await cancelAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Скасування можливе не менше ніж за 24 години до запису',
      });
    });

    it('should handle database error during appointment check', async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await cancelAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle database error during cancellation', async () => {
      // Set appointment date to be more than 24 hours in the future
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 48);

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);

      // Mock successful appointment check
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 1,
          user_id: 1,
          appointment_date: futureDate.toISOString(),
        },
        error: null,
      });

      // Mock update operation error
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue({
        error: new Error('Database error'),
      });

      await cancelAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle server error', async () => {
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await cancelAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });
});
