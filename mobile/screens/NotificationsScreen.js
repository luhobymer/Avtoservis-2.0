import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { getUserNotifications, markNotificationAsRead, deleteNotification as removeNotification } from '../api/notificationsApi';
import { getUserReminders, deleteReminder, REMINDER_TYPES } from '../api/reminderService';

export default function NotificationsScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [combinedItems, setCombinedItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Видалення сповіщення
  const deleteNotification = async (id, isReminder = false) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Токен авторизації відсутній');
      }
      
      if (isReminder) {
        await deleteReminder(id, token);
        setReminders(prevReminders =>
          prevReminders.filter(reminder => reminder.id !== id)
        );
      } else {
        await removeNotification(id, token);
        setNotifications(prevNotifications =>
          prevNotifications.filter(notification => notification.id !== id)
        );
      }
      
      // Оновлюємо комбінований список
      updateCombinedItems();
    } catch (error) {
      console.error('Failed to delete notification:', error);
      Alert.alert(t('common.error'), t('notifications.delete_error'));
    }
  };

  // Оновлення комбінованого списку сповіщень та нагадувань
  const updateCombinedItems = () => {
    // Перетворюємо нагадування у формат сповіщень
    const reminderItems = reminders.map(reminder => ({
      ...reminder,
      id: `reminder_${reminder.id}`,
      title: reminder.title,
      message: reminder.message,
      createdAt: reminder.created_at,
      type: `reminder_${reminder.type}`,
      read: false,
      isReminder: true
    }));
    
    // Об'єднуємо та сортуємо за датою (від найновіших)
    const combined = [...notifications, ...reminderItems].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    setCombinedItems(combined);
  };

  const markAllAsRead = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Токен авторизації відсутній');
      }

      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await markNotificationAsRead(n.id, token);
      }

      setNotifications(prevNotifications =>
        prevNotifications.map(notification => ({ ...notification, read: true }))
      );

      updateCombinedItems();

      Alert.alert(t('common.success'), t('notifications.mark_all_read_success'));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      Alert.alert(t('common.error'), t('notifications.mark_all_read_error'));
    }
  };

  const deleteAllNotifications = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Токен авторизації відсутній');
      }

      const all = [...notifications];
      for (const n of all) {
        await removeNotification(n.id, token);
      }

      const allReminders = [...reminders];
      for (const r of allReminders) {
        await deleteReminder(r.id, token);
      }

      setNotifications([]);
      setReminders([]);
      setCombinedItems([]);

      Alert.alert(t('common.success'), t('notifications.delete_all_success'));
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
      Alert.alert(t('common.error'), t('notifications.delete_all_error'));
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        console.error('Токен авторизації відсутній');
        Alert.alert(t('common.error') || 'Помилка', t('notifications.auth_error') || 'Помилка авторизації');
        setNotifications([]);
        setReminders([]);
        setCombinedItems([]);
        setLoading(false);
        return;
      }
      
      // Отримуємо сповіщення
      const notificationsData = await getUserNotifications(token);
      setNotifications(notificationsData);
      
      // Отримуємо нагадування
      const remindersData = await getUserReminders(token);
      setReminders(remindersData);
      
      // Оновлюємо комбінований список
      updateCombinedItems();
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      Alert.alert(t('common.error'), t('notifications.fetch_error'));
      
      setNotifications([]);
      setReminders([]);
      setCombinedItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleNotificationPress = async (notification) => {
    // Якщо сповіщення не прочитане, позначаємо його як прочитане
    if (!notification.read && !notification.isReminder) {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Токен авторизації відсутній');
        }
        
        await markNotificationAsRead(notification.id, token);
        
        // Оновлюємо локальний стан
        setNotifications(prevNotifications =>
          prevNotifications.map(item =>
            item.id === notification.id ? { ...item, read: true } : item
          )
        );
        
        // Оновлюємо комбінований список
        updateCombinedItems();
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
    
    // Обробка різних типів сповіщень та нагадувань
    if (notification.isReminder) {
      const reminderType = notification.type.replace('reminder_', '');
      
      switch (reminderType) {
        case REMINDER_TYPES.MAINTENANCE:
          navigation.navigate('VehicleDetails', { vehicleId: notification.vehicle_vin });
          break;
        case REMINDER_TYPES.MILEAGE_REQUEST:
          navigation.navigate('VehicleDetails', { vehicleId: notification.vehicle_vin });
          break;
        case REMINDER_TYPES.APPOINTMENT_STATUS:
          navigation.navigate('AppointmentDetails', { appointmentId: notification.appointment_id });
          break;
        default:
          break;
      }
    } else {
      // Обробка звичайних сповіщень
      switch (notification.type) {
        case 'appointment':
          navigation.navigate('AppointmentDetails', { appointmentId: notification.data?.appointmentId });
          break;
        case 'vehicle':
          navigation.navigate('VehicleDetails', { vehicleId: notification.data?.vehicleId });
          break;
        default:
          break;
      }
    }
  };

  const getNotificationIcon = (type) => {
    // Перевіряємо, чи це нагадування
    if (type.startsWith('reminder_')) {
      const reminderType = type.replace('reminder_', '');
      
      switch (reminderType) {
        case REMINDER_TYPES.MAINTENANCE:
          return 'construct-outline';
        case REMINDER_TYPES.MILEAGE_REQUEST:
          return 'speedometer-outline';
        case REMINDER_TYPES.APPOINTMENT_STATUS:
          return 'calendar-outline';
        default:
          return 'notifications-outline';
      }
    }
    
    // Звичайні сповіщення
    switch (type) {
      case 'appointment':
        return 'calendar-outline';
      case 'maintenance':
        return 'construct-outline';
      case 'mileage':
        return 'speedometer-outline';
      case 'vehicle':
        return 'car-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getNotificationColor = (type) => {
    // Перевіряємо, чи це нагадування
    if (type.startsWith('reminder_')) {
      const reminderType = type.replace('reminder_', '');
      
      switch (reminderType) {
        case REMINDER_TYPES.MAINTENANCE:
          return '#f57c00'; // оранжевий
        case REMINDER_TYPES.MILEAGE_REQUEST:
          return '#1976d2'; // синій
        case REMINDER_TYPES.APPOINTMENT_STATUS:
          return '#4caf50'; // зелений
        default:
          return '#757575'; // сірий
      }
    }
    
    // Звичайні сповіщення
    switch (type) {
      case 'appointment':
        return '#4caf50'; // зелений
      case 'maintenance':
        return '#f57c00'; // оранжевий
      case 'mileage':
        return '#1976d2'; // синій
      case 'vehicle':
        return '#9c27b0'; // фіолетовий
      default:
        return '#757575'; // сірий
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unreadItem]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name={getNotificationIcon(item.type)} 
          size={24} 
          color={getNotificationColor(item.type)} 
        />
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.title, !item.read && styles.unreadText]}>
          {item.title}
        </Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderHiddenItem = ({ item }) => (
    <View style={styles.rowBack}>
      <TouchableOpacity
        style={[styles.backRightBtn, styles.backRightBtnRight]}
        onPress={() => deleteNotification(
          item.isReminder ? item.id.replace('reminder_', '') : item.id, 
          item.isReminder
        )}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {combinedItems.length > 0 && (
        <View style={styles.actionButtons}>
          {notifications.some(n => !n.read) && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={markAllAsRead}
            >
              <Text style={styles.actionButtonText}>{t('notifications.markAllRead')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={deleteAllNotifications}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
              {t('notifications.deleteAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <SwipeListView
        data={combinedItems}
        renderItem={renderItem}
        keyExtractor={item => (item && item.id ? item.id.toString() : Math.random().toString())}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976d2']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
          </View>
        }
        rightOpenValue={-75}
        renderHiddenItem={renderHiddenItem}
        disableRightSwipe
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: '#1976d2',
  },
  deleteButton: {
    backgroundColor: '#c62828',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  deleteButtonText: {
    color: '#fff',
  },
  rowBack: {
    alignItems: 'center',
    backgroundColor: '#DDD',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 15,
  },
  backRightBtn: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: 75,
  },
  backRightBtnRight: {
    backgroundColor: '#c62828',
    right: 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  unreadItem: {
    backgroundColor: '#f0f7ff',
  },
  iconContainer: {
    marginRight: 16,
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: '600',
    color: '#1976d2',
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
