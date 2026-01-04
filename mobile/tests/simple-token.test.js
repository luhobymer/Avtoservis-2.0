/**
 * Простий тест для перевірки роботи Jest
 */

describe('Basic Jest Tests', () => {
  test('should pass basic test', () => {
    expect(true).toBe(true);
  });

  test('should work with numbers', () => {
    expect(2 + 2).toBe(4);
  });

  test('should work with strings', () => {
    expect('hello').toBe('hello');
  });
});