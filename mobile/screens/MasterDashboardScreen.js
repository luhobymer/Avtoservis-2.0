import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  FlatList
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import FloatingActionButton from '../components/FloatingActionButton';
import MasterBusyStatusButton from '../components/MasterBusyStatusButton';
import { getAllAppointments } from '../api/appointmentsService';
import { getMasterBusyStatus, setMasterBusyStatus } from '../api/scheduleService';

export default function MasterDashboardScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user, getToken } = useAuth();
  
  // Стани для даних
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [busyStatus, setBusyStatus] = useState({
    is_busy: false,
    busy_until: null,
    busy_reason: ''
  });
  const [error, setError] = useState(null);

  // Завантаження даних при монтуванні компонента
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Отримуємо токен користувача
        const token = await getToken();
        
        // Отримуємо всі записи на обслуговування
        const appointmentsData = await getAllAppointments(token);
        setAppointments(appointmentsData || []);
        
        // Фільтруємо записи на сьогодні
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayApps = appointmentsData.filter(app => {
          const appDate = new Date(app.scheduled_time);
          return appDate >= today && appDate < tomorrow;
        });
        
        // Сортуємо за часом
        todayApps.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
        setTodayAppointments(todayApps);
        
        // Фільтруємо майбутні записи (не сьогодні)
        const futureApps = appointmentsData.filter(app => {
          const appDate = new Date(app.scheduled_time);
          return appDate >= tomorrow && (app.status === 'pending' || app.status === 'confirmed');
        });
        
        // Сортуємо за датою
        futureApps.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
        setUpcomingAppointments(futureApps.slice(0, 5)); // Показуємо тільки 5 найближчих
        
        // Отримуємо статус зайнятості майстра
        const status = await getMasterBusyStatus(user.id, token);
        
        // Перевіряємо, чи не закінчився час зайнятості
        if (status.is_busy && status.busy_until) {
          const busyUntil = new Date(status.busy_until);
          const now = new Date();
          
          if (busyUntil <= now) {
            // Час зайнятості закінчився, скидаємо статус
            await setMasterBusyStatus(user.id, false, null, '', token);
            setBusyStatus({
              is_busy: false,
              busy_until: null,
              busy_reason: ''
            });
          } else {
            setBusyStatus(status);
          }
        } else {
          setBusyStatus(status);
        }
      } catch (err) {
        console.error('Помилка при завантаженні даних дашборду майстра:', err);
        setError(t('dashboard.load_error'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
    
    // Оновлюємо дані при фокусі на екрані
    const unsubscribe = navigation.addListener('focus', fetchDashboardData);
    return unsubscribe;
  }, [navigation, t]);

  // Обробник зміни статусу зайнятості
  const handleBusyStatusChange = async (isBusy, busyUntil, reason) => {
    try {
      setLoading(true);
      const token = await getToken();
      
      // Оновлюємо статус зайнятості
      await setMasterBusyStatus(user.id, isBusy, busyUntil, reason, token);
      
      // Оновлюємо локальний стан
      setBusyStatus({
        is_busy: isBusy,
        busy_until: busyUntil,
        busy_reason: reason
      });
      
      // Показуємо повідомлення про успішне оновлення
      Alert.alert(
        t('common.success'),
        isBusy ? t('master.busy_status_set') : t('master.busy_status_cleared')
      );
    } catch (error) {
      console.error('Помилка при оновленні статусу зайнятості:', error);
      Alert.alert(t('common.error'), t('master.busy_status_error'));
    } finally {
      setLoading(false);
    }
  };

  // Форматування дати та часу
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Відображення статусу запису
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return { bg: '#fff3e0', text: '#f57c00' };
      case 'confirmed':
        return { bg: '#e8f5e9', text: '#4caf50' };
      case 'in_progress':
        return { bg: '#e3f2fd', text: '#1976d2' };
      case 'completed':
        return { bg: '#e8f5e9', text: '#4caf50' };
      case 'cancelled':
        return { bg: '#ffebee', text: '#f44336' };
      default:
        return { bg: '#f5f5f5', text: '#9e9e9e' };
    }
  };

  // Відображення статусу запису
  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return t('appointments.status.pending');
      case 'confirmed':
        return t('appointments.status.confirmed');
      case 'in_progress':
        return t('appointments.status.in_progress');
      case 'completed':
        return t('appointments.status.completed');
      case 'cancelled':
        return t('appointments.status.cancelled');
      default:
        return status;
    }
  };

  // Відображення елемента запису
  const renderAppointmentItem = ({ item }) => {
    const statusColors = getStatusColor(item.status);
    const serviceLabel = item.service_name || (() => {
      const types = {
        service: t('appointments.service_type.maintenance'),
        repair: t('appointments.service_type.repair'),
        diagnostics: t('appointments.service_type.diagnostics'),
        other: t('appointments.service_type.other'),
      };
      return types[item.service_type] || types.other;
    })();
    
    return (
      <TouchableOpacity 
        style={styles.appointmentItem}
        onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: item.id })}
      >
        <View style={styles.appointmentHeader}>
          <Text style={styles.appointmentTime}>
            {new Date(item.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
        
        <Text style={styles.clientName}>{item.client_name}</Text>
        <Text style={styles.serviceType}>{serviceLabel}</Text>
        <Text style={styles.vehicleInfo}>{item.vehicle_info}</Text>
        
        {item.notes && (
          <Text style={styles.notes} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // Відображення вітання майстра
  const renderWelcome = () => {
    const userName = user?.name || 'Майстер';
    const currentHour = new Date().getHours();
    let greeting = '';
    
    if (currentHour < 12) {
      greeting = t('greetings.morning');
    } else if (currentHour < 18) {
      greeting = t('greetings.afternoon');
    } else {
      greeting = t('greetings.evening');
    }
    
    return (
      <View style={styles.welcomeContainer}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.userName}>{userName}</Text>
      </View>
    );
  };

  // Відображення статистики
  const renderStats = () => {
    const pendingCount = appointments.filter(app => app.status === 'pending').length;
    const confirmedCount = appointments.filter(app => app.status === 'confirmed').length;
    const inProgressCount = appointments.filter(app => app.status === 'in_progress').length;
    
    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>{t('master.pending_appointments')}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{confirmedCount}</Text>
          <Text style={styles.statLabel}>{t('master.confirmed_appointments')}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{inProgressCount}</Text>
          <Text style={styles.statLabel}>{t('master.in_progress_appointments')}</Text>
        </View>
      </View>
    );
  };

  // Відображення розкладу на сьогодні
  const renderTodaySchedule = () => {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="today-outline" size={20} color="#1976d2" />
            <Text style={styles.sectionTitle}>{t('master.today_schedule')}</Text>
          </View>
          
          <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
            <Text style={styles.viewAllText}>{t('common.view_all')}</Text>
          </TouchableOpacity>
        </View>
        
        {todayAppointments.length > 0 ? (
          <FlatList
            data={todayAppointments}
            renderItem={renderAppointmentItem}
            keyExtractor={item => item.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.appointmentsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={40} color="#e0e0e0" />
            <Text style={styles.emptyText}>{t('master.no_appointments_today')}</Text>
          </View>
        )}
      </View>
    );
  };

  // Відображення майбутніх записів
  const renderUpcomingAppointments = () => {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="calendar-outline" size={20} color="#f57c00" />
            <Text style={styles.sectionTitle}>{t('master.upcoming_appointments')}</Text>
          </View>
          
          <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
            <Text style={styles.viewAllText}>{t('common.view_all')}</Text>
          </TouchableOpacity>
        </View>
        
        {upcomingAppointments.length > 0 ? (
          <FlatList
            data={upcomingAppointments}
            renderItem={renderAppointmentItem}
            keyExtractor={item => item.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.appointmentsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={40} color="#e0e0e0" />
            <Text style={styles.emptyText}>{t('master.no_upcoming_appointments')}</Text>
          </View>
        )}
      </View>
    );
  };

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
        <Ionicons name="alert-circle-outline" size={48} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.reset({
            index: 0,
            routes: [{ name: 'MasterDashboard' }],
          })}
        >
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderWelcome()}
        
        <View style={styles.busyStatusContainer}>
          <MasterBusyStatusButton
            isBusy={busyStatus.is_busy}
            busyUntil={busyStatus.busy_until}
            busyReason={busyStatus.busy_reason}
            onStatusChange={handleBusyStatusChange}
          />
        </View>
        
        {renderStats()}
        {renderTodaySchedule()}
        {renderUpcomingAppointments()}
      </ScrollView>
      
      <FloatingActionButton
        icon="add-circle"
        color="#4CAF50"
        label={t('master.quick_actions')}
        actions={[
          {
            icon: "calendar",
            label: t('master.working_hours'),
            onPress: () => navigation.navigate('MasterWorkingHours'),
            color: "#1976d2"
          },
          {
            icon: "construct",
            label: t('master.service_history'),
            onPress: () => navigation.navigate('ServiceRecords'),
            color: "#f57c00"
          },
          {
            icon: "notifications",
            label: t('notifications.title'),
            onPress: () => navigation.navigate('Notifications'),
            color: "#7b1fa2"
          }
        ]}
      />
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
    paddingBottom: 80, // Додатковий відступ для FAB
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#1976d2',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  welcomeContainer: {
    marginBottom: 16,
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
  busyStatusContainer: {
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    marginTop: 4,
  },
  sectionContainer: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#212121',
  },
  viewAllText: {
    color: '#1976d2',
    fontWeight: '500',
  },
  appointmentsList: {
    paddingTop: 8,
  },
  appointmentItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  notes: {
    fontSize: 14,
    color: '#757575',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#9e9e9e',
    marginTop: 8,
  },
});
