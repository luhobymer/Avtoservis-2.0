import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

/**
 * Компонент кнопки для встановлення статусу зайнятості майстра
 * @param {Object} props - Властивості компонента
 * @param {boolean} props.isBusy - Поточний статус зайнятості
 * @param {string} props.busyUntil - Час до якого майстер зайнятий (ISO string)
 * @param {string} props.busyReason - Причина зайнятості
 * @param {Function} props.onStatusChange - Функція, яка викликається при зміні статусу
 */
const MasterBusyStatusButton = ({ 
  isBusy = false, 
  busyUntil = null, 
  busyReason = '', 
  onStatusChange 
}) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [endTime, setEndTime] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Встановлюємо початкові значення при відкритті модального вікна
  useEffect(() => {
    if (modalVisible) {
      if (busyUntil) {
        setEndTime(new Date(busyUntil));
      } else {
        // За замовчуванням встановлюємо час на 1 годину вперед
        const defaultEndTime = new Date();
        defaultEndTime.setHours(defaultEndTime.getHours() + 1);
        setEndTime(defaultEndTime);
      }
      
      setReason(busyReason || '');
    }
  }, [modalVisible, busyUntil, busyReason]);

  // Обробник зміни часу
  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setEndTime(selectedTime);
    }
  };

  // Обробник підтвердження статусу зайнятості
  const handleConfirm = () => {
    // Перевіряємо, що час зайнятості не менше 15 хвилин від поточного часу
    const now = new Date();
    const diffMs = endTime - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 15) {
      Alert.alert(
        t('common.error'),
        t('master.min_busy_time_error', { minutes: 15 }),
        [{ text: t('common.ok') }]
      );
      return;
    }
    
    onStatusChange(true, endTime.toISOString(), reason);
    setModalVisible(false);
  };

  // Обробник скасування статусу зайнятості
  const handleCancel = () => {
    onStatusChange(false, null, '');
    setModalVisible(false);
  };

  // Відображення часу у форматі HH:MM
  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Відображення дати у форматі DD.MM.YYYY
  const formatDate = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Відображення залишку часу
  const renderTimeRemaining = () => {
    if (!busyUntil) return null;
    
    const now = new Date();
    const end = new Date(busyUntil);
    
    // Якщо час вже минув, повертаємо null
    if (end <= now) return null;
    
    const diffMs = end - now;
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    let timeText = '';
    if (hours > 0) {
      timeText += `${hours} ${t('common.hours')} `;
    }
    if (mins > 0 || hours === 0) {
      timeText += `${mins} ${t('common.minutes')}`;
    }
    
    return (
      <Text style={styles.timeRemainingText}>
        {t('master.busy_until', { time: formatTime(end) })} ({timeText})
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      {isBusy ? (
        <TouchableOpacity 
          style={styles.busyButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="alert-circle" size={20} color="#ffffff" />
          <Text style={styles.busyButtonText}>{t('master.busy_status')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={styles.availableButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
          <Text style={styles.availableButtonText}>{t('master.available_status')}</Text>
        </TouchableOpacity>
      )}
      
      {isBusy && renderTimeRemaining()}
      
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isBusy ? t('master.change_busy_status') : t('master.set_busy_status')}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.sectionTitle}>{t('master.busy_until_time')}</Text>
            <TouchableOpacity 
              style={styles.timePickerButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color="#1976d2" />
              <Text style={styles.timePickerButtonText}>
                {formatDate(endTime)} {formatTime(endTime)}
              </Text>
            </TouchableOpacity>
            
            {showTimePicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleTimeChange}
                minimumDate={new Date()}
              />
            )}
            
            <Text style={styles.sectionTitle}>{t('master.busy_reason')}</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder={t('master.busy_reason_placeholder')}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.buttonContainer}>
              {isBusy && (
                <TouchableOpacity 
                  style={styles.cancelBusyButton}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelBusyButtonText}>{t('master.cancel_busy_status')}</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  busyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f44336',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  busyButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    marginLeft: 8,
  },
  availableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4caf50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  availableButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    marginLeft: 8,
  },
  timeRemainingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#757575',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 8,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  timePickerButtonText: {
    fontSize: 16,
    color: '#212121',
    marginLeft: 8,
  },
  reasonInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212121',
    marginBottom: 20,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelBusyButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelBusyButtonText: {
    color: '#f44336',
    fontWeight: '500',
    fontSize: 16,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 16,
  },
});

export default MasterBusyStatusButton;
