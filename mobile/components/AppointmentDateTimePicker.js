import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator 
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';

/**
 * Компонент для вибору дати та часу запису на обслуговування
 * @param {Object} props - Властивості компонента
 * @param {Function} props.onDateTimeSelected - Функція, яка викликається при виборі дати та часу
 * @param {Array} props.availableSlots - Масив доступних слотів часу
 * @param {Function} props.onDateChange - Функція, яка викликається при зміні дати
 * @param {string} props.selectedDate - Вибрана дата (ISO string)
 * @param {string} props.selectedTime - Вибраний час
 * @param {boolean} props.loading - Індикатор завантаження
 */
const AppointmentDateTimePicker = ({ 
  onDateTimeSelected, 
  availableSlots = [], 
  onDateChange, 
  selectedDate, 
  selectedTime,
  loading = false
}) => {
  const { t } = useTranslation();
  const [markedDates, setMarkedDates] = useState({});
  
  // Встановлюємо вибрану дату в календарі
  useEffect(() => {
    if (selectedDate) {
      const dateString = selectedDate.split('T')[0];
      setMarkedDates({
        [dateString]: { selected: true, selectedColor: '#1976d2' }
      });
    }
  }, [selectedDate]);

  // Обробник вибору дати
  const handleDateSelect = (date) => {
    const newDate = new Date(date.dateString);
    newDate.setHours(12, 0, 0, 0); // Встановлюємо час на полудень
    
    // Викликаємо функцію зміни дати
    onDateChange(newDate.toISOString());
    
    // Оновлюємо виділену дату в календарі
    setMarkedDates({
      [date.dateString]: { selected: true, selectedColor: '#1976d2' }
    });
  };

  // Обробник вибору часу
  const handleTimeSelect = (time) => {
    if (!selectedDate) return;
    
    // Створюємо дату з вибраними датою та часом
    const [hours, minutes] = time.split(':');
    const dateTime = new Date(selectedDate);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    // Викликаємо функцію вибору дати та часу
    onDateTimeSelected(dateTime.toISOString(), time);
  };

  // Відображення слотів часу
  const renderTimeSlots = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1976d2" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      );
    }
    
    if (!availableSlots || availableSlots.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('appointments.no_available_slots')}</Text>
        </View>
      );
    }
    
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeSlotsContainer}
      >
        {availableSlots.map((slot, index) => (
          <TouchableOpacity
            key={`${slot.time}-${index}`}
            style={[
              styles.timeSlot,
              !slot.available && styles.disabledTimeSlot,
              selectedTime === slot.time && styles.selectedTimeSlot
            ]}
            onPress={() => slot.available && handleTimeSelect(slot.time)}
            disabled={!slot.available}
          >
            <Text 
              style={[
                styles.timeSlotText,
                !slot.available && styles.disabledTimeSlotText,
                selectedTime === slot.time && styles.selectedTimeSlotText
              ]}
            >
              {slot.time}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.calendarContainer}>
        <Calendar
          onDayPress={handleDateSelect}
          markedDates={markedDates}
          firstDay={1} // Понеділок як перший день тижня
          minDate={new Date().toISOString()}
          maxDate={new Date(new Date().setDate(new Date().getDate() + 30)).toISOString()} // 30 днів вперед
          monthFormat={'MMMM yyyy'}
          hideExtraDays={true}
          disableAllTouchEventsForDisabledDays={true}
          enableSwipeMonths={true}
          theme={{
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#b6c1cd',
            selectedDayBackgroundColor: '#1976d2',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#1976d2',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: '#1976d2',
            selectedDotColor: '#ffffff',
            arrowColor: '#1976d2',
            monthTextColor: '#2d4150',
            indicatorColor: '#1976d2',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 14
          }}
        />
      </View>
      
      {selectedDate && (
        <View style={styles.timeSlotsSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color="#1976d2" />
            <Text style={styles.sectionTitle}>{t('appointments.select_time')}</Text>
          </View>
          {renderTimeSlots()}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  calendarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeSlotsSection: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    color: '#212121',
  },
  timeSlotsContainer: {
    paddingVertical: 8,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  timeSlotText: {
    fontSize: 14,
    color: '#212121',
  },
  disabledTimeSlot: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  disabledTimeSlotText: {
    color: '#9e9e9e',
  },
  selectedTimeSlot: {
    backgroundColor: '#1976d2',
  },
  selectedTimeSlotText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    color: '#757575',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    color: '#757575',
    fontSize: 14,
  },
});

export default AppointmentDateTimePicker;
