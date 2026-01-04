import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import FloatingActionButton from '../components/FloatingActionButton';
import RemindersWidget from '../components/RemindersWidget';
import MileageRequestModal from '../components/MileageRequestModal';

// Імпорт API сервісів
import { getUserVehicles } from '../api/vehiclesApi';
import { getUserAppointments } from '../api/appointmentsApi';
import { getAllServiceRecords } from '../api/serviceRecordsService';
import { registerForPushNotifications, sendPushTokenToServer } from '../api/pushNotificationsService';
import { checkAndCreateMileageRequests, getMileageRequests, submitMileageResponse } from '../api/mileageRequestService';
import { processScheduledNotifications } from '../api/notificationsService';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // Стани для даних
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [error, setError] = useState(null);
  const [selectedMileageRequest, setSelectedMileageRequest] = useState(null);
  const [mileageModalVisible, setMileageModalVisible] = useState(false);

  // Функція для завантаження даних дашборду
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Отримуємо токен користувача
      const token = await AsyncStorage.getItem('token');
      
      // Паралельно завантажуємо всі необхідні дані
      const [vehiclesData, appointmentsData, serviceRecordsData] = await Promise.all([
        getUserVehicles(token),
        getUserAppointments(token),
        getAllServiceRecords(token)
      ]);
      
      // Оновлюємо стани
      setVehicles(vehiclesData || []);
      setAppointments(appointmentsData || []);
      setServiceRecords(serviceRecordsData || []);
      
      // Перевіряємо та створюємо щомісячні запити пробігу
      await checkAndCreateMileageRequests();
      if (user && token) {
        await processScheduledNotifications(user.id, token);
      }
    } catch (err) {
      console.error('Помилка при завантаженні даних дашборду:', err);
      setError(t('dashboard.load_error'));
    } finally {
      setLoading(false);
    }
  };

  // Завантаження даних при монтуванні компонента
  useEffect(() => {
    fetchDashboardData();
    
    // Реєструємо пристрій для отримання push-сповіщень
    const setupPushNotifications = async () => {
      try {
        const pushToken = await registerForPushNotifications();
        if (pushToken) {
          const authToken = await AsyncStorage.getItem('token');
          if (authToken) {
            await sendPushTokenToServer(pushToken, authToken);
          }
        }
      } catch (error) {
        console.error('Помилка при налаштуванні push-сповіщень:', error);
      }
    };
    
    setupPushNotifications();
    
    // Оновлюємо дані при фокусі на екрані
    const unsubscribe = navigation.addListener('focus', fetchDashboardData);
    return unsubscribe;
  }, [navigation, t]);

  // Отримуємо найближчий запис на сервіс
  const getUpcomingAppointment = () => {
    if (!appointments || !Array.isArray(appointments) || appointments.length === 0) return null;
    
    try {
      // Фільтруємо майбутні записи (статус pending або confirmed)
      const futureAppointments = appointments.filter(app => 
        app && (app.status === 'pending' || app.status === 'confirmed') && 
        new Date(app.scheduled_time) >= new Date()
      );
      
      // Сортуємо за датою (від найближчої)
      futureAppointments.sort((a, b) => 
        new Date(a.scheduled_time) - new Date(b.scheduled_time)
      );
      
      return futureAppointments[0] || null;
    } catch (error) {
      console.error('Помилка при отриманні найближчого запису:', error);
      return null;
    }
  };

  // Отримуємо останній сервісний запис
  const getLatestServiceRecord = () => {
    if (!serviceRecords || !Array.isArray(serviceRecords) || serviceRecords.length === 0) return null;
    
    try {
      // Сортуємо за датою (від найновішого)
      const sortedRecords = [...serviceRecords].sort((a, b) => 
        new Date(b.service_date) - new Date(a.service_date)
      );
      
      return sortedRecords[0] || null;
    } catch (error) {
      console.error('Помилка при отриманні останнього сервісного запису:', error);
      return null;
    }
  };

  // Форматування дати
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Відображення статусу запису
  const renderAppointmentStatus = (status) => {
    let statusText = '';
    let statusColor = '';
    
    switch (status) {
      case 'pending':
        statusText = t('appointments.status_pending');
        statusColor = '#FFA500'; // Orange
        break;
      case 'confirmed':
        statusText = t('appointments.status_confirmed');
        statusColor = '#4CAF50'; // Green
        break;
      case 'in_progress':
        statusText = t('appointments.status_in_progress');
        statusColor = '#2196F3'; // Blue
        break;
      case 'completed':
        statusText = t('appointments.status_completed');
        statusColor = '#9E9E9E'; // Grey
        break;
      case 'cancelled':
        statusText = t('appointments.status_cancelled');
        statusColor = '#F44336'; // Red
        break;
      default:
        statusText = status;
        statusColor = '#9E9E9E'; // Grey
    }
    
    return (
      <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    );
  };

  // Відображення віджету з найближчим записом
  const renderUpcomingAppointment = () => {
    const appointment = getUpcomingAppointment();
    
    if (!appointment) {
      return (
        <View style={styles.widget}>
          <View style={styles.widgetHeader}>
            <Ionicons name="calendar" size={24} color="#c62828" />
            <Text style={styles.widgetTitle}>{t('dashboard.upcoming_appointments')}</Text>
          </View>
          <Text style={styles.emptyMessage}>{t('dashboard.no_upcoming_appointments')}</Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Appointments')}
          >
            <Text style={styles.actionButtonText}>{t('dashboard.schedule_appointment')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <TouchableOpacity 
        style={styles.widget}
        onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: appointment.id })}
      >
        <View style={styles.widgetHeader}>
          <Ionicons name="calendar" size={24} color="#c62828" />
          <Text style={styles.widgetTitle}>{t('dashboard.upcoming_appointments')}</Text>
        </View>
        <View style={styles.appointmentInfo}>
          <Text style={styles.appointmentDate}>
            {formatDate(appointment.scheduled_time)}
          </Text>
          <Text style={styles.appointmentService}>{appointment.service_name}</Text>
          <Text style={styles.appointmentVehicle}>{appointment.vehicle_info}</Text>
          {appointment.notes && (
            <Text style={styles.appointmentNotes} numberOfLines={2}>{appointment.notes}</Text>
          )}
          {renderAppointmentStatus(appointment.status)}
        </View>
      </TouchableOpacity>
    );
  };

  // Відображення віджету з останнім сервісним записом
  const renderLatestServiceRecord = () => {
    const record = getLatestServiceRecord();
    
    if (!record) {
      return (
        <View style={styles.widget}>
          <View style={styles.widgetHeader}>
            <Ionicons name="construct" size={24} color="#c62828" />
            <Text style={styles.widgetTitle}>{t('dashboard.recent_service_records')}</Text>
          </View>
          <Text style={styles.emptyMessage}>{t('dashboard.no_recent_service_records')}</Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('ServiceRecords')}
          >
            <Text style={styles.actionButtonText}>{t('dashboard.view_service_book')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <TouchableOpacity 
        style={styles.widget}
        onPress={() => navigation.navigate('ServiceRecordDetails', { id: record.id })}
      >
        <View style={styles.widgetHeader}>
          <Ionicons name="construct" size={24} color="#c62828" />
          <Text style={styles.widgetTitle}>{t('dashboard.recent_service_records')}</Text>
        </View>
        <View style={styles.recordInfo}>
          <Text style={styles.recordDate}>{formatDate(record.service_date)}</Text>
          <Text style={styles.recordType}>{record.service_type}</Text>
          <Text style={styles.recordVehicle}>{record.vehicle_info}</Text>
          <View style={styles.recordDetails}>
            <Text style={styles.recordMileage}>{t('service_records.mileage')}: {record.mileage} {t('common.km')}</Text>
            <Text style={styles.recordCost}>{record.cost} {t('common.currency')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Відображення віджету зі статистикою автомобілів
  const renderVehiclesWidget = () => {
    return (
      <TouchableOpacity 
        style={styles.widget}
        onPress={() => navigation.navigate('Vehicles')}
      >
        <View style={styles.widgetHeader}>
          <Ionicons name="car" size={24} color="#c62828" />
          <Text style={styles.widgetTitle}>{t('dashboard.vehicles_status')}</Text>
        </View>
        <View style={styles.vehiclesInfo}>
          <View style={styles.vehiclesStat}>
            <Text style={styles.vehiclesCount}>{vehicles.length}</Text>
            <Text style={styles.vehiclesLabel}>{t('vehicles.title')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9e9e9e" />
        </View>
      </TouchableOpacity>
    );
  };

  // Відображення вітання користувача
  const renderWelcome = () => {
    const userName = user?.name || t('dashboard.user');
    const currentHour = new Date().getHours();
    let greeting = '';
    
    if (currentHour < 12) {
      greeting = t('dashboard.good_morning');
    } else if (currentHour < 18) {
      greeting = t('dashboard.good_afternoon');
    } else {
      greeting = t('dashboard.good_evening');
    }
    
    return (
      <View style={styles.welcomeContainer}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.userName}>{userName}</Text>
      </View>
    );
  };

  // Обробник натискання на нагадування
  const handleReminderPress = (reminder) => {
    if (reminder.vehicle_vin) {
      navigation.navigate('VehicleDetails', { vehicleId: reminder.vehicle_vin });
    } else if (reminder.appointment_id) {
      navigation.navigate('AppointmentDetails', { appointmentId: reminder.appointment_id });
    }
  };

  // Обробник відправки пробігу
  const handleMileageSubmit = async (mileage) => {
    try {
      if (!selectedMileageRequest) return;
      
      await submitMileageResponse(selectedMileageRequest.id, mileage);
      
      // Оновлюємо дані
      const token = await AsyncStorage.getItem('token');
      const vehiclesData = await getUserVehicles(token);
      setVehicles(vehiclesData || []);
      
      // Закриваємо модальне вікно
      setMileageModalVisible(false);
      setSelectedMileageRequest(null);
    } catch (error) {
      console.error('Помилка при відправці пробігу:', error);
    }
  };

  // Основний рендер компонента
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#c62828" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchDashboardData}
        >
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {renderWelcome()}
      
      {/* Віджет нагадувань */}
      <RemindersWidget 
        onReminderPress={handleReminderPress}
        onViewAllPress={() => navigation.navigate('Notifications')}
        maxItems={3}
      />
      
      {renderUpcomingAppointment()}
      {renderLatestServiceRecord()}
      {renderVehiclesWidget()}
      
      <FloatingActionButton
        icon="add-circle"
        color="#4CAF50"
        label={t('dashboard.quick_actions')}
        actions={[
          {
            icon: "car",
            label: t('vehicles.add'),
            onPress: () => navigation.navigate('AddVehicle'),
            color: "#1976d2"
          },
          {
            icon: "construct",
            label: t('service_book.add_record'),
            onPress: () => navigation.navigate('CreateServiceRecord'),
            color: "#f57c00"
          },
          {
            icon: "calendar",
            label: t('appointments.add_appointment'),
            onPress: () => navigation.navigate('CreateAppointment'),
            color: "#7b1fa2"
          }
        ]}
      />
      
      {/* Модальне вікно для відповіді на запит пробігу */}
      {selectedMileageRequest && (
        <MileageRequestModal
          visible={mileageModalVisible}
          onClose={() => {
            setMileageModalVisible(false);
            setSelectedMileageRequest(null);
          }}
          onSubmit={handleMileageSubmit}
          vehicle={selectedMileageRequest.vehicle}
          currentMileage={selectedMileageRequest.currentMileage}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    padding: 16, 
    backgroundColor: '#f8f8f8' 
  },
  welcomeContainer: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 18,
    color: '#757575',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212121',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#c62828',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#c62828',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  widget: {
    width: '100%',
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
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  widgetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#212121',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#9e9e9e',
    marginBottom: 16,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#c62828',
    fontWeight: 'bold',
  },
  appointmentInfo: {
    padding: 8,
  },
  appointmentDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  appointmentService: {
    fontSize: 16,
    color: '#424242',
    marginBottom: 4,
  },
  appointmentVehicle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  appointmentNotes: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recordInfo: {
    padding: 8,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  recordType: {
    fontSize: 16,
    color: '#424242',
    marginBottom: 4,
  },
  recordVehicle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  recordDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordMileage: {
    fontSize: 14,
    color: '#757575',
  },
  recordCost: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  vehiclesInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
  },
  vehiclesStat: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  vehiclesCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    marginRight: 8,
  },
  vehiclesLabel: {
    fontSize: 16,
    color: '#757575',
  },
});
