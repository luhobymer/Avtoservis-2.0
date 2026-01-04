// Mock implementation of supabaseClient
const mockSupabase = {
  from: jest.fn(function () {
    return this;
  }),
  select: jest.fn(function () {
    return this;
  }),
  eq: jest.fn(function () {
    return this;
  }),
  order: jest.fn(function () {
    return this;
  }),
  insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
  update: jest.fn(() => Promise.resolve({ data: null, error: null })),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  gte: jest.fn(function () {
    return this;
  }),
  lte: jest.fn(function () {
    return this;
  }),
  in: jest.fn(function () {
    return this;
  }),
  neq: jest.fn(function () {
    return this;
  }),
};

module.exports = {
  supabase: mockSupabase,
  supabaseAdmin: mockSupabase,
};
