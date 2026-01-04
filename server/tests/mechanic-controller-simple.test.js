// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
};

jest.mock('../config/supabaseClient.js', () => ({ supabase: mockSupabase }));

const { getAllMechanics } = require('../controllers/mechanicController');

describe('MechanicController Simple Test', () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      json: jest.fn(),
      status: jest.fn(() => res),
    };
    jest.clearAllMocks();
  });

  it('should get all mechanics', async () => {
    const mockMechanics = [{ id: 1, first_name: 'Іван', last_name: 'Петренко' }];

    mockSupabase.select.mockResolvedValue({
      data: mockMechanics,
      error: null,
    });

    await getAllMechanics(req, res);

    expect(mockSupabase.from).toHaveBeenCalledWith('mechanics');
    expect(res.json).toHaveBeenCalledWith(mockMechanics);
  });
});
