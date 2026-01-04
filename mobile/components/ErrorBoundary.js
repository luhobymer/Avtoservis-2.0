import React, { Component } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * Компонент для обробки помилок у React компонентах
 * Перехоплює помилки під час рендерингу та відображає запасний UI
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Оновлюємо стан, щоб наступний рендер показав запасний UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Можна також відправити помилку в сервіс логування
    console.error('ErrorBoundary спіймав помилку:', error, errorInfo);
    this.setState({ errorInfo });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Відображаємо запасний UI
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Щось пішло не так</Text>
          <Text style={styles.message}>
            {this.state.error?.toString() || 'Виникла помилка в додатку'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.resetError}>
            <Text style={styles.buttonText}>Спробувати знову</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Якщо помилки немає, рендеримо дочірні компоненти
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#dc3545',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#343a40',
  },
  button: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ErrorBoundary;