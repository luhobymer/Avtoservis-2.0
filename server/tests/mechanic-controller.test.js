// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
};

jest.mock('../config/supabaseClient.js', () => ({ supabase: mockSupabase }));

const {
  getAllMechanics,
  getMechanicById,
  createMechanic,
  updateMechanic,
  deleteMechanic,
  getMechanicSchedule,
} = require('../controllers/mechanicController');

describe('MechanicController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
    };
    res = {
      json: jest.fn(),
      status: jest.fn(() => res),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('getAllMechanics', () => {
    it('should return all mechanics', async () => {
      const mockMechanics = [{ id: 1, first_name: 'Іван', last_name: 'Петренко' }];

      mockSupabase.select.mockResolvedValue({
        data: mockMechanics,
        error: null,
      });

      await getAllMechanics(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('mechanics');
      expect(res.json).toHaveBeenCalledWith(mockMechanics);
    });

    it('should handle database error', async () => {
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await getAllMechanics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('getMechanicById', () => {
    it('should return mechanic by id', async () => {
      req.params.id = '1';
      const mockMechanic = { id: 1, first_name: 'Іван', last_name: 'Петренко' };

      mockSupabase.single.mockResolvedValue({
        data: mockMechanic,
        error: null,
      });

      await getMechanicById(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('mechanics');
      expect(res.json).toHaveBeenCalledWith(mockMechanic);
    });

    it('should return 404 when mechanic not found', async () => {
      req.params.id = '999';

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await getMechanicById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Механіка не знайдено' });
    });
  });

  describe('createMechanic', () => {
    it('should create new mechanic', async () => {
      req.body = {
        first_name: 'Іван',
        last_name: 'Петренко',
        phone: '+380501234567',
        email: 'ivan@example.com',
        specialization_id: 1,
        service_station_id: 1,
        experience_years: 5,
      };

      const mockCreatedMechanic = { id: 1, ...req.body };

      mockSupabase.single.mockResolvedValue({
        data: mockCreatedMechanic,
        error: null,
      });

      await createMechanic(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('mechanics');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCreatedMechanic);
    });
  });

  describe('updateMechanic', () => {
    it('should update mechanic', async () => {
      req.params.id = '1';
      req.body = {
        first_name: 'Іван',
        last_name: 'Петренко',
        phone: '+380501234567',
        email: 'ivan@example.com',
        specialization_id: 1,
        service_station_id: 1,
        experience_years: 6,
      };

      const mockUpdatedMechanic = { id: 1, ...req.body };

      mockSupabase.single.mockResolvedValue({
        data: mockUpdatedMechanic,
        error: null,
      });

      await updateMechanic(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('mechanics');
      expect(res.json).toHaveBeenCalledWith(mockUpdatedMechanic);
    });
  });

  describe('deleteMechanic', () => {
    it('should delete mechanic when no active appointments', async () => {
      req.params.id = '1';

      // Mock для перевірки активних записів
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock для видалення
      mockSupabase.delete.mockResolvedValueOnce({
        error: null,
      });

      await deleteMechanic(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getMechanicSchedule', () => {
    it('should return mechanic schedule', async () => {
      req.params.id = '1';
      req.query = {
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      };

      const mockSchedule = [
        {
          id: 1,
          appointment_date: '2024-01-15T10:00:00Z',
          status: 'confirmed',
        },
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockSchedule,
        error: null,
      });

      await getMechanicSchedule(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('appointments');
      expect(res.json).toHaveBeenCalledWith(mockSchedule);
    });
  });
});
