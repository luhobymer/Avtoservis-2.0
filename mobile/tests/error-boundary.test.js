/**
 * Тест компонента ErrorBoundary
 */

import React from 'react';
import ErrorBoundary from '../components/ErrorBoundary';

// Мокуємо console.error, щоб уникнути виведення помилок у консоль під час тестів
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Мокуємо React Native компоненти
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: jest.fn(styles => styles)
  },
  TouchableOpacity: 'TouchableOpacity'
}));

describe('ErrorBoundary', () => {
  test('має правильний початковий стан', () => {
    const instance = new ErrorBoundary({});
    expect(instance.state).toEqual({ hasError: false, error: null, errorInfo: null });
  });

  test('getDerivedStateFromError оновлює стан при помилці', () => {
    const error = new Error('Тестова помилка');
    const result = ErrorBoundary.getDerivedStateFromError(error);
    expect(result).toEqual({ hasError: true, error });
  });

  test('componentDidCatch оновлює стан з інформацією про помилку', () => {
    const instance = new ErrorBoundary({});
    const error = new Error('Тестова помилка');
    const errorInfo = { componentStack: 'Стек компонентів' };
    
    // Мокуємо setState
    instance.setState = jest.fn();
    
    // Викликаємо метод
    instance.componentDidCatch(error, errorInfo);
    
    // Перевіряємо, що setState викликано з правильними параметрами
    expect(instance.setState).toHaveBeenCalledWith({ errorInfo });
    expect(console.error).toHaveBeenCalled();
  });

  test('resetError скидає стан помилки', () => {
    const instance = new ErrorBoundary({});
    
    // Мокуємо setState
    instance.setState = jest.fn();
    
    // Викликаємо метод
    instance.resetError();
    
    // Перевіряємо, що setState викликано з правильними параметрами
    expect(instance.setState).toHaveBeenCalledWith({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  });

  test('render відображає дочірні компоненти, коли немає помилок', () => {
    const instance = new ErrorBoundary({ children: 'Тестовий вміст' });
    instance.state = { hasError: false };
    
    const result = instance.render();
    expect(result).toBe('Тестовий вміст');
  });

  test('render відображає запасний UI, коли є помилка', () => {
    const instance = new ErrorBoundary({});
    instance.state = { 
      hasError: true, 
      error: new Error('Тестова помилка') 
    };
    
    const result = instance.render();
    expect(result).not.toBe(undefined);
    // Перевіряємо, що результат є об'єктом React елемента
    expect(typeof result).toBe('object');
    expect(result.type).toBe('View');
  });
});