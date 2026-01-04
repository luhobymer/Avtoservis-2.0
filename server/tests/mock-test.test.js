// Mock supabase before any imports
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
  update: jest.fn(() => Promise.resolve({ data: null, error: null })),
  single: jest.fn(() => Promise.resolve({ data: { id: 1, user_id: 1 }, error: null })),
  gte: jest.fn(() => mockSupabase),
  lte: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  neq: jest.fn(() => mockSupabase),
};

jest.mock('../config/supabaseClient.js', () => ({
  supabase: mockSupabase,
  supabaseAdmin: mockSupabase,
}));

const { supabase } = require('../config/supabaseClient.js');

describe('Mock Test', () => {
  it('should have mocked supabase', () => {
    expect(supabase).toBeDefined();
    expect(supabase.from).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('should chain methods correctly', async () => {
    const result = await supabase.from('appointments').select('*').eq('id', 1).single();

    expect(result.data).toEqual({ id: 1, user_id: 1 });
    expect(result.error).toBeNull();
  });
});
