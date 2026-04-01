const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('jimp', () => {
  throw new Error('Jimp disabled in tests');
});

const mockRecognize = jest.fn();
const mockSetParameters = jest.fn();
const mockTerminate = jest.fn();

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(async () => ({
    setParameters: mockSetParameters,
    recognize: mockRecognize,
    terminate: mockTerminate,
  })),
}));

const app = require('../index');

describe('OCR Plate Route - integration (mocked tesseract)', () => {
  const signToken = (payload) =>
    jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

  beforeEach(() => {
    mockRecognize.mockReset();
    mockSetParameters.mockReset();
    mockTerminate.mockReset();
  });

  test('POST /api/ocr/plate returns licensePlate when OCR text contains a plate', async () => {
    mockRecognize.mockResolvedValueOnce({ data: { text: 'KA 2878 IA' } });

    const token = signToken({ id: 'u1', email: 'u1@example.com', role: 'client' });

    const res = await request(app)
      .post('/api/ocr/plate')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('fake-image-bytes'), 'plate.png');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('licensePlate', 'KA2878IA');
    expect(typeof res.body.rawText).toBe('string');
    expect(mockRecognize).toHaveBeenCalled();
  });

  test('POST /api/ocr/plate?debug=1 returns debug attempts payload', async () => {
    mockRecognize.mockResolvedValueOnce({ data: { text: 'AA1234BB' } });

    const token = signToken({ id: 'u2', email: 'u2@example.com', role: 'client' });

    const res = await request(app)
      .post('/api/ocr/plate?debug=1')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('fake-image-bytes'), 'plate.png');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('licensePlate', 'AA1234BB');
    expect(res.body).toHaveProperty('attempts');
    expect(Array.isArray(res.body.attempts)).toBe(true);
    expect(res.body.attempts.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('inputs');
    expect(res.body.meta.inputs).toHaveProperty('orig', true);
  });
});
