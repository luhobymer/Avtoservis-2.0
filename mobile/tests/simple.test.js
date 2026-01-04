/**
 * Дуже простий тест для перевірки конфігурації Jest
 */

describe('Базовий тест', () => {
  test('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2);
  });

  test('Рядки порівнюються правильно', () => {
    expect('hello').toBe('hello');
    expect('hello').not.toBe('world');
  });

  test('Масиви порівнюються правильно', () => {
    expect([1, 2, 3]).toEqual([1, 2, 3]);
    expect([1, 2, 3]).not.toEqual([3, 2, 1]);
  });

  test('Об\'єкти порівнюються правильно', () => {
    expect({ a: 1, b: 2 }).toEqual({ a: 1, b: 2 });
    expect({ a: 1, b: 2 }).not.toEqual({ a: 2, b: 1 });
  });
});