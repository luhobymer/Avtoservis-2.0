/**
 * Простий тест для перевірки базової функціональності
 */

describe('Простий тест', () => {
  test('повинен працювати базовий тест', () => {
    expect(1 + 1).toBe(2);
  });

  test('повинен працювати з моками', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});
