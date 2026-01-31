import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import CustomButton from '../components/CustomButton';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login, error, loading } = useAuth();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);

  // Очищаємо локальну помилку при зміні полів вводу
  useEffect(() => {
    if (localError) setLocalError(null);
  }, [email, password]);

  const handleLogin = async () => {
    if (!identifier || !password) {
      setLocalError(t('validation.please_fill_all_fields'));
      Alert.alert(t('common.error'), t('validation.please_fill_all_fields'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(\+?380|0)\d{9}$/;
    if (!emailRegex.test(identifier) && !phoneRegex.test(identifier)) {
      setLocalError(t('validation.invalid_email_or_phone'));
      Alert.alert(t('common.error'), t('validation.invalid_email_or_phone'));
      return;
    }

    let loginValue = identifier;
    if (phoneRegex.test(identifier)) {
      let cleanedPhone = identifier.trim().replace(/\s+/g, '');
      if (cleanedPhone.startsWith('0')) {
        loginValue = '+380' + cleanedPhone.slice(1);
      } else if (cleanedPhone.startsWith('380')) {
        loginValue = '+' + cleanedPhone;
      } else {
        loginValue = cleanedPhone;
      }
    }

    // Виклик функції входу з контексту автентифікації
    const success = await login(loginValue, password);

    // Обробка помилок
    if (!success && error) {
      setLocalError(error);
      Alert.alert(t('auth.login_failed'), error);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          {/* Логотип або назва додатку */}
          <Text style={styles.appName}>{t('app.name') || 'Автосервіс'}</Text>
          <Text style={styles.title}>{t('auth.login')}</Text>
          
          {/* Відображення помилки */}
          {localError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{localError}</Text>
            </View>
          )}
          
          {/* Форма входу */}
          <TextInput
            style={styles.input}
            placeholder={t('auth.email_or_phone_placeholder') || 'Email або телефон'}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="default"
            autoComplete="username"
          />
          
          <TextInput
            style={styles.input}
            placeholder={t('auth.password_placeholder') || 'Пароль'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          
          {/* Кнопка входу */}
          <CustomButton 
            title={loading ? '' : (t('auth.login_btn') || 'Увійти')}
            onPress={handleLogin}
            style={styles.loginButton}
          >
            {loading && <ActivityIndicator color="#fff" />}
          </CustomButton>
          
          {/* Посилання на реєстрацію */}
          <TouchableOpacity 
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerText}>
              {t('auth.dont_have_account') || 'Немає облікового запису?'} {' '}
              <Text style={styles.registerTextBold}>{t('auth.register') || 'Зареєструватися'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f7'
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 20,
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333'
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    fontSize: 16
  },
  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#1976d2',
    borderRadius: 8,
    marginTop: 10
  },
  errorContainer: {
    width: '100%',
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffcdd2'
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center'
  },
  registerLink: {
    marginTop: 20,
    padding: 10
  },
  registerText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center'
  },
  registerTextBold: {
    fontWeight: 'bold',
    color: '#1976d2'
  }
});
