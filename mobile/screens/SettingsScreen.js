import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import CustomButton from '../components/CustomButton';
import { Ionicons } from '@expo/vector-icons';
import { getUserSettings, updateNotificationSettings, updateAppearanceSettings } from '../api/userSettingsService';

export default function SettingsScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    twoFactorAuth: false,
    darkMode: false,
    language: 'uk'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = await getToken();
      const userId = user?.id || null;
      if (!userId) throw new Error('Користувача не знайдено');
      const data = await getUserSettings(userId, token);
      const mapped = {
        pushNotifications: !!data?.notifications?.pushEnabled,
        emailNotifications: !!data?.notifications?.emailEnabled,
        twoFactorAuth: false,
        darkMode: !!data?.appearance?.darkMode,
        language: 'uk'
      };
      setSettings(mapped);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      Alert.alert(t('common.error'), t('settings.fetch_error'));
    }
  };

  const updateSetting = async (key, value) => {
    setLoading(true);
    try {
      const token = await getToken();
      const userId = user?.id || null;
      if (!userId) throw new Error('Користувача не знайдено');
      if (key === 'pushNotifications') {
        await updateNotificationSettings(userId, { pushEnabled: !!value }, token);
      } else if (key === 'emailNotifications') {
        await updateNotificationSettings(userId, { emailEnabled: !!value }, token);
      } else if (key === 'darkMode') {
        await updateAppearanceSettings(userId, { darkMode: !!value }, token);
      }
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Failed to update setting:', error);
      Alert.alert(t('common.error'), t('settings.update_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FA = () => {
    navigation.navigate('TwoFactorSetup');
  };

  const renderSettingItem = (icon, title, description, value, onToggle, disabled = false) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={24} color="#666" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled || loading}
        trackColor={{ false: '#ddd', true: '#90caf9' }}
        thumbColor={value ? '#1976d2' : '#f4f3f4'}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
        {renderSettingItem(
          'notifications-outline',
          t('settings.push_notifications'),
          t('settings.push_notifications_desc'),
          settings.pushNotifications,
          (value) => updateSetting('pushNotifications', value)
        )}
        {renderSettingItem(
          'mail-outline',
          t('settings.email_notifications'),
          t('settings.email_notifications_desc'),
          settings.emailNotifications,
          (value) => updateSetting('emailNotifications', value)
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.security')}</Text>
        {renderSettingItem(
          'lock-closed-outline',
          t('settings.two_factor_auth'),
          t('settings.two_factor_auth_desc'),
          settings.twoFactorAuth,
          handleSetup2FA
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.appearance')}</Text>
        {renderSettingItem(
          'moon-outline',
          t('settings.dark_mode'),
          t('settings.dark_mode_desc'),
          settings.darkMode,
          (value) => updateSetting('darkMode', value)
        )}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 15,
    marginVertical: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingIcon: {
    width: 40,
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginHorizontal: 15,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
