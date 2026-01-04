// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
};

jest.mock('../config/supabaseClient.js', () => ({ supabase: mockSupabase }));

const {
  getAllStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
} = require('../controllers/serviceStationController');

describe('ServiceStationController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
    };
    res = {
      json: jest.fn(),
      status: jest.fn(() => res),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('getAllStations', () => {
    it('should return all service stations with related data', async () => {
      const mockStations = [
        {
          id: 1,
          name: 'СТО №1',
          address: 'вул. Головна, 1',
          phone: '+380501234567',
          services: [{ id: 1, name: 'Заміна масла', price: 500, duration: 60 }],
          mechanics: [
            { id: 1, first_name: 'Іван', last_name: 'Петренко', specialization: 'Двигуни' },
          ],
        },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockStations,
        error: null,
      });

      await getAllStations(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('service_stations');
      expect(mockSupabase.select).toHaveBeenCalledWith(`
        *,
        services (id, name, price, duration),
        mechanics (id, first_name, last_name, specialization)
      `);
      expect(res.json).toHaveBeenCalledWith(mockStations);
    });

    it('should handle database error', async () => {
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await getAllStations(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle server error', async () => {
      mockSupabase.select.mockRejectedValue(new Error('Server error'));

      await getAllStations(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('getStationById', () => {
    beforeEach(() => {
      req.params.id = '1';
    });

    it('should return service station by id with related data', async () => {
      const mockStation = {
        id: 1,
        name: 'СТО №1',
        address: 'вул. Головна, 1',
        phone: '+380501234567',
        services: [{ id: 1, name: 'Заміна масла', price: 500, duration: 60 }],
        mechanics: [
          { id: 1, first_name: 'Іван', last_name: 'Петренко', specialization: 'Двигуни' },
        ],
        reviews: [
          {
            id: 1,
            rating: 5,
            comment: 'Відмінний сервіс',
            created_at: '2024-01-15T10:00:00Z',
            users: { id: 1, email: 'user@example.com' },
          },
        ],
      };

      mockSupabase.single.mockResolvedValue({
        data: mockStation,
        error: null,
      });

      await getStationById(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('service_stations');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(mockSupabase.single).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockStation);
    });

    it('should return 404 when service station not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await getStationById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'СТО не знайдено' });
    });

    it('should handle database error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await getStationById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle server error', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await getStationById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('createStation', () => {
    beforeEach(() => {
      req.body = {
        name: 'СТО №1',
        address: 'вул. Головна, 1',
        phone: '+380501234567',
        working_hours: '9:00-18:00',
        description: 'Професійний автосервіс',
      };
    });

    it('should create new service station successfully', async () => {
      const mockCreatedStation = {
        id: 1,
        ...req.body,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockCreatedStation,
        error: null,
      });

      await createStation(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('service_stations');
      expect(mockSupabase.insert).toHaveBeenCalledWith([req.body]);
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.single).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCreatedStation);
    });

    it('should handle database error during creation', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await createStation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle server error', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await createStation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('updateStation', () => {
    beforeEach(() => {
      req.params.id = '1';
      req.body = {
        name: 'СТО №1 Оновлено',
        address: 'вул. Головна, 1А',
        phone: '+380501234568',
        working_hours: '8:00-19:00',
        description: 'Професійний автосервіс з розширеними послугами',
      };
    });

    it('should update service station successfully', async () => {
      const mockUpdatedStation = {
        id: 1,
        ...req.body,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockUpdatedStation,
        error: null,
      });

      await updateStation(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('service_stations');
      expect(mockSupabase.update).toHaveBeenCalledWith(req.body);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.single).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockUpdatedStation);
    });

    it('should return 404 when service station not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await updateStation(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'СТО не знайдено' });
    });

    it('should handle database error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await updateStation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle server error', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Server error'));

      await updateStation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  describe('deleteStation', () => {
    beforeEach(() => {
      req.params.id = '1';
    });

    it('should delete service station successfully', async () => {
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
      });

      await deleteStation(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('service_stations');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should handle database error during deletion', async () => {
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await deleteStation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });

    it('should handle server error', async () => {
      mockSupabase.delete.mockRejectedValue(new Error('Server error'));

      await deleteStation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Помилка сервера' });
    });
  });

  // Integration tests
  describe('Integration Tests', () => {
    it('should properly chain Supabase calls for getAllStations', async () => {
      const mockData = [{ id: 1, name: 'Test Station' }];
      mockSupabase.select.mockResolvedValue({ data: mockData, error: null });

      await getAllStations(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('service_stations');
      expect(mockSupabase.select).toHaveBeenCalledWith(`
        *,
        services (id, name, price, duration),
        mechanics (id, first_name, last_name, specialization)
      `);
    });

    it('should properly chain Supabase calls for getStationById', async () => {
      req.params.id = '1';
      const mockData = { id: 1, name: 'Test Station' };
      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

      await getStationById(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('service_stations');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
      expect(mockSupabase.single).toHaveBeenCalled();
    });

    it('should properly pass data to createStation', async () => {
      const stationData = {
        name: 'New Station',
        address: 'New Address',
        phone: '+380501234567',
        working_hours: '9:00-18:00',
        description: 'New Description',
      };
      req.body = stationData;
      mockSupabase.single.mockResolvedValue({ data: { id: 1, ...stationData }, error: null });

      await createStation(req, res);

      expect(mockSupabase.insert).toHaveBeenCalledWith([stationData]);
    });

    it('should properly pass data to updateStation', async () => {
      req.params.id = '1';
      const updateData = {
        name: 'Updated Station',
        address: 'Updated Address',
        phone: '+380501234568',
        working_hours: '8:00-19:00',
        description: 'Updated Description',
      };
      req.body = updateData;
      mockSupabase.single.mockResolvedValue({ data: { id: 1, ...updateData }, error: null });

      await updateStation(req, res);

      expect(mockSupabase.update).toHaveBeenCalledWith(updateData);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '1');
    });

    it('should properly pass id to deleteStation', async () => {
      req.params.id = '123';
      mockSupabase.delete.mockResolvedValue({ data: null, error: null });

      await deleteStation(req, res);

      expect(mockSupabase.eq).toHaveBeenCalledWith('id', '123');
    });
  });
});
