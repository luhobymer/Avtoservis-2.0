# Тестування та налагодження Avtoservis

## План налагодження

### 1. Загальна стратегія налагодження

#### Принципи
- Систематичний підхід до виявлення проблем
- Документування всіх знайдених помилок
- Пріоритизація критичних проблем
- Тестування після кожного виправлення

#### Етапи налагодження
1. **Ідентифікація проблеми**
   - Збір інформації про помилку
   - Відтворення проблеми
   - Аналіз логів та повідомлень про помилки

2. **Локалізація проблеми**
   - Визначення компонента/модуля з проблемою
   - Ізоляція проблемного коду
   - Аналіз залежностей

3. **Виправлення**
   - Розробка рішення
   - Тестування виправлення
   - Перевірка побічних ефектів

4. **Верифікація**
   - Повторне тестування
   - Регресійне тестування
   - Документування виправлення

### 2. Інструменти налагодження

#### Для мобільного додатка (React Native/Expo)
- **Expo DevTools**: Основний інструмент розробки
- **React Native Debugger**: Розширений налагоджувач
- **Flipper**: Платформа для налагодження мобільних додатків
- **Console.log**: Базове логування
- **React DevTools**: Інспекція компонентів React

#### Для серверної частини (Node.js)
- **Node.js Inspector**: Вбудований налагоджувач
- **VS Code Debugger**: Інтеграція з редактором
- **Winston/Morgan**: Логування запитів та помилок
- **Postman/Insomnia**: Тестування API

#### Для бази даних (Supabase)
- **Supabase Dashboard**: Веб-інтерфейс управління
- **SQL Editor**: Виконання запитів
- **Logs**: Перегляд логів бази даних

### 3. Типові проблеми та рішення

#### Проблеми автентифікації
- **Проблема**: Невалідний JWT токен
- **Рішення**: Перевірити термін дії токена, формат, секретний ключ

- **Проблема**: Помилки CORS
- **Рішення**: Налаштувати правильні заголовки CORS на сервері

#### Проблеми з базою даних
- **Проблема**: Помилки підключення
- **Рішення**: Перевірити параметри підключення, доступність сервера

- **Проблема**: Повільні запити
- **Рішення**: Оптимізувати запити, додати індекси

#### Проблеми мобільного додатка
- **Проблема**: Крах додатка
- **Рішення**: Додати Error Boundaries, покращити обробку помилок

- **Проблема**: Повільна навігація
- **Рішення**: Оптимізувати компоненти, використати lazy loading

## Error Boundary тестування

### 1. Що таке Error Boundaries

Error Boundaries - це React компоненти, які перехоплюють JavaScript помилки в будь-якому місці дерева компонентів, логують ці помилки та відображають запасний UI замість дерева компонентів, яке зламалося.

### 2. Реалізація Error Boundary

#### Базовий Error Boundary компонент
```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Оновлює стан, щоб наступний рендер показав запасний UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Логування помилки
    console.error('Error Boundary перехопив помилку:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Тут можна відправити помилку в сервіс моніторингу
    // logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Запасний UI
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Щось пішло не так</Text>
          <Text style={styles.errorMessage}>
            Вибачте, сталася помилка. Спробуйте перезавантажити додаток.
          </Text>
          {__DEV__ && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorDetailsTitle}>Деталі помилки:</Text>
              <Text style={styles.errorDetailsText}>
                {this.state.error && this.state.error.toString()}
              </Text>
              <Text style={styles.errorDetailsText}>
                {this.state.errorInfo.componentStack}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorDetails: {
    backgroundColor: '#f1f3f4',
    padding: 16,
    borderRadius: 8,
    width: '100%',
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorDetailsText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#495057',
  },
});

export default ErrorBoundary;
```

### 3. Використання Error Boundary

#### Обгортання компонентів
```javascript
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
```

#### Локальні Error Boundaries
```javascript
function ProfileScreen() {
  return (
    <View>
      <Header />
      <ErrorBoundary>
        <UserProfile />
      </ErrorBoundary>
      <ErrorBoundary>
        <UserVehicles />
      </ErrorBoundary>
    </View>
  );
}
```

### 4. Тестування Error Boundaries

#### Тестовий компонент для генерації помилок
```javascript
import React, { useState } from 'react';
import { View, Button, Text } from 'react-native';

function ErrorTestComponent() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Тестова помилка для перевірки Error Boundary');
  }

  return (
    <View>
      <Text>Компонент працює нормально</Text>
      <Button
        title="Згенерувати помилку"
        onPress={() => setShouldThrow(true)}
      />
    </View>
  );
}

export default ErrorTestComponent;
```

#### Unit тести для Error Boundary
```javascript
import React from 'react';
import { render } from '@testing-library/react-native';
import ErrorBoundary from '../ErrorBoundary';

// Компонент, який завжди кидає помилку
function ThrowError() {
  throw new Error('Тестова помилка');
}

// Компонент, який працює нормально
function WorkingComponent() {
  return <Text>Працює</Text>;
}

describe('ErrorBoundary', () => {
  it('відображає дочірні компоненти, коли немає помилок', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    );

    expect(getByText('Працює')).toBeTruthy();
  });

  it('відображає запасний UI при помилці', () => {
    // Приховуємо console.error для цього тесту
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByText('Щось пішло не так')).toBeTruthy();
    
    consoleSpy.mockRestore();
  });
});
```

