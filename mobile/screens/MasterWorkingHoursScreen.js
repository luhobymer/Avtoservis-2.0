import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getMasterWorkingHours, updateMasterWorkingHours } from '../api/scheduleService';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function MasterWorkingHoursScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingHours, setWorkingHours] = useState({});
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentDay, setCurrentDay] = useState(null);
  const [currentTimeType, setCurrentTimeType] = useState(null); // 'start' або 'end'
  const [currentTime, setCurrentTime] = useState(new Date());

  // Завантаження робочих годин майстра
  useEffect(() => {
    const fetchWorkingHours = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const data = await getMasterWorkingHours(user.id, token);
        setWorkingHours(data);
      } catch (error) {
        console.error('[MasterWorkingHoursScreen] Помилка при отриманні робочих годин:', error);
        Alert.alert(t('common.error'), t('master.working_hours_fetch_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchWorkingHours();
  }, []);

  // Обробник зміни статусу робочого дня
  const handleWorkingDayChange = (day, value) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        is_working_day: value
      }
    }));
  };

  // Обробник відкриття вибору часу
  const handleTimePickerOpen = (day, type) => {
    setCurrentDay(day);
    setCurrentTimeType(type);
    
    // Встановлюємо поточний час для вибору
    const timeString = workingHours[day][`${type}_time`];
    const [hours, minutes] = timeString.split(':').map(Number);
    
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    
    setCurrentTime(date);
    setShowTimePicker(true);
  };

  // Обробник зміни часу
  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    
    if (selectedTime && currentDay && currentTimeType) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      setWorkingHours(prev => ({
        ...prev,
        [currentDay]: {
          ...prev[currentDay],
          [`${currentTimeType}_time`]: timeString
        }
      }));
    }
  };

  // Обробник збереження робочих годин
  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await getToken();
      await updateMasterWorkingHours(user.id, workingHours, token);
      Alert.alert(t('common.success'), t('master.working_hours_save_success'));
      navigation.goBack();
    } catch (error) {
      console.error('[MasterWorkingHoursScreen] Помилка при збереженні робочих годин:', error);
      Alert.alert(t('common.error'), t('master.working_hours_save_error'));
    } finally {
      setSaving(false);
    }
  };

  // Отримання назви дня тижня
  const getDayName = (day) => {
    const days = {
      0: t('days.sunday'),
      1: t('days.monday'),
      2: t('days.tuesday'),
      3: t('days.wednesday'),
      4: t('days.thursday'),
      5: t('days.friday'),
      6: t('days.saturday')
    };
    return days[day] || '';
  };

  // Відображення робочих годин для кожного дня тижня
  const renderWorkingHours = () => {
    // Порядок днів тижня (починаючи з понеділка)
    const daysOrder = [1, 2, 3, 4, 5, 6, 0];
    
    return daysOrder.map(day => {
      const dayData = workingHours[day] || {
        start_time: '09:00',
        end_time: '18:00',
        is_working_day: day < 6 // Пн-Пт робочі дні за замовчуванням
      };
      
      return (
        <View key={day} style={styles.dayContainer}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayName}>{getDayName(day)}</Text>
            <Switch
              value={dayData.is_working_day}
              onValueChange={(value) => handleWorkingDayChange(day, value)}
              trackColor={{ false: '#e0e0e0', true: '#bbdefb' }}
              thumbColor={dayData.is_working_day ? '#1976d2' : '#f5f5f5'}
            />
          </View>
          
          <View style={[
            styles.timeContainer,
            !dayData.is_working_day && styles.disabledTimeContainer
          ]}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>{t('master.start_time')}</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => handleTimePickerOpen(day, 'start')}
                disabled={!dayData.is_working_day}
              >
                <Ionicons name="time-outline" size={18} color={dayData.is_working_day ? '#1976d2' : '#9e9e9e'} />
                <Text style={[
                  styles.timeText,
                  !dayData.is_working_day && styles.disabledTimeText
                ]}>
                  {dayData.start_time}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.timeSeparator}>
              <Text style={styles.timeSeparatorText}>—</Text>
            </View>
            
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>{t('master.end_time')}</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => handleTimePickerOpen(day, 'end')}
                disabled={!dayData.is_working_day}
              >
                <Ionicons name="time-outline" size={18} color={dayData.is_working_day ? '#1976d2' : '#9e9e9e'} />
                <Text style={[
                  styles.timeText,
                  !dayData.is_working_day && styles.disabledTimeText
                ]}>
                  {dayData.end_time}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>{t('master.working_hours_title')}</Text>
          <Text style={styles.headerDescription}>{t('master.working_hours_description')}</Text>
        </View>
        
        <View style={styles.workingHoursContainer}>
          {renderWorkingHours()}
        </View>
        
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      
      {showTimePicker && (
        <DateTimePicker
          value={currentTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
  },
  headerContainer: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 14,
    color: '#757575',
  },
  workingHoursContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dayContainer: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledTimeContainer: {
    opacity: 0.6,
  },
  timeBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 16,
    color: '#212121',
    marginLeft: 8,
  },
  disabledTimeText: {
    color: '#9e9e9e',
  },
  timeSeparator: {
    paddingHorizontal: 8,
  },
  timeSeparatorText: {
    fontSize: 16,
    color: '#757575',
  },
  saveButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});
