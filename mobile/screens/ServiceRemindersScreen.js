import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import { getUserReminders } from '../api/reminderService';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export default function ServiceRemindersScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    checkNotificationPermissions();
    loadReminders();
  }, []);

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
  };

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotificationsEnabled(status === 'granted');

    if (status !== 'granted') {
      Alert.alert(
        t('reminders.permissions_title'),
        t('reminders.permissions_message')
      );
    }
  };

  const loadReminders = async () => {
    try {
      const cachedReminders = await AsyncStorage.getItem('serviceReminders');
      if (cachedReminders) {
        setReminders(JSON.parse(cachedReminders));
      }
      const rows = await getUserReminders(await getToken());
      const vins = [...new Set(rows.map(r => r.vehicle_vin).filter(Boolean))];
      let vehiclesMap = {};
      if (vins.length > 0) {
        const vehicles = await vehiclesDao.listByVins(vins);
        vehicles.forEach(v => { vehiclesMap[v.vin] = { make: v.brand, model: v.model }; });
      }
      const normalized = rows.map(r => ({
        id: r.id,
        vehicleName: `${vehiclesMap[r.vehicle_vin]?.make || ''} ${vehiclesMap[r.vehicle_vin]?.model || ''}`.trim() || t('service_records.vehicle'),
        serviceType: r.description || r.title || 'Сервіс',
        dueDate: r.due_date || new Date().toISOString(),
        daysBeforeDue: 7,
        enabled: !!r.notification_sent,
        notes: ''
      }));
      setReminders(normalized);
      await AsyncStorage.setItem('serviceReminders', JSON.stringify(normalized));
    } catch (error) {
      console.error('Failed to load reminders:', error);
      Alert.alert(t('common.error'), t('reminders.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleReminder = async (reminderId, enabled) => {
    try {
      if (enabled && !notificationsEnabled) {
        await requestNotificationPermissions();
        if (!notificationsEnabled) return;
      }

      await AsyncStorage.setItem(`reminder_enabled_${reminderId}`, JSON.stringify(enabled));
      setReminders(prevReminders =>
        prevReminders.map(reminder =>
          reminder.id === reminderId
            ? { ...reminder, enabled }
            : reminder
        )
      );

      if (enabled) {
        await scheduleReminder(reminderId);
      } else {
        await cancelReminder(reminderId);
      }
    } catch (error) {
      console.error('Failed to toggle reminder:', error);
      Alert.alert(t('common.error'), t('reminders.update_error'));
    }
  };

  const scheduleReminder = async (reminderId) => {
    const reminder = reminders.find(r => r.id === reminderId);
    if (!reminder) return;

    const trigger = new Date(reminder.dueDate);
    trigger.setDate(trigger.getDate() - reminder.daysBeforeDue);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('reminders.notification_title'),
        body: `${reminder.vehicleName}: ${reminder.serviceType}`,
        data: { reminderId }
      },
      trigger
    });
  };

  const cancelReminder = async (reminderId) => {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const notification = scheduledNotifications.find(
      n => n.content.data?.reminderId === reminderId
    );
    if (notification) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  };

  const renderReminderItem = ({ item }) => (
    <View style={styles.reminderCard}>
      <View style={styles.reminderHeader}>
        <View style={styles.vehicleInfo}>
          <Ionicons name="car-outline" size={24} color="#1976d2" />
          <Text style={styles.vehicleName}>{item.vehicleName}</Text>
        </View>
        <Switch
          value={item.enabled}
          onValueChange={(enabled) => toggleReminder(item.id, enabled)}
          trackColor={{ false: '#ccc', true: '#90caf9' }}
          thumbColor={item.enabled ? '#1976d2' : '#f4f3f4'}
        />
      </View>

      <View style={styles.serviceInfo}>
        <Text style={styles.serviceType}>{item.serviceType}</Text>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.dueDate}>
            {t('reminders.due_date')}: {new Date(item.dueDate).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.reminderSettings}>
        <Ionicons name="notifications-outline" size={16} color="#666" />
        <Text style={styles.reminderText}>
          {t('reminders.notify_before', { days: item.daysBeforeDue })}
        </Text>
      </View>

      {item.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {item.notes}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={reminders}
        renderItem={renderReminderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{t('reminders.no_reminders')}</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('CreateReminder')}
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
  list: {
    padding: 16,
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginLeft: 8,
  },
  serviceInfo: {
    marginBottom: 12,
  },
  serviceType: {
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDate: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  reminderSettings: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  reminderText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  notes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  addButton: {
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
