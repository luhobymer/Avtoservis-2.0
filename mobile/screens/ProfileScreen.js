import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useLocalization } from '../components/TranslationProvider';
import DirectLanguageSwitcher from '../components/DirectLanguageSwitcher';
import NotificationSettings from '../components/NotificationSettings';
import IntegrationSettings from '../components/IntegrationSettings';
import { 
  getUserSettings, 
  saveUserSettings, 
  connectTelegram, 
  disconnectTelegram,
  connectViber,
  disconnectViber,
  updateNotificationSettings,
  updateIntegrationSettings,
  updateAppearanceSettings
} from '../api/userSettingsService';

const ProfileScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { setLanguage } = useLocalization();
  const { user, logout, updateUserData, getToken, getUserData, setUser } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false); // Для форсування оновлення компонента
  
  // Стани для налаштувань
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  
  // Перевіряємо поточну мову при монтуванні компонента
  useEffect(() => {
    console.log('Поточна мова в ProfileScreen:', i18n.language);
  }, [i18n.language, forceUpdate]);
  
  // Завантажуємо налаштування користувача
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const userSettings = await getUserSettings(user.id, token);
        setSettings(userSettings);
        
        // Встановлюємо темну тему, якщо вона увімкнена в налаштуваннях
        if (userSettings.appearance && userSettings.appearance.darkMode !== undefined) {
          setDarkMode(userSettings.appearance.darkMode);
        }
      } catch (error) {
        console.error('[ProfileScreen] Помилка отримання налаштувань:', error);
        Alert.alert(t('common.error'), t('profile.settings_save_error'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  // Використовуємо реальні дані користувача з контексту Auth
  const userData = user || { 
    name: 'Користувач', 
    email: 'user@example.com', 
    role: 'client',
    phone: 'Не вказано'
  };
  
  // Функція для оновлення даних користувача
  const refreshUserData = async () => {
    try {
      const token = await getToken();
      if (token && user?.id) {
        const updatedUserData = await getUserData(token, user.id);
        if (updatedUserData) {
          setUser(updatedUserData);
        }
      }
    } catch (error) {
      console.error('[ProfileScreen] Помилка оновлення даних користувача:', error);
    }
  };
  
  // Оновлюємо дані користувача при завантаженні екрану
  useEffect(() => {
    if (user?.id) {
      refreshUserData();
    }
  }, []);
  
  // Зміна мови додатку
  const changeLanguage = async (language) => {
    try {
      console.log('Спроба змінити мову на:', language);
      
      // Перевіряємо, що мова відрізняється від поточної
      if (i18n.language === language) {
        console.log('Мова вже встановлена на:', language);
        return;
      }
      
      // Викликаємо функцію зміни мови
      const success = await setLanguage(language);
      
      if (success) {
        // Перевіряємо, чи змінилась мова
        console.log('Мова після зміни:', i18n.language);
        
        // Форсуємо оновлення компонента після зміни мови
        setForceUpdate(prev => !prev);
        
        // Додаткова перевірка для англійської мови
        if (language === 'en' && i18n.language !== 'en') {
          console.log('Додаткова спроба змінити мову на англійську');
          // Пряма зміна мови через i18n
          i18n.changeLanguage('en');
          setTimeout(() => setForceUpdate(prev => !prev), 100);
        }
      }
    } catch (error) {
      console.error('Помилка при зміні мови:', error);
    }
  };
  
  // Вихід з системи
  const handleLogout = async () => {
    Alert.alert(
      t('profile.logout_confirm_title'),
      t('profile.logout_confirm_message'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('profile.logout'),
          onPress: async () => {
            await logout();
          },
          style: 'destructive'
        }
      ]
    );
  };
  
  // Обробник зміни налаштувань темної теми
  const handleDarkModeChange = async (value) => {
    try {
      setSavingAppearance(true);
      setDarkMode(value);
      
      const token = await getToken();
      const success = await updateAppearanceSettings(user.id, { darkMode: value }, token);
      
      if (success) {
        // Оновлюємо локальні налаштування
        setSettings(prev => ({
          ...prev,
          appearance: {
            ...prev.appearance,
            darkMode: value
          }
        }));
      } else {
        // Якщо не вдалося зберегти, повертаємо попереднє значення
        setDarkMode(!value);
        Alert.alert(t('common.error'), t('profile.settings_save_error'));
      }
    } catch (error) {
      console.error('[ProfileScreen] Помилка зміни теми:', error);
      setDarkMode(!value);
      Alert.alert(t('common.error'), t('profile.settings_save_error'));
    } finally {
      setSavingAppearance(false);
    }
  };
  
  // Обробник збереження налаштувань сповіщень
  const handleSaveNotifications = async (notificationSettings) => {
    try {
      setSavingNotifications(true);
      
      const token = await getToken();
      const success = await updateNotificationSettings(user.id, notificationSettings, token);
      
      if (success) {
        // Оновлюємо локальні налаштування
        setSettings(prev => ({
          ...prev,
          notifications: {
            ...prev.notifications,
            ...notificationSettings
          }
        }));
        
        Alert.alert(t('common.success'), t('profile.settings_saved'));
      } else {
        Alert.alert(t('common.error'), t('profile.settings_save_error'));
      }
    } catch (error) {
      console.error('[ProfileScreen] Помилка збереження налаштувань сповіщень:', error);
      Alert.alert(t('common.error'), t('profile.settings_save_error'));
    } finally {
      setSavingNotifications(false);
    }
  };
  
  // Обробник збереження налаштувань інтеграцій
  const handleSaveIntegrations = async (integrationSettings) => {
    try {
      setSavingIntegrations(true);
      
      const token = await getToken();
      const success = await updateIntegrationSettings(user.id, integrationSettings, token);
      
      if (success) {
        // Оновлюємо локальні налаштування
        setSettings(prev => ({
          ...prev,
          integrations: {
            ...prev.integrations,
            ...integrationSettings
          }
        }));
        
        Alert.alert(t('common.success'), t('profile.settings_saved'));
      } else {
        Alert.alert(t('common.error'), t('profile.settings_save_error'));
      }
    } catch (error) {
      console.error('[ProfileScreen] Помилка збереження налаштувань інтеграцій:', error);
      Alert.alert(t('common.error'), t('profile.settings_save_error'));
    } finally {
      setSavingIntegrations(false);
    }
  };
  
  // Обробник підключення Telegram
  const handleConnectTelegram = async (username) => {
    try {
      setSavingIntegrations(true);
      
      const token = await getToken();
      const success = await connectTelegram(user.id, username, token);
      
      if (success) {
        // Оновлюємо локальні налаштування
        setSettings(prev => ({
          ...prev,
          integrations: {
            ...prev.integrations,
            telegramConnected: true,
            telegramUsername: username
          }
        }));
        
        Alert.alert(t('common.success'), t('profile.connect_success'));
      } else {
        Alert.alert(t('common.error'), t('profile.connect_error'));
      }
    } catch (error) {
      console.error('[ProfileScreen] Помилка підключення Telegram:', error);
      Alert.alert(t('common.error'), t('profile.connect_error'));
    } finally {
      setSavingIntegrations(false);
    }
  };
  
  // Обробник відключення Telegram
  const handleDisconnectTelegram = async () => {
    try {
      setSavingIntegrations(true);
      
      const token = await getToken();
      const success = await disconnectTelegram(user.id, token);
      
      if (success) {
        // Оновлюємо локальні налаштування
        setSettings(prev => ({
          ...prev,
          integrations: {
            ...prev.integrations,
            telegramConnected: false,
            telegramUsername: ''
          }
        }));
        
        Alert.alert(t('common.success'), t('profile.disconnect_success'));
      } else {
        Alert.alert(t('common.error'), t('profile.disconnect_error'));
      }
    } catch (error) {
      console.error('[ProfileScreen] Помилка відключення Telegram:', error);
      Alert.alert(t('common.error'), t('profile.disconnect_error'));
    } finally {
      setSavingIntegrations(false);
    }
  };
  
  // Обробник підключення Viber
  const handleConnectViber = async (username) => {
    try {
      setSavingIntegrations(true);
      
      const token = await getToken();
      const success = await connectViber(user.id, username, token);
      
      if (success) {
        // Оновлюємо локальні налаштування
        setSettings(prev => ({
          ...prev,
          integrations: {
            ...prev.integrations,
            viberConnected: true,
            viberUsername: username
          }
        }));
        
        Alert.alert(t('common.success'), t('profile.connect_success'));
      } else {
        Alert.alert(t('common.error'), t('profile.connect_error'));
      }
    } catch (error) {
      console.error('[ProfileScreen] Помилка підключення Viber:', error);
      Alert.alert(t('common.error'), t('profile.connect_error'));
    } finally {
      setSavingIntegrations(false);
    }
  };
  
  // Обробник відключення Viber
  const handleDisconnectViber = async () => {
    try {
      setSavingIntegrations(true);
      
      const token = await getToken();
      const success = await disconnectViber(user.id, token);
      
      if (success) {
        // Оновлюємо локальні налаштування
        setSettings(prev => ({
          ...prev,
          integrations: {
            ...prev.integrations,
            viberConnected: false,
            viberUsername: ''
          }
        }));
        
        Alert.alert(t('common.success'), t('profile.disconnect_success'));
      } else {
        Alert.alert(t('common.error'), t('profile.disconnect_error'));
      }
    } catch (error) {
      console.error('[ProfileScreen] Помилка відключення Viber:', error);
      Alert.alert(t('common.error'), t('profile.disconnect_error'));
    } finally {
      setSavingIntegrations(false);
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      {/* Картка профілю */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={80} color="#1976d2" />
        </View>
        <Text style={styles.userName}>{userData.name}</Text>
        <Text style={styles.userEmail}>{userData.email}</Text>
        <Text style={styles.userRole}>{userData.role}</Text>
      </View>
      
      {/* Особисті дані */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('profile.personal_info')}</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('profile.name')}:</Text>
          <Text style={styles.value}>{userData.name}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('profile.email')}:</Text>
          <Text style={styles.value}>{userData.email}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('profile.phone')}:</Text>
          <Text style={styles.value}>{userData.phone}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('profile.role')}:</Text>
          <Text style={styles.value}>{userData.role}</Text>
        </View>
        
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>{t('profile.edit_profile')}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Налаштування сповіщень */}
      {settings && (
        <NotificationSettings 
          settings={settings.notifications}
          onSave={handleSaveNotifications}
          loading={savingNotifications}
        />
      )}
      
      {/* Налаштування інтеграцій */}
      {settings && (
        <IntegrationSettings 
          settings={settings.integrations}
          onSave={handleSaveIntegrations}
          onConnectTelegram={handleConnectTelegram}
          onDisconnectTelegram={handleDisconnectTelegram}
          onConnectViber={handleConnectViber}
          onDisconnectViber={handleDisconnectViber}
          loading={savingIntegrations}
        />
      )}
      
      {/* Загальні налаштування */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>{t('profile.dark_mode')}</Text>
            <Text style={styles.settingDescription}>{t('profile.dark_mode_desc')}</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={handleDarkModeChange}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={darkMode ? '#1976d2' : '#f4f3f4'}
            disabled={savingAppearance}
          />
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>{t('profile.language')}</Text>
            <Text style={styles.settingDescription}>{t('profile.language_desc')}</Text>
          </View>
        </View>
        
        {/* Новий компонент для зміни мови без перезавантаження */}
        <DirectLanguageSwitcher />
      </View>
      
      {/* Кнопка виходу */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.logoutIcon} />
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
      
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Avtoservis v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    padding: 16
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 20
  },
  avatarContainer: {
    marginBottom: 10
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333'
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
    marginTop: 4
  },
  userRole: {
    fontSize: 14,
    color: '#1976d2',
    marginTop: 4,
    fontWeight: '500'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333'
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  label: {
    fontSize: 15,
    color: '#666',
    flex: 1
  },
  value: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right'
  },
  editButton: {
    backgroundColor: '#1976d2',
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
    marginTop: 16
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 10
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333'
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2
  },
  languageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  languageButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    marginHorizontal: 5
  },
  activeLanguage: {
    backgroundColor: '#1976d2'
  },
  languageText: {
    color: '#333'
  },
  activeLanguageText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  logoutButton: {
    backgroundColor: '#c62828',
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
    marginVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  logoutIcon: {
    marginRight: 8
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  versionContainer: {
    alignItems: 'center',
    marginBottom: 30
  },
  versionText: {
    color: '#999',
    fontSize: 12
  }
});

export default ProfileScreen;
