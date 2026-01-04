import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { listAdmin as listAppointmentsAdmin, updateStatus as updateAppointmentStatus } from '../../api/dao/appointmentsDao';

export default function AppointmentsManagementScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('date_desc');
  

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const normalized = await listAppointmentsAdmin();
      setAppointments(normalized);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      Alert.alert(t('common.error'), t('admin.appointments.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const handleChangeStatus = async (appointment, status) => {
    try {
      setUpdating(true);
      await updateAppointmentStatus(appointment.id, status);
      await fetchAppointments();
    } catch (error) {
      console.error('Failed to update appointment status:', error);
      Alert.alert(t('common.error'), t('appointments.update_error'));
    } finally {
      setUpdating(false);
    }
  };

  const promptStatusChange = (appointment, status) => {
    const titleMap = {
      confirmed: t('appointments.confirm_title'),
      in_progress: t('appointments.start_title'),
      completed: t('appointments.complete_title'),
      cancelled: t('appointments.cancel_title')
    };
    const msgMap = {
      confirmed: t('appointments.confirm_message'),
      in_progress: t('appointments.start_message'),
      completed: t('appointments.complete_message'),
      cancelled: t('appointments.cancel_message')
    };
    Alert.alert(
      titleMap[status] || t('common.confirm'),
      msgMap[status] || '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => handleChangeStatus(appointment, status) }
      ]
    );
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  

  const handleAppointmentPress = (appointment) => {
    navigation.navigate('AppointmentDetails', { appointmentId: appointment.id });
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

  const renderAppointmentItem = ({ item }) => {
    const statusColors = getStatusColor(item.status);
    return (
      <TouchableOpacity
        style={styles.appointmentItem}
        onPress={() => handleAppointmentPress(item)}
      >
        <View style={styles.appointmentInfo}>
          <View style={styles.appointmentHeader}>
            <Ionicons name="calendar-outline" size={24} color="#1976d2" />
            <Text style={styles.appointmentTime}>
              {new Date(item.dateTime).toLocaleString()}
            </Text>
          </View>
          <Text style={styles.clientName}>{item.clientName}</Text>
          <Text style={styles.vehicleInfo}>
            {item.vehicleMake} {item.vehicleModel} - {item.vehiclePlate}
          </Text>
          <View style={styles.appointmentDetails}>
            <Text
              style={[
                styles.statusTag,
                {
                  backgroundColor: statusColors.bg,
                  color: statusColors.text
                }
              ]}
            >
              {t(`appointments.status.${item.status}`)}
            </Text>
            <Text style={styles.serviceType}>
              {item.serviceName || t('appointments.service')}
              {item.servicePrice !== null && item.servicePrice !== undefined
                ? ` • ${item.servicePrice} ${t('common.currency')}`
                : ''}
              {item.serviceDuration !== null && item.serviceDuration !== undefined
                ? ` • ${item.serviceDuration} ${t('appointments.minutes_short')}`
                : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', marginLeft: 36, marginTop: 8 }}>
            {item.status === 'pending' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1976d2', opacity: updating ? 0.6 : 1 }]} disabled={updating} onPress={() => promptStatusChange(item, 'confirmed')}>
                <Text style={styles.actionText}>{t('appointments.confirm')}</Text>
              </TouchableOpacity>
            )}
            {item.status === 'confirmed' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1976d2', opacity: updating ? 0.6 : 1 }]} disabled={updating} onPress={() => promptStatusChange(item, 'in_progress')}>
                <Text style={styles.actionText}>{t('appointments.start')}</Text>
              </TouchableOpacity>
            )}
            {item.status === 'in_progress' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4caf50', opacity: updating ? 0.6 : 1 }]} disabled={updating} onPress={() => promptStatusChange(item, 'completed')}>
                <Text style={styles.actionText}>{t('appointments.complete')}</Text>
              </TouchableOpacity>
            )}
            {item.status !== 'cancelled' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f44336', opacity: updating ? 0.6 : 1 }]} disabled={updating} onPress={() => promptStatusChange(item, 'cancelled')}>
                <Text style={styles.actionText}>{t('appointments.cancel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#666" />
      </TouchableOpacity>
    );
  };

  const filtered = appointments.filter(a => {
    const q = searchQuery.trim().toLowerCase();
    const statusOk = statusFilter === 'all' ? true : a.status === statusFilter;
    const textOk = !q ||
      (a.clientName || '').toLowerCase().includes(q) ||
      (a.vehiclePlate || '').toLowerCase().includes(q) ||
      (a.serviceName || '').toLowerCase().includes(q);
    return statusOk && textOk;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortOption) {
      case 'date_asc':
        return new Date(a.dateTime) - new Date(b.dateTime);
      case 'date_desc':
        return new Date(b.dateTime) - new Date(a.dateTime);
      case 'status_asc':
        return (a.status || '').localeCompare(b.status || '');
      case 'status_desc':
        return (b.status || '').localeCompare(a.status || '');
      default:
        return 0;
    }
  });

  return (
    <View style={styles.container}>
      
      <View style={{ backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <TouchableOpacity style={[styles.filterBtn, statusFilter === 'all' ? styles.filterBtnActive : null]} onPress={() => setStatusFilter('all')}>
            <Text style={styles.filterText}>{t('appointments.status.all')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, statusFilter === 'pending' ? styles.filterBtnActive : null]} onPress={() => setStatusFilter('pending')}>
            <Text style={styles.filterText}>{t('appointments.status.pending')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, statusFilter === 'confirmed' ? styles.filterBtnActive : null]} onPress={() => setStatusFilter('confirmed')}>
            <Text style={styles.filterText}>{t('appointments.status.confirmed')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, statusFilter === 'in_progress' ? styles.filterBtnActive : null]} onPress={() => setStatusFilter('in_progress')}>
            <Text style={styles.filterText}>{t('appointments.status.in_progress')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, statusFilter === 'completed' ? styles.filterBtnActive : null]} onPress={() => setStatusFilter('completed')}>
            <Text style={styles.filterText}>{t('appointments.status.completed')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, statusFilter === 'cancelled' ? styles.filterBtnActive : null]} onPress={() => setStatusFilter('cancelled')}>
            <Text style={styles.filterText}>{t('appointments.status.cancelled')}</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, fontSize: 16 }}
          placeholder={t('common.search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{t('common.sort')}</Text>
          <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
            <Picker selectedValue={sortOption} onValueChange={(v) => setSortOption(v)}>
              <Picker.Item label={t('admin.sort.date_desc')} value="date_desc" />
              <Picker.Item label={t('admin.sort.date_asc')} value="date_asc" />
              <Picker.Item label={t('admin.sort.status_asc')} value="status_asc" />
              <Picker.Item label={t('admin.sort.status_desc')} value="status_desc" />
            </Picker>
          </View>
        </View>
        {updating ? (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#1976d2" />
          </View>
        ) : null}
      </View>
      <FlatList
        data={sorted}
        renderItem={renderAppointmentItem}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>{t('admin.appointments.no_appointments')}</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddAppointment')}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  appointmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  clientName: {
    fontSize: 16,
    color: '#333',
    marginLeft: 36,
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
    marginBottom: 8,
  },
  appointmentDetails: {
    flexDirection: 'row',
    marginLeft: 36,
    alignItems: 'center',
  },
  statusTag: {
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  unsyncedTag: {
    fontSize: 12,
    color: '#ad8b00',
    backgroundColor: '#fffbe6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  serviceType: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f5f5f7',
    marginRight: 8,
  },
  filterBtnActive: {
    backgroundColor: '#e3f2fd',
  },
  filterText: {
    color: '#333',
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
