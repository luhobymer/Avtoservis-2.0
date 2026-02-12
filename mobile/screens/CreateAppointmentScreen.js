import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { getUserVehicles } from '../api/vehiclesApi';
import { createAppointment, listMyMechanics } from '../api/appointmentsService';
import { getAllServices } from '../api/servicesApi';
import { getMasterAvailability } from '../api/scheduleService';
import { createAppointmentReminder } from '../api/notificationsService';
import { getUserSettings } from '../api/userSettingsService';
import { listMasters } from '../api/mastersApi';
import AppointmentDateTimePicker from '../components/AppointmentDateTimePicker';

const filterServicesByType = (list, type) => {
  if (!Array.isArray(list)) return [];
  if (type === 'service') {
    return list.filter(item => item.category === 'Технічне обслуговування');
  }
  if (type === 'diagnostics') {
    return list.filter(item => item.category === 'Діагностика');
  }
  if (type === 'repair') {
    return list.filter(item => item.category !== 'Технічне обслуговування' && item.category !== 'Діагностика');
  }
  return list;
};

const getRelationshipStatusLabel = (status) => {
  switch (status) {
    case 'pending':
      return 'Запрошено';
    case 'accepted':
      return 'Активний';
    case 'rejected':
      return 'Відхилено';
    default:
      return status || '';
  }
};

