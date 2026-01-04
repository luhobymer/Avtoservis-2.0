import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Switch, 
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

/**
 * Компонент налаштувань сповіщень
 * @param {Object} props - Властивості компонента
 * @param {Object} props.settings - Поточні налаштування сповіщень
 * @param {Function} props.onSave - Функція для збереження налаштувань
 * @param {boolean} props.loading - Індикатор завантаження
 */
const NotificationSettings = ({ settings, onSave, loading = false }) => {
  const { t } = useTranslation();
  
  // Локальний стан для налаштувань
  const [localSettings, setLocalSettings] = useState({
    pushEnabled: true,
    emailEnabled: true,
    appointmentReminders: true,
    reminderTime: 'hours_3'
  });
  
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
  
  // Обробник зміни часу нагадування
  const handleReminderTimeChange = (value) => {
    setLocalSettings(prev => ({
      ...prev,
      reminderTime: value
    }));
  };
  
  // Обробник збереження налаштувань
  const handleSave = () => {
    onSave(localSettings);
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('profile.notifications')}</Text>
      
      {/* Push-сповіщення */}
      <View style={styles.settingRow}>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingLabel}>{t('profile.push_notifications')}</Text>
          <Text style={styles.settingDescription}>{t('profile.push_notifications_desc')}</Text>
        </View>
        <Switch
          value={localSettings.pushEnabled}
          onValueChange={() => handleToggle('pushEnabled')}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={localSettings.pushEnabled ? '#1976d2' : '#f4f3f4'}
        />
      </View>
      
      {/* Email-сповіщення */}
      <View style={styles.settingRow}>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingLabel}>{t('profile.email_notifications')}</Text>
          <Text style={styles.settingDescription}>{t('profile.email_notifications_desc')}</Text>
        </View>
        <Switch
          value={localSettings.emailEnabled}
          onValueChange={() => handleToggle('emailEnabled')}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={localSettings.emailEnabled ? '#1976d2' : '#f4f3f4'}
        />
      </View>
      
      {/* Нагадування про записи */}
      <View style={styles.settingRow}>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingLabel}>{t('profile.appointment_reminders')}</Text>
          <Text style={styles.settingDescription}>{t('profile.appointment_reminders_desc')}</Text>
        </View>
        <Switch
          value={localSettings.appointmentReminders}
          onValueChange={() => handleToggle('appointmentReminders')}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={localSettings.appointmentReminders ? '#1976d2' : '#f4f3f4'}
        />
      </View>
      
      {/* Час нагадування */}
      {localSettings.appointmentReminders && (
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>{t('profile.reminder_time')}</Text>
          <Text style={styles.pickerDescription}>{t('profile.reminder_time_desc')}</Text>
          <View style={styles.picker}>
            <Picker
              selectedValue={localSettings.reminderTime}
              onValueChange={handleReminderTimeChange}
              mode="dropdown"
            >
              <Picker.Item 
                label={t('profile.reminder_times.day_before')} 
                value="day_before" 
              />
              <Picker.Item 
                label={t('profile.reminder_times.hours_12')} 
                value="hours_12" 
              />
              <Picker.Item 
                label={t('profile.reminder_times.hours_3')} 
                value="hours_3" 
              />
              <Picker.Item 
                label={t('profile.reminder_times.hour_1')} 
                value="hour_1" 
              />
              <Picker.Item 
                label={t('profile.reminder_times.minutes_30')} 
                value="minutes_30" 
              />
            </Picker>
          </View>
        </View>
      )}
      
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
  pickerContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333'
  },
  pickerDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    marginBottom: 8
  },
  picker: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginTop: 8
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
  }
});

export default NotificationSettings;
