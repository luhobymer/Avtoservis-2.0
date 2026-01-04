/**
 * Мінімальний тест автентифікації
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text'
}));
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

// Мінімальний компонент для тестування
const TestComponent = () => (
  <View>
    <Text>Test Component</Text>
  </View>
);

describe.skip('Мінімальний тест рендерингу', () => {
  test('Компонент рендериться без помилок', () => {
    const { getByText } = render(<TestComponent />);
    expect(getByText('Test Component')).toBeTruthy();
  });
});
