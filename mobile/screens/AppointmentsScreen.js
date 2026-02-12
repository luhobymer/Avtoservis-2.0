import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  RefreshControl,
  ScrollView
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { 
  getAllAppointments, 
  confirmAppointment, 
  startAppointment, 
  cancelAppointment 
} from '../api/appointmentsService';
import FloatingActionButton from '../components/FloatingActionButton';

export default function AppointmentsScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, getToken } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const data = await getAllAppointments(token);
      setAppointments(data);
    } catch (error) {
      console.error('[AppointmentsScreen] Помилка при отриманні записів:', error);
      Alert.alert(t('common.error'), t('appointments.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAppointments();
    
    // Оновлюємо дані при фокусі на екрані
    const unsubscribe = navigation.addListener('focus', fetchAppointments);
    return unsubscribe;
  }, [navigation]);

  const handleAppointmentPress = (appointment) => {
    navigation.navigate('AppointmentDetails', { appointmentId: appointment.id });
  };

  const handleStatusChange = (status) => {
    setSelectedStatus(status);
  };

  const getServiceTypeName = (type) => {
    const types = {
      service: t('appointments.service_type.maintenance'),
      repair: t('appointments.service_type.repair'),
      diagnostics: t('appointments.service_type.diagnostics'),
      other: t('appointments.service_type.other'),
    };
    return types[type] || types.other;
  };

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

  const handleConfirmAppointment = async (id) => {
    try {
      setLoading(true);
      const token = await getToken();
      await confirmAppointment(id, token);
      
      // Оновлюємо локальний стан
      setAppointments(prevAppointments => 
        prevAppointments.map(app => 
          app.id === id ? { ...app, status: 'confirmed' } : app
        )
      );
      
      Alert.alert(t('common.success'), t('appointments.confirm_success'));
    } catch (error) {
      console.error('[AppointmentsScreen] Помилка при підтвердженні запису:', error);
      Alert.alert(t('common.error'), t('appointments.confirm_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartAppointment = async (id) => {
    try {
      setLoading(true);
      const token = await getToken();
      await startAppointment(id, token);
      
      // Оновлюємо локальний стан
      setAppointments(prevAppointments => 
        prevAppointments.map(app => 
          app.id === id ? { ...app, status: 'in_progress' } : app
        )
      );
      
      Alert.alert(t('common.success'), t('appointments.start_success'));
    } catch (error) {
      console.error('[AppointmentsScreen] Помилка при початку запису:', error);
      Alert.alert(t('common.error'), t('appointments.start_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAppointment = (appointment) => {
    navigation.navigate('CompleteAppointment', {
      appointmentId: appointment.id,
      currentNotes: appointment.notes,
      vehicleVin: appointment.vehicle_vin
    });
  };

  const handleCancelAppointment = async (id) => {
    try {
      setLoading(true);
      const token = await getToken();
      await cancelAppointment(id, { reason: '' }, token);
      
      // Оновлюємо локальний стан
      setAppointments(prevAppointments => 
        prevAppointments.map(app => 
          app.id === id ? { ...app, status: 'cancelled' } : app
        )
      );
      
      Alert.alert(t('common.success'), t('appointments.cancel_success'));
    } catch (error) {
      console.error('[AppointmentsScreen] Помилка при скасуванні запису:', error);
      Alert.alert(t('common.error'), t('appointments.cancel_error'));
    } finally {
      setLoading(false);
    }
  };

  const confirmCancelAppointment = (id) => {
    Alert.alert(
      t('appointments.cancel_title'),
      t('appointments.cancel_message'),
      [
        { text: t('common.no'), style: 'cancel' },
        { text: t('common.yes'), onPress: () => handleCancelAppointment(id) }
      ]
    );
  };

  const renderActionButtons = (appointment) => {
    const { id, status } = appointment;
    const isMaster = user && user.role === 'master';
    
    // Клієнт може скасувати запис, якщо він ще не розпочатий
    if (!isMaster) {
      if (status === 'pending' || status === 'confirmed') {
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => confirmCancelAppointment(id)}
          >
            <Text style={styles.actionButtonText}>{t('appointments.cancel')}</Text>
          </TouchableOpacity>
        );
      }
      return null;
    }
    
    // Майстер може змінювати статус
    switch (status) {
      case 'pending':
        return (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => handleConfirmAppointment(id)}
            >
              <Text style={styles.actionButtonText}>{t('appointments.confirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => confirmCancelAppointment(id)}
            >
              <Text style={styles.actionButtonText}>{t('appointments.cancel')}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'confirmed':
        return (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={() => handleStartAppointment(id)}
            >
              <Text style={styles.actionButtonText}>{t('appointments.start')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => confirmCancelAppointment(id)}
            >
              <Text style={styles.actionButtonText}>{t('appointments.cancel')}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'in_progress':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleCompleteAppointment(appointment)}
          >
            <Text style={styles.actionButtonText}>{t('appointments.complete')}</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  const renderAppointmentItem = ({ item }) => {
    const statusColors = getStatusColor(item.status);
    const appointmentDate = new Date(item.scheduled_time);
    const serviceLabel = item.service_name || getServiceTypeName(item.service_type);
    
    return (
      <TouchableOpacity
        style={styles.appointmentItem}
        onPress={() => handleAppointmentPress(item)}
      >
        <View style={styles.appointmentHeader}>
          <Text style={styles.appointmentDate}>
            {appointmentDate.toLocaleDateString()} {appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
        
        <View style={styles.appointmentContent}>
          <Text style={styles.serviceType}>
            {serviceLabel}
          </Text>
          <Text style={styles.vehicleInfo}>{item.vehicle_info}</Text>
          {item.service_price != null && (
            <Text style={styles.notes}>
              {t('appointments.service_price')}: {item.service_price}
            </Text>
          )}
          {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
        </View>
        
        {renderActionButtons(item)}
      </TouchableOpacity>
    );
  };

  const filterAppointments = () => {
    if (selectedStatus === 'all') {
      return appointments;
    }
    return appointments.filter(app => app.status === selectedStatus);
  };

  const renderStatusFilter = () => {
    const statuses = [
      { id: 'all', label: t('appointments.status.all') },
      { id: 'pending', label: t('appointments.status.pending') },
      { id: 'confirmed', label: t('appointments.status.confirmed') },
      { id: 'in_progress', label: t('appointments.status.in_progress') },
      { id: 'completed', label: t('appointments.status.completed') },
      { id: 'cancelled', label: t('appointments.status.cancelled') }
    ];
    
    return (
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {statuses.map(status => (
            <TouchableOpacity
              key={status.id}
              style={[
                styles.filterButton,
                selectedStatus === status.id && styles.activeFilterButton
              ]}
              onPress={() => handleStatusChange(status.id)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedStatus === status.id && styles.activeFilterButtonText
                ]}
              >
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const filteredAppointments = filterAppointments();

  return (
    <View style={styles.container}>
      {renderStatusFilter()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : (
        <FlatList
          data={filteredAppointments}
          renderItem={renderAppointmentItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#1976d2']}
              tintColor={'#1976d2'}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {selectedStatus === 'all'
                  ? t('appointments.no_appointments')
                  : t('appointments.no_appointments_status')}
              </Text>
            </View>
          }
        />
      )}
      
      <FloatingActionButton 
        icon="add-circle"
        color="#4CAF50"
        label={t('appointments.add_new')}
        actions={[
          {
            icon: "car",
            label: t('appointments.service'),
            onPress: () => navigation.navigate('CreateAppointment', { type: 'service' }),
            color: "#1976d2"
          },
          {
            icon: "construct",
            label: t('appointments.repair'),
            onPress: () => navigation.navigate('CreateAppointment', { type: 'repair' }),
            color: "#f57c00"
          },
          {
            icon: "analytics",
            label: t('appointments.diagnostics'),
            onPress: () => navigation.navigate('CreateAppointment', { type: 'diagnostics' }),
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
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, // Додатковий відступ для FAB
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  appointmentItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  appointmentDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
  appointmentContent: {
    marginBottom: 12,
  },
  serviceType: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  notes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  confirmButton: {
    backgroundColor: '#4caf50',
  },
  startButton: {
    backgroundColor: '#1976d2',
  },
  completeButton: {
    backgroundColor: '#4caf50',
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
  },
  activeFilterButton: {
    backgroundColor: '#1976d2',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});
