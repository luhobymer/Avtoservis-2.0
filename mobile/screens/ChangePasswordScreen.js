import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axiosAuth from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordScreen({ navigation }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('common.error', 'Помилка'), t('validation.please_fill_all_fields'));
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert(t('common.error', 'Помилка'), t('validation.password_min_length'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error', 'Помилка'), t('validation.passwords_do_not_match', 'Паролі не співпадають'));
      return;
    }

    setLoading(true);
    try {
      const response = await axiosAuth.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      if (response?.data?.status === 'success') {
        Alert.alert(
          t('common.success', 'Успіх'),
          t('auth.password_changed', 'Пароль успішно змінено. Увійдіть знову.'),
          [
            {
              text: t('common.ok', 'OK'),
              onPress: async () => {
                await logout();
                navigation.navigate('Auth');
              },
            },
          ]
        );
      } else {
        const message =
          response?.data?.message || t('auth.password_change_failed', 'Не вдалося змінити пароль');
        Alert.alert(t('common.error', 'Помилка'), message);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        t('auth.password_change_failed', 'Не вдалося змінити пароль');
      Alert.alert(t('common.error', 'Помилка'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.change_password', 'Змінити пароль')}</Text>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>{t('auth.current_password', 'Поточний пароль')}</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrent}
            placeholder={t('auth.current_password', 'Поточний пароль')}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowCurrent(prev => !prev)}
          >
            <Ionicons
              name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>{t('auth.new_password', 'Новий пароль')}</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            placeholder={t('auth.new_password', 'Новий пароль')}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowNew(prev => !prev)}
          >
            <Ionicons
              name={showNew ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>{t('auth.confirm_password', 'Підтвердіть пароль')}</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder={t('auth.confirm_password', 'Підтвердіть пароль')}
        />
      </View>

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>{t('common.save', 'Зберегти')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 40,
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

