import React, { useState } from 'react';
import { 
  View, 
  Modal, 
  StyleSheet, 
  TouchableOpacity, 
  Text, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

/**
 * Модальне вікно для відповіді на запит пробігу
 * @param {Object} props - властивості компонента
 * @param {boolean} props.visible - чи відображати модальне вікно
 * @param {Function} props.onClose - функція, яка викликається при закритті вікна
 * @param {Function} props.onSubmit - функція, яка викликається при відправці пробігу
 * @param {Object} props.vehicle - дані автомобіля
 * @param {number} props.currentMileage - поточний пробіг автомобіля
 */
const MileageRequestModal = ({ 
  visible, 
  onClose, 
  onSubmit, 
  vehicle, 
  currentMileage = 0 
}) => {
  const { t } = useTranslation();
  const [mileage, setMileage] = useState(currentMileage.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      
      // Валідація пробігу
      const mileageValue = parseInt(mileage, 10);
      if (isNaN(mileageValue) || mileageValue < 0 || mileageValue > 1000000) {
        setError(t('validation.invalid_mileage'));
        return;
      }
      
      // Якщо новий пробіг менший за поточний, виводимо попередження
      if (mileageValue < currentMileage) {
        setError(t('reminders.mileage_request.error_less_than_current'));
        return;
      }
      
      setLoading(true);
      
      // Викликаємо функцію відправки пробігу
      await onSubmit(mileageValue);
      
      // Закриваємо модальне вікно
      onClose();
    } catch (error) {
      console.error('Помилка при відправці пробігу:', error);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!vehicle) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('reminders.mileage_request.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#757575" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.message}>
            {t('reminders.mileage_request.message', { vehicle: vehicle.make + ' ' + vehicle.model })}
          </Text>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={mileage}
              onChangeText={setMileage}
              keyboardType="numeric"
              placeholder={t('vehicles.mileage')}
              placeholderTextColor="#9e9e9e"
              maxLength={7}
            />
            <Text style={styles.unitText}>{t('common.km')}</Text>
          </View>
          
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
          
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {t('reminders.mileage_request.submit')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
  },
  closeButton: {
    padding: 4,
  },
  message: {
    fontSize: 16,
    color: '#424242',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#212121',
    backgroundColor: '#f5f5f5',
  },
  unitText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#757575',
  },
  errorText: {
    color: '#c62828',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default MileageRequestModal;