### 5. Моніторинг помилок

#### Інтеграція з сервісами моніторингу
```javascript
// Приклад інтеграції з Sentry
import * as Sentry from '@sentry/react-native';

class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Відправка помилки в Sentry
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', true);
      scope.setContext('errorInfo', errorInfo);
      Sentry.captureException(error);
    });
  }
}
```

#### Локальне логування
```javascript
// Збереження помилок локально
import AsyncStorage from '@react-native-async-storage/async-storage';

const logErrorLocally = async (error, errorInfo) => {
  try {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    };

    const existingLogs = await AsyncStorage.getItem('errorLogs');
    const logs = existingLogs ? JSON.parse(existingLogs) : [];
    logs.push(errorLog);

    // Зберігаємо тільки останні 50 помилок
    const recentLogs = logs.slice(-50);
    await AsyncStorage.setItem('errorLogs', JSON.stringify(recentLogs));
  } catch (storageError) {
    console.error('Не вдалося зберегти лог помилки:', storageError);
  }
};
```

## Стратегії тестування

### 1. Unit тестування

#### Тестування компонентів
```javascript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LoginForm from '../LoginForm';

describe('LoginForm', () => {
  it('відображає поля email та password', () => {
    const { getByPlaceholderText } = render(<LoginForm />);
    
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Пароль')).toBeTruthy();
  });

  it('викликає onSubmit з правильними даними', () => {
    const mockSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <LoginForm onSubmit={mockSubmit} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Пароль'), 'password123');
    fireEvent.press(getByText('Увійти'));

    expect(mockSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });
});
```

#### Тестування API функцій
```javascript
import { login } from '../api/auth';
import { mockFetch } from '../__mocks__/fetch';

describe('Auth API', () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  it('успішно логінить користувача', async () => {
    fetch.mockResponseOnce(JSON.stringify({
      token: 'fake-jwt-token',
      user: { id: 1, email: 'test@example.com' }
    }));

    const result = await login('test@example.com', 'password123');

    expect(result.token).toBe('fake-jwt-token');
    expect(result.user.email).toBe('test@example.com');
  });

  it('обробляє помилки логіну', async () => {
    fetch.mockRejectOnce(new Error('Network error'));

    await expect(login('test@example.com', 'wrong-password'))
      .rejects.toThrow('Network error');
  });
});
```

### 2. Integration тестування

#### Тестування навігації
```javascript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { render, fireEvent } from '@testing-library/react-native';
import AppNavigator from '../navigation/AppNavigator';

describe('Navigation', () => {
  it('переходить на екран профілю після логіну', async () => {
    const { getByText, findByText } = render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    );

    // Симулюємо логін
    fireEvent.press(getByText('Увійти'));
    
    // Перевіряємо, що з'явився екран профілю
    expect(await findByText('Профіль')).toBeTruthy();
  });
});
```

### 3. E2E тестування

#### Налаштування Detox
```javascript
// detox.config.js
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/config.json',
  configurations: {
    'ios.sim.debug': {
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Avtoservis.app',
      build: 'xcodebuild -workspace ios/Avtoservis.xcworkspace -scheme Avtoservis -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
      type: 'ios.simulator',
      device: {
        type: 'iPhone 12'
      }
    },
    'android.emu.debug': {
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..',
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_3_API_29'
      }
    }
  }
};
```

#### E2E тести
```javascript
// e2e/login.e2e.js
describe('Login Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('повинен успішно логінити користувача', async () => {
    await element(by.id('emailInput')).typeText('test@example.com');
    await element(by.id('passwordInput')).typeText('password123');
    await element(by.id('loginButton')).tap();
    
    await expect(element(by.text('Вітаємо!'))).toBeVisible();
  });

  it('повинен показати помилку при невірних даних', async () => {
    await element(by.id('emailInput')).typeText('wrong@example.com');
    await element(by.id('passwordInput')).typeText('wrongpassword');
    await element(by.id('loginButton')).tap();
    
    await expect(element(by.text('Невірний email або пароль'))).toBeVisible();
  });
});
```

## Автоматизація тестування

### 1. CI/CD Pipeline

#### GitHub Actions
```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Run linting
      run: npm run lint
      
    - name: Upload coverage
      uses: codecov/codecov-action@v1
```

### 2. Pre-commit hooks

#### Husky налаштування
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm test"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ]
  }
}
```

## Моніторинг якості коду

### 1. Покриття тестами

#### Jest конфігурація
```javascript
// jest.config.js
module.exports = {
  preset: 'react-native',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 2. Статичний аналіз коду

#### ESLint правила
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    '@react-native-community',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-unused-vars': 'error'
  }
};
```