export default function CreateAppointmentScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { user, getToken } = useAuth();
  const initialType = route.params?.type || 'service';
  
  // Стани для форми
  const [vehicles, setVehicles] = useState([]);
  const [masters, setMasters] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [services, setServices] = useState([]);
  const [masterCity, setMasterCity] = useState((user?.city || '').trim());
  const [formData, setFormData] = useState({
    vehicleVin: '',
    masterId: '',
    serviceIds: [],
    serviceType: initialType,
    notes: '',
    appointmentDate: null,
    appointmentTime: null
  });
  
  // Стани для завантаження
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [mastersMode, setMastersMode] = useState('all'); // 'all' or 'my'

  // Завантаження даних при монтуванні компонента
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        
        // Отримуємо автомобілі користувача
        const vehiclesData = await getUserVehicles(user?.id);
        setVehicles(vehiclesData || []);
        
        // Встановлюємо перший автомобіль за замовчуванням
        if (vehiclesData && vehiclesData.length > 0) {
          setFormData(prev => ({ ...prev, vehicleVin: vehiclesData[0].vin || vehiclesData[0].id }));
        }
        
        // Отримуємо список майстрів
        await fetchMasters(token, masterCity);

        const servicesData = await getAllServices();
        const normalizedServices = Array.isArray(servicesData) ? servicesData : [];
        setServices(normalizedServices);
      if (normalizedServices.length > 0) {
        const filtered = filterServicesByType(normalizedServices, initialType);
        const firstService = (filtered.length > 0 ? filtered : normalizedServices)[0];
        setFormData(prev => ({ ...prev, serviceIds: firstService ? [firstService.id] : [] }));
      }
      } catch (error) {
        console.error('[CreateAppointmentScreen] Помилка при отриманні даних:', error);
        Alert.alert(t('common.error'), t('appointments.fetch_data_error'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!masterCity && (user?.city || '').trim()) {
      setMasterCity((user?.city || '').trim());
    }
  }, [user?.city]);

  useEffect(() => {
    const refresh = async () => {
      try {
        const token = await getToken();
        await fetchMasters(token, masterCity);
      } catch (error) {
        console.error('[CreateAppointmentScreen] Помилка при оновленні майстрів:', error);
      }
    };

    refresh();
  }, [masterCity, mastersMode]);
  
  // Отримання списку майстрів
  const fetchMasters = async (token, city) => {
    try {
      let mastersData = [];
      if (mastersMode === 'my') {
         const myMechanics = await listMyMechanics(token);
         // Filter by city if needed, or show all my mechanics
         mastersData = myMechanics.map(m => ({
           id: m.mechanic_id, // Note: response from getClientMechanics has mechanic_id
           name: m.name || m.email || '',
           specialization: getRelationshipStatusLabel(m.status),
           isMy: true
         }));
      } else {
        const data = await listMasters(city ? { city } : undefined);
        mastersData = Array.isArray(data)
          ? data.map(m => ({
              id: m.id,
              name: `${m.first_name || m.name || ''} ${m.last_name || ''}`.trim() || m.name || '',
              specialization: m.specialization || ''
            }))
          : [];
      }
      
      setMasters(mastersData);
      if (mastersData.length > 0) {
        // Only reset masterId if current selection is not in new list
        const currentStillExists = mastersData.find(m => m.id === formData.masterId);
        if (!currentStillExists) {
           setFormData(prev => ({ ...prev, masterId: mastersData[0].id }));
        }
      } else {
        setFormData(prev => ({ ...prev, masterId: '' }));
      }
    } catch (error) {
      console.error('[CreateAppointmentScreen] Помилка при отриманні майстрів:', error);
      setMasters([]);
      setFormData(prev => ({ ...prev, masterId: '' }));
    }
  };
  
  // Отримання доступних слотів часу для вибраного майстра та дати
  const fetchAvailableSlots = async (date) => {
    try {
      setLoadingSlots(true);
      const token = await getToken();
      
      if (!formData.masterId || !date) {
        setAvailableSlots([]);
        return;
      }
      
      const slots = await getMasterAvailability(formData.masterId, date, token);
      setAvailableSlots(slots);
    } catch (error) {
      console.error('[CreateAppointmentScreen] Помилка при отриманні доступних слотів:', error);
      Alert.alert(t('common.error'), t('appointments.fetch_slots_error'));
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };
  
  // Обробник зміни дати
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setFormData(prev => ({ ...prev, appointmentDate: date, appointmentTime: null }));
    fetchAvailableSlots(date);
  };
  
  // Обробник вибору дати та часу
  const handleDateTimeSelected = (dateTime, time) => {
    setFormData(prev => ({ ...prev, appointmentDate: dateTime, appointmentTime: time }));
  };
  
  // Обробник зміни поля форми
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Якщо змінився майстер, оновлюємо доступні слоти
    if (field === 'masterId' && selectedDate) {
      fetchAvailableSlots(selectedDate);
    }
  };
  
  const toggleServiceSelection = (serviceId) => {
    setFormData(prev => {
      const id = String(serviceId);
      const exists = (prev.serviceIds || []).map(String).includes(id);
      const nextIds = exists
        ? (prev.serviceIds || []).filter(sid => String(sid) !== id)
        : [...(prev.serviceIds || []), serviceId];
      return { ...prev, serviceIds: nextIds };
    });
  };
  
  // Обробник відправки форми
  const handleSubmit = async () => {
    // Перевірка заповнення всіх полів
    if (!formData.vehicleVin) {
      Alert.alert(t('common.error'), t('appointments.no_vehicle_error'));
      return;
    }
    
    if (!formData.masterId) {
      Alert.alert(t('common.error'), t('appointments.no_master_error'));
      return;
    }
    
    if (!formData.appointmentDate || !formData.appointmentTime) {
      Alert.alert(t('common.error'), t('appointments.no_date_time_error'));
      return;
    }

    if (!Array.isArray(formData.serviceIds) || formData.serviceIds.length === 0) {
      Alert.alert(t('common.error'), t('appointments.no_service_selected_error'));
      return;
    }
    
    try {
      setSubmitting(true);
      const token = await getToken();
      
      // Отримуємо налаштування користувача
      const userSettings = await getUserSettings(user.id, token);
      
      // Формуємо дату та час запису
      const appointmentDateTime = new Date(formData.appointmentDate);
      const [hours, minutes] = formData.appointmentTime.split(':');
      appointmentDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10));
      const normalizedServiceIds = (formData.serviceIds || [])
        .map(id => (id == null ? '' : String(id).trim()))
        .filter(Boolean);
      const primaryServiceId = normalizedServiceIds[0] || null;
      
      // Створюємо запис на ремонт
      const appointmentData = {
        user_id: user.id,
        vehicle_vin: formData.vehicleVin,
        mechanic_id: formData.masterId,
        service_id: primaryServiceId,
        service_ids: normalizedServiceIds,
        service_type: formData.serviceType,
        notes: formData.notes,
        scheduled_time: appointmentDateTime.toISOString(),
        status: 'pending'
      };
      
      const result = await createAppointment(appointmentData, token);
      
      if (result && result.id) {
        // Створюємо нагадування про запис, якщо увімкнено в налаштуваннях
        if (userSettings.notifications?.appointmentReminders !== false) {
          await createAppointmentReminder(result, user.id, token);
        }
        
        // Показуємо повідомлення про успіх
        Alert.alert(
          t('appointments.success_title'),
          t('appointments.success_message'),
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Appointments')
            }
          ]
        );
      } else {
        throw new Error('Failed to create appointment');
      }
    } catch (error) {
      console.error('[CreateAppointmentScreen] Помилка при створенні запису:', error);
      Alert.alert(t('common.error'), t('appointments.create_error'));
    } finally {
      setSubmitting(false);
    }
  };
  
  // Отримання назви типу сервісу
  const getServiceTypeName = (type) => {
    const types = {
      'service': t('appointments.service_type.maintenance'),
      'repair': t('appointments.service_type.repair'),
      'diagnostics': t('appointments.service_type.diagnostics'),
      'other': t('appointments.service_type.other')
    };
    return types[type] || types.other;
  };

  const availableServices = filterServicesByType(services, initialType);
  const selectedServices = availableServices.filter(s => (formData.serviceIds || []).map(String).includes(String(s.id)));
  const totalPrice = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>{t('appointments.vehicle_info')}</Text>
          
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.vehicleVin}
              onValueChange={(value) => handleChange('vehicleVin', value)}
              mode="dropdown"
              style={styles.picker}
            >
              {vehicles.length === 0 && (
                <Picker.Item 
                  label={t('appointments.no_vehicles')} 
                  value="" 
                  enabled={false}
                />
              )}
              {vehicles.map(vehicle => (
                <Picker.Item 
                  key={vehicle.id} 
                  label={`${vehicle.make} ${vehicle.model} (${vehicle.year}) • ${vehicle.vin || vehicle.id}`} 
                  value={vehicle.vin || vehicle.id} 
                />
              ))}
            </Picker>
          </View>
          
          {vehicles.length === 0 && (
            <TouchableOpacity
              style={styles.addVehicleButton}
              onPress={() => navigation.navigate('AddVehicle')}
            >
              <Text style={styles.addVehicleButtonText}>{t('vehicles.add')}</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.sectionTitle}>{t('appointments.service_info')}</Text>
          
          <View style={styles.servicesList}>
            {availableServices.length === 0 ? (
              <Text style={styles.noItemsText}>{t('appointments.no_services')}</Text>
            ) : (
              availableServices.map(service => {
                const selected = (formData.serviceIds || []).map(String).includes(String(service.id));
                return (
                  <TouchableOpacity
                    key={service.id}
                    style={[styles.serviceItem, selected && styles.serviceItemSelected]}
                    onPress={() => toggleServiceSelection(service.id)}
                  >
                    <View style={styles.serviceItemHeader}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      {selected && <Ionicons name="checkmark-circle" size={20} color="#4caf50" />}
                    </View>
                    {service.price != null && (
                      <Text style={styles.serviceMeta}>
                        {t('appointments.service_price')}: {service.price}
                      </Text>
                    )}
                    {service.duration != null && (
                      <Text style={styles.serviceMeta}>
                        {t('appointments.service_duration')}: {service.duration} {t('appointments.minutes_short')}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {selectedServices.length > 0 && (
            <View style={styles.serviceDetailsContainer}>
              <Text style={styles.serviceDetailsText}>
                {t('appointments.selected_count', 'Вибрано')}: {selectedServices.length}
              </Text>
              <Text style={styles.serviceDetailsText}>
                {t('appointments.total_price', 'Сума')}: {totalPrice}
              </Text>
              {Number.isFinite(totalDuration) && totalDuration > 0 && (
                <Text style={styles.serviceDetailsText}>
                  {t('appointments.total_duration', 'Тривалість')}: {totalDuration} {t('appointments.minutes_short')}
                </Text>
              )}
            </View>
          )}
          
          <Text style={styles.sectionTitle}>{t('appointments.master_info')}</Text>

          <View style={styles.masterModeContainer}>
            <TouchableOpacity 
              style={[styles.modeButton, mastersMode === 'all' && styles.activeModeButton]}
              onPress={() => setMastersMode('all')}
            >
              <Text style={[styles.modeButtonText, mastersMode === 'all' && styles.activeModeButtonText]}>
                {t('common.all_masters', 'Всі майстри')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modeButton, mastersMode === 'my' && styles.activeModeButton]}
              onPress={() => setMastersMode('my')}
            >
              <Text style={[styles.modeButtonText, mastersMode === 'my' && styles.activeModeButtonText]}>
                {t('common.my_masters', 'Мої майстри')}
              </Text>
            </TouchableOpacity>
          </View>

          {mastersMode === 'all' && (
            <TextInput
              style={styles.input}
              value={masterCity}
              onChangeText={(text) => setMasterCity(text)}
              placeholder={t('profile.city', 'Місто')}
            />
          )}
          
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.masterId}
              onValueChange={(value) => handleChange('masterId', value)}
              mode="dropdown"
              style={styles.picker}
            >
              {masters.length === 0 && (
                <Picker.Item 
                  label={t('appointments.no_masters')} 
                  value="" 
                  enabled={false}
                />
              )}
          {masters.map(master => {
            const suffix = master.specialization ? ` (${master.specialization})` : '';
            return (
                <Picker.Item 
                  key={master.id} 
              label={`${master.name}${suffix}`} 
                  value={master.id} 
                />
            );
          })}
            </Picker>
          </View>
          
          <Text style={styles.sectionTitle}>{t('appointments.date_time')}</Text>
          
          <AppointmentDateTimePicker
            onDateTimeSelected={handleDateTimeSelected}
            availableSlots={availableSlots}
            onDateChange={handleDateChange}
            selectedDate={selectedDate}
            selectedTime={formData.appointmentTime}
            loading={loadingSlots}
          />
          
          <Text style={styles.sectionTitle}>{t('appointments.notes')}</Text>
          
          <TextInput
            style={styles.notesInput}
            value={formData.notes}
            onChangeText={(text) => handleChange('notes', text)}
            placeholder={t('appointments.notes_placeholder')}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>{t('appointments.create')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    flexGrow: 1,
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
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 8,
    marginTop: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
  },
  picker: {
    height: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    fontSize: 16,
  },
  addVehicleButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addVehicleButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    backgroundColor: '#f5f5f5',
    minHeight: 100,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  serviceDetailsContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  serviceDetailsText: {
    fontSize: 14,
    color: '#424242',
  },
  servicesList: {
    marginBottom: 8,
  },
  noItemsText: {
    fontSize: 14,
    color: '#757575',
    padding: 8,
  },
  serviceItem: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  serviceItemSelected: {
    borderColor: '#4caf50',
    backgroundColor: '#e8f5e9',
  },
  serviceItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
  },
  serviceMeta: {
    fontSize: 13,
    color: '#616161',
  },
  masterModeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeModeButton: {
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  modeButtonText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  activeModeButtonText: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
});
