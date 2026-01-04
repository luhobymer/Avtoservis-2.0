const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null })),
};

jest.mock('../config/supabaseClient.js', () => ({
  supabase: mockSupabase,
}));

const { supabase } = require('../config/supabaseClient.js');

describe('Simple Supabase Test', () => {
  it('should mock supabase correctly', async () => {
    console.log('supabase:', supabase);
    expect(supabase).toBeDefined();
    expect(supabase.from).toBeDefined();

    const result = await supabase.from('test').select('*').single();
    console.log('result:', result);
    expect(result.data.id).toBe(1);
  });
});
