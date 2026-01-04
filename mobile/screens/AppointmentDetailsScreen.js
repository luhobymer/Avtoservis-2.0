import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { 
  getAppointmentById, 
  confirmAppointment, 
  startAppointment, 
  completeAppointment, 
  cancelAppointment 
} from '../api/appointmentsService';

export default function AppointmentDetailsScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { user, getToken } = useAuth();
  
  // Отримання ID запису з параметрів навігації
  const { appointmentId } = route.params || { appointmentId: 1 };
  
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAppointmentDetails = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const data = await getAppointmentById(appointmentId, token);
      setAppointment(data);
    } catch (error) {
      console.error('[AppointmentDetailsScreen] Помилка при отриманні деталей запису:', error);
      Alert.alert(t('common.error'), t('appointments.fetch_error'));
      
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    fetchAppointmentDetails();
  }, [appointmentId]);

  const handleConfirmAppointment = async () => {
    try {
      setActionLoading(true);
      const token = await getToken();
      await confirmAppointment(appointmentId, token);
      
      // Оновлюємо локальний стан
      setAppointment(prev => ({ ...prev, status: 'confirmed' }));
      
      Alert.alert(t('common.success'), t('appointments.confirm_success'));
    } catch (error) {
      console.error('[AppointmentDetailsScreen] Помилка при підтвердженні запису:', error);
      Alert.alert(t('common.error'), t('appointments.confirm_error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartAppointment = async () => {
    try {
      setActionLoading(true);
      const token = await getToken();
      await startAppointment(appointmentId, token);
      
      // Оновлюємо локальний стан
      setAppointment(prev => ({ ...prev, status: 'in_progress' }));
      
      Alert.alert(t('common.success'), t('appointments.start_success'));
    } catch (error) {
      console.error('[AppointmentDetailsScreen] Помилка при початку запису:', error);
      Alert.alert(t('common.error'), t('appointments.start_error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteAppointment = async () => {
    try {
      setActionLoading(true);
      const token = await getToken();
      await completeAppointment(appointmentId, { notes: appointment.notes }, token);
      
      // Оновлюємо локальний стан
      setAppointment(prev => ({ ...prev, status: 'completed' }));
      
      Alert.alert(t('common.success'), t('appointments.complete_success'));
    } catch (error) {
      console.error('[AppointmentDetailsScreen] Помилка при завершенні запису:', error);
      Alert.alert(t('common.error'), t('appointments.complete_error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    try {
      setActionLoading(true);
      const token = await getToken();
      await cancelAppointment(appointmentId, { reason: '' }, token);
      
      // Оновлюємо локальний стан
      setAppointment(prev => ({ ...prev, status: 'cancelled' }));
      
      Alert.alert(t('common.success'), t('appointments.cancel_success'));
    } catch (error) {
      console.error('[AppointmentDetailsScreen] Помилка при скасуванні запису:', error);
      Alert.alert(t('common.error'), t('appointments.cancel_error'));
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCancelAppointment = () => {
    Alert.alert(
      t('appointments.cancel_title'),
      t('appointments.cancel_message'),
      [
        { text: t('common.no'), style: 'cancel' },
        { text: t('common.yes'), onPress: handleCancelAppointment }
      ]
    );
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
    return t(`appointments.status.${status}`);
  };

  const renderActionButtons = () => {
    if (!appointment) return null;
    
    const { status } = appointment;
    const isAdmin = user && user.role === 'admin';
    const isMaster = user && user.role === 'master';
    
    // Клієнт може скасувати запис, якщо він ще не розпочатий
    if (!isAdmin && !isMaster) {
      if (status === 'pending' || status === 'confirmed') {
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={confirmCancelAppointment}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>{t('appointments.cancel')}</Text>
            )}
          </TouchableOpacity>
        );
      }
      return null;
    }
    
    // Адміністратор або майстер можуть змінювати статус
    switch (status) {
      case 'pending':
        return (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={handleConfirmAppointment}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>{t('appointments.confirm')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={confirmCancelAppointment}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>{t('appointments.cancel')}</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      case 'confirmed':
        return (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={handleStartAppointment}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>{t('appointments.start')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={confirmCancelAppointment}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>{t('appointments.cancel')}</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      case 'in_progress':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={handleCompleteAppointment}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>{t('appointments.complete')}</Text>
            )}
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#f44336" />
        <Text style={styles.errorText}>{t('appointments.fetch_error')}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchAppointmentDetails}
        >
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const appointmentDate = new Date(appointment.scheduled_time);
  const statusColors = getStatusColor(appointment.status);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('appointments.appointment_details')}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {getStatusText(appointment.status)}
            </Text>
          </View>
        </View>
        
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('appointments.date')}:</Text>
            <Text style={styles.value}>
              {appointmentDate.toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('appointments.time')}:</Text>
            <Text style={styles.value}>
              {appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('appointments.vehicle')}:</Text>
            <Text style={styles.value}>{appointment.vehicle_info}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>{t('appointments.service')}:</Text>
            <Text style={styles.value}>
              {appointment.service_name || getServiceTypeName(appointment.service_type)}
            </Text>
          </View>
          
          {appointment.service_price != null && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>{t('appointments.service_price')}:</Text>
              <Text style={styles.value}>{appointment.service_price}</Text>
            </View>
          )}
          
          {appointment.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.label}>{t('appointments.notes')}:</Text>
              <Text style={styles.notes}>{appointment.notes}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.actionsContainer}>
          {renderActionButtons()}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#f5f5f7' 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f7'
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center'
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1976d2',
    borderRadius: 4
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 16
  },
  card: { 
    width: '100%', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16, 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  title: { 
    fontSize: 20, 
    fontWeight: 'bold',
    color: '#333'
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500'
  },
  detailsContainer: {
    marginBottom: 24
  },
  detailRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12
  },
  label: { 
    fontWeight: '500', 
    fontSize: 16, 
    color: '#666' 
  },
  value: { 
    fontSize: 16,
    color: '#333',
    fontWeight: '400'
  },
  notesContainer: { 
    marginTop: 16 
  },
  notes: { 
    marginTop: 8, 
    fontSize: 16, 
    lineHeight: 24,
    color: '#333'
  },
  actionsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    marginLeft: 8,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center'
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff'
  },
  confirmButton: {
    backgroundColor: '#4caf50'
  },
  startButton: {
    backgroundColor: '#1976d2'
  },
  completeButton: {
    backgroundColor: '#4caf50'
  },
  cancelButton: {
    backgroundColor: '#f44336'
  }
});
