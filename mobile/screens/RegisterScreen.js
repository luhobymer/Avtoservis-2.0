import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import CustomButton from '../components/CustomButton';
import { Picker } from '@react-native-picker/picker';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigation = useNavigation();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'client'
  });

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (localError) setLocalError(null);
  }, [formData]);

  const validatePhone = (phone) => {
    const phoneRegex = /^(\+?380|0)\d{9}$/;
    return phoneRegex.test(phone);
  };

  const handleRegister = async () => {
    // Валідація полів
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      setLocalError(t('validation.please_fill_all_fields'));
      Alert.alert(t('common.error'), t('validation.please_fill_all_fields'));
      return;
    }

    // Валідація email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setLocalError(t('validation.invalid_email'));
      Alert.alert(t('common.error'), t('validation.invalid_email'));
      return;
    }

    // Валідація телефону
    let cleanedPhone = formData.phone.trim().replace(/\s+/g, '');
    if (!validatePhone(cleanedPhone)) {
      setLocalError(t('validation.invalid_phone'));
      Alert.alert(t('common.error'), t('validation.invalid_phone'));
      return;
    }

    // Форматування телефону
    if (cleanedPhone.startsWith('0')) {
      cleanedPhone = '+380' + cleanedPhone.slice(1);
    } else if (cleanedPhone.startsWith('380')) {
      cleanedPhone = '+' + cleanedPhone;
    }

    setLoading(true);

    try {
      const response = await register({
        ...formData,
        phone: cleanedPhone
      });

      if (!response || !response.success) {
        const message = response?.error || t('registration_failed');
        setLocalError(message);
        Alert.alert(t('common.error'), message);
        return;
      }

      if (response.requiresEmailConfirmation) {
        Alert.alert(
          t('success'),
          t('email_confirmation_required'),
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      } else {
        navigation.navigate('Login');
      }
    } catch (error) {
      const message = error?.message || t('registration_failed');
      setLocalError(message);
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          <Text style={styles.title}>{t('auth.register')}</Text>

          {localError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{localError}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder={t('auth.name')}
            value={formData.name}
            onChangeText={(value) => setFormData({ ...formData, name: value })}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            value={formData.email}
            onChangeText={(value) => setFormData({ ...formData, email: value })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <TextInput
            style={[styles.input, phoneError ? styles.inputError : null]}
            placeholder={t('auth.phone')}
            value={formData.phone}
            onChangeText={(value) => {
              const phoneRegex = /^(\+?380|0)\d{0,9}$/;
              if (!phoneRegex.test(value)) {
                setPhoneError(t('validation.invalid_phone'));
              } else {
                setPhoneError('');
              }
              setFormData({ ...formData, phone: value });
            }}
            keyboardType="phone-pad"
          />
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            value={formData.password}
            onChangeText={(value) => setFormData({ ...formData, password: value })}
            secureTextEntry
            autoComplete="password-new"
          />

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
              style={styles.picker}
            >
              <Picker.Item label={t('auth.roleClient')} value="client" />
              <Picker.Item label={t('auth.roleMaster')} value="master" />
              <Picker.Item label={t('auth.roleAdmin')} value="admin" />
              <Picker.Item label={t('auth.roleMasterAdmin') || 'Майстер та адміністратор'} value="master_admin" />
            </Picker>
          </View>

          <CustomButton
            title={loading ? '' : t('auth.register')}
            onPress={handleRegister}
            style={styles.registerButton}
          >
            {loading && <ActivityIndicator color="#fff" />}
          </CustomButton>

          <CustomButton
            title={t('auth.already_have_account')}
            onPress={() => navigation.navigate('Login')}
            style={styles.loginLink}
            textStyle={styles.loginLinkText}
          />
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
  inputError: {
    borderColor: '#c62828'
  },
  pickerContainer: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
    overflow: 'hidden'
  },
  picker: {
    width: '100%',
    height: 50
  },
  registerButton: {
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
    textAlign: 'center',
    marginBottom: 10
  },
  loginLink: {
    marginTop: 20,
    backgroundColor: 'transparent'
  },
  loginLinkText: {
    color: '#1976d2',
    fontSize: 14
  }
});
