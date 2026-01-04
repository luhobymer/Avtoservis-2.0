import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Switch, 
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

/**
 * Компонент налаштувань інтеграцій
 * @param {Object} props - Властивості компонента
 * @param {Object} props.settings - Поточні налаштування інтеграцій
 * @param {Function} props.onSave - Функція для збереження налаштувань
 * @param {Function} props.onConnectTelegram - Функція для підключення Telegram
 * @param {Function} props.onDisconnectTelegram - Функція для відключення Telegram
 * @param {Function} props.onConnectViber - Функція для підключення Viber
 * @param {Function} props.onDisconnectViber - Функція для відключення Viber
 * @param {boolean} props.loading - Індикатор завантаження
 */
const IntegrationSettings = ({ 
  settings, 
  onSave, 
  onConnectTelegram,
  onDisconnectTelegram,
  onConnectViber,
  onDisconnectViber,
  loading = false 
}) => {
  const { t } = useTranslation();
  
  // Локальний стан для налаштувань
  const [localSettings, setLocalSettings] = useState({
    calendarEnabled: false,
    telegramConnected: false,
    telegramUsername: '',
    viberConnected: false,
    viberUsername: ''
  });
  
  // Стан для модальних вікон
  const [telegramModalVisible, setTelegramModalVisible] = useState(false);
  const [viberModalVisible, setViberModalVisible] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [viberUsername, setViberUsername] = useState('');
  
  // Оновлюємо локальний стан при зміні вхідних налаштувань
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);
  
  // Обробник зміни перемикача
  const handleToggle = (key) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  // Обробник збереження налаштувань
  const handleSave = () => {
    onSave(localSettings);
  };
  
  // Обробник підключення Telegram
  const handleConnectTelegram = () => {
    setTelegramModalVisible(true);
  };
  
  // Обробник відключення Telegram
  const handleDisconnectTelegram = () => {
    Alert.alert(
      t('profile.disconnect'),
      t('profile.telegram_integration'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('profile.disconnect'),
          onPress: () => {
            onDisconnectTelegram();
          },
          style: 'destructive'
        }
      ]
    );
  };
  
  // Обробник підтвердження підключення Telegram
  const handleConfirmTelegram = () => {
    if (!telegramUsername.trim()) {
      Alert.alert(t('common.error'), t('validation.required_field'));
      return;
    }
    
    setTelegramModalVisible(false);
    onConnectTelegram(telegramUsername);
    setTelegramUsername('');
  };
  
  // Обробник підключення Viber
  const handleConnectViber = () => {
    setViberModalVisible(true);
  };
  
  // Обробник відключення Viber
  const handleDisconnectViber = () => {
    Alert.alert(
      t('profile.disconnect'),
      t('profile.viber_integration'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('profile.disconnect'),
          onPress: () => {
            onDisconnectViber();
          },
          style: 'destructive'
        }
      ]
    );
  };
  
  // Обробник підтвердження підключення Viber
  const handleConfirmViber = () => {
    if (!viberUsername.trim()) {
      Alert.alert(t('common.error'), t('validation.required_field'));
      return;
    }
    
    setViberModalVisible(false);
    onConnectViber(viberUsername);
    setViberUsername('');
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('profile.integrations')}</Text>
      
      {/* Інтеграція з календарем */}
      <View style={styles.settingRow}>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingLabel}>{t('profile.calendar_integration')}</Text>
          <Text style={styles.settingDescription}>{t('profile.calendar_integration_desc')}</Text>
        </View>
        <Switch
          value={localSettings.calendarEnabled}
          onValueChange={() => handleToggle('calendarEnabled')}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={localSettings.calendarEnabled ? '#1976d2' : '#f4f3f4'}
        />
      </View>
      
      {/* Інтеграція з Telegram */}
      <View style={styles.integrationRow}>
        <View style={styles.integrationIconContainer}>
          <Ionicons name="paper-plane" size={24} color="#0088cc" />
        </View>
        <View style={styles.integrationTextContainer}>
          <Text style={styles.integrationLabel}>{t('profile.telegram_integration')}</Text>
          <Text style={styles.integrationDescription}>{t('profile.telegram_integration_desc')}</Text>
          {localSettings.telegramConnected && (
            <View style={styles.connectedContainer}>
              <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
              <Text style={styles.connectedText}>
                {t('profile.connected')}: @{localSettings.telegramUsername}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.integrationButton,
            localSettings.telegramConnected ? styles.disconnectButton : styles.connectButton
          ]}
          onPress={localSettings.telegramConnected ? handleDisconnectTelegram : handleConnectTelegram}
          disabled={loading}
        >
          <Text style={styles.integrationButtonText}>
            {localSettings.telegramConnected ? t('profile.disconnect') : t('profile.connect')}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Інтеграція з Viber */}
      <View style={styles.integrationRow}>
        <View style={styles.integrationIconContainer}>
          <Ionicons name="chatbubble" size={24} color="#7d3daf" />
        </View>
        <View style={styles.integrationTextContainer}>
          <Text style={styles.integrationLabel}>{t('profile.viber_integration')}</Text>
          <Text style={styles.integrationDescription}>{t('profile.viber_integration_desc')}</Text>
          {localSettings.viberConnected && (
            <View style={styles.connectedContainer}>
              <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
              <Text style={styles.connectedText}>
                {t('profile.connected')}: {localSettings.viberUsername}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.integrationButton,
            localSettings.viberConnected ? styles.disconnectButton : styles.connectButton
          ]}
          onPress={localSettings.viberConnected ? handleDisconnectViber : handleConnectViber}
          disabled={loading}
        >
          <Text style={styles.integrationButtonText}>
            {localSettings.viberConnected ? t('profile.disconnect') : t('profile.connect')}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Кнопка збереження */}
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="save-outline" size={18} color="#ffffff" style={styles.saveIcon} />
            <Text style={styles.saveButtonText}>{t('profile.save_settings')}</Text>
          </>
        )}
      </TouchableOpacity>
      
      {/* Модальне вікно для підключення Telegram */}
      <Modal
        visible={telegramModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTelegramModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.telegram_integration')}</Text>
              <TouchableOpacity onPress={() => setTelegramModalVisible(false)}>
                <Ionicons name="close" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Введіть своє ім'я користувача в Telegram (без символу @)
            </Text>
            
            <TextInput
              style={styles.input}
              value={telegramUsername}
              onChangeText={setTelegramUsername}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmTelegram}
            >
              <Text style={styles.confirmButtonText}>{t('profile.connect')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Модальне вікно для підключення Viber */}
      <Modal
        visible={viberModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViberModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.viber_integration')}</Text>
              <TouchableOpacity onPress={() => setViberModalVisible(false)}>
                <Ionicons name="close" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Введіть свій номер телефону в Viber (з кодом країни)
            </Text>
            
            <TextInput
              style={styles.input}
              value={viberUsername}
              onChangeText={setViberUsername}
              placeholder="+380501234567"
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmViber}
            >
              <Text style={styles.confirmButtonText}>{t('profile.connect')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
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
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  integrationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  integrationTextContainer: {
    flex: 1
  },
  integrationLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333'
  },
  integrationDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2
  },
  connectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  connectedText: {
    fontSize: 13,
    color: '#4caf50',
    marginLeft: 4
  },
  integrationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  connectButton: {
    backgroundColor: '#1976d2'
  },
  disconnectButton: {
    backgroundColor: '#f44336'
  },
  integrationButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500'
  },
  saveButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  saveIcon: {
    marginRight: 8
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 16
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    width: '85%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20
  },
  confirmButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 16
  }
});

export default IntegrationSettings;
