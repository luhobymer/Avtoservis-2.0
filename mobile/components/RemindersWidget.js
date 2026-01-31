import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Modal
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getUserReminders, updateReminder } from '../api/reminderService';
import { REMINDER_TYPES } from '../api/reminderService';
import { getMileageRequests, submitMileageResponse } from '../api/mileageRequestService';
import MileageRequestModal from './MileageRequestModal';
import { getUserVehicles } from '../api/vehiclesApi';

/**
 * Компонент для відображення нагадувань та сповіщень на головному екрані
 * @param {Object} props - властивості компонента
 * @param {Function} props.onReminderPress - функція, яка викликається при натисканні на нагадування
 * @param {Function} props.onViewAllPress - функція, яка викликається при натисканні на "Переглянути всі"
 * @param {number} props.maxItems - максимальна кількість елементів для відображення
 */
const RemindersWidget = ({ onReminderPress, onViewAllPress, maxItems = 3 }) => {
  const { t } = useTranslation();
  const { getToken, user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [mileageRequests, setMileageRequests] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMileageRequest, setSelectedMileageRequest] = useState(null);
  const [mileageModalVisible, setMileageModalVisible] = useState(false);

  useEffect(() => {
    fetchReminders();
    fetchMileageRequests();
    fetchVehicles();
  }, []);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await getToken();
      const data = await getUserReminders(token);
      
      // Перевіряємо, чи data є масивом
      if (!Array.isArray(data)) {
        console.log('[RemindersWidget] Дані не є масивом:', data);
        setReminders([]);
        return;
      }
      
      // Сортуємо за датою (від найновіших)
      const sortedReminders = data.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      // Фільтруємо нагадування, які ще не завершені
      const activeReminders = sortedReminders.filter(item => !item.is_completed);
      
      setReminders(activeReminders);
    } catch (error) {
      console.error('[RemindersWidget] Помилка при отриманні нагадувань:', error);
      setError(t('reminders.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMileageRequests = async () => {
    try {
      const requests = await getMileageRequests();
      
      // Фільтруємо тільки активні запити
      const activeRequests = requests.filter(req => req.status === 'pending');
      
      setMileageRequests(activeRequests);
    } catch (error) {
      console.error('[RemindersWidget] Помилка при отриманні запитів пробігу:', error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const vehiclesData = await getUserVehicles(user?.id);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('[RemindersWidget] Помилка при отриманні автомобілів:', error);
    }
  };

  const handleMileageRequestPress = (request) => {
    // Знаходимо відповідний автомобіль
    const vehicle = vehicles.find(v => v.id === request.vehicleId);
    
    if (vehicle) {
      setSelectedMileageRequest({
        ...request,
        vehicle
      });
      setMileageModalVisible(true);
    } else {
      // Якщо автомобіль не знайдено, використовуємо дані з запиту
      setSelectedMileageRequest({
        ...request,
        vehicle: {
          id: request.vehicleId,
          make: request.vehicleMake,
          model: request.vehicleModel,
          year: request.vehicleYear,
          mileage: request.currentMileage
        }
      });
      setMileageModalVisible(true);
    }
  };

  const handleMileageSubmit = async (mileage) => {
    try {
      if (!selectedMileageRequest) return;
      
      await submitMileageResponse(selectedMileageRequest.id, mileage);
      
      // Оновлюємо список запитів
      fetchMileageRequests();
      
      // Закриваємо модальне вікно
      setMileageModalVisible(false);
      setSelectedMileageRequest(null);
    } catch (error) {
      console.error('[RemindersWidget] Помилка при відправці пробігу:', error);
    }
  };

  const getReminderIcon = (type) => {
    switch (type) {
      case REMINDER_TYPES.MAINTENANCE:
        return 'construct-outline';
      case REMINDER_TYPES.MILEAGE_REQUEST:
        return 'speedometer-outline';
      case REMINDER_TYPES.APPOINTMENT_STATUS:
        return 'calendar-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getReminderColor = (type) => {
    switch (type) {
      case REMINDER_TYPES.MAINTENANCE:
        return '#f57c00'; // оранжевий
      case REMINDER_TYPES.MILEAGE_REQUEST:
        return '#1976d2'; // синій
      case REMINDER_TYPES.APPOINTMENT_STATUS:
        return '#4caf50'; // зелений
      default:
        return '#757575'; // сірий
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderReminderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.reminderItem}
      onPress={async () => {
        if (onReminderPress) {
          onReminderPress(item);
          return;
        }
        const updated = await updateReminder(item.id, {
          title: item.title,
          description: item.message,
          reminder_type: item.type,
          due_date: item.due_date,
          due_mileage: item.due_mileage,
          is_completed: true,
          is_recurring: item.is_recurring,
          recurrence_interval: item.recurrence_interval,
          priority: item.priority,
        });
        if (updated) {
          setReminders((prev) => prev.filter((r) => r.id !== item.id));
        }
      }}
    >
      <View style={[styles.iconContainer, { backgroundColor: getReminderColor(item.type) }]}>
        <Ionicons name={getReminderIcon(item.type)} size={20} color="#fff" />
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.date}>{formatDate(item.due_date)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMileageRequestItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.reminderItem}
      onPress={() => handleMileageRequestPress(item)}
    >
      <View style={[styles.iconContainer, { backgroundColor: '#1976d2' }]}>
        <Ionicons name="speedometer-outline" size={20} color="#fff" />
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{t('reminders.mileage_request.title')}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {t('reminders.mileage_request.message', { 
            vehicle: `${item.vehicleMake} ${item.vehicleModel}` 
          })}
        </Text>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.actionContainer}>
        <Ionicons name="chevron-forward" size={20} color="#9e9e9e" />
      </View>
    </TouchableOpacity>
  );

  // Об'єднуємо нагадування та запити пробігу
  const allItems = [
    ...reminders.map(item => ({ ...item, itemType: 'reminder' })),
    ...mileageRequests.map(item => ({ ...item, itemType: 'mileageRequest' }))
  ].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at);
    const dateB = new Date(b.createdAt || b.created_at);
    return dateB - dateA;
  });

  const renderItem = ({ item }) => {
    if (item.itemType === 'mileageRequest') {
      return renderMileageRequestItem({ item });
    } else {
      return renderReminderItem({ item });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#1976d2" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchReminders}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (allItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle-outline" size={24} color="#4caf50" />
        <Text style={styles.emptyText}>{t('reminders.no_reminders')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="notifications-outline" size={20} color="#1976d2" />
          <Text style={styles.widgetTitle}>{t('reminders.title')}</Text>
        </View>
        <TouchableOpacity onPress={onViewAllPress}>
          <Text style={styles.viewAllText}>{t('common.view_all')}</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={allItems.slice(0, maxItems)}
        renderItem={renderItem}
        keyExtractor={item => (item.id ? item.id.toString() : `${item.itemType}-${Date.now()}`)}
        scrollEnabled={false}
        contentContainerStyle={styles.listContainer}
      />
      
      {allItems.length > maxItems && (
        <TouchableOpacity 
          style={styles.moreButton}
          onPress={onViewAllPress}
        >
          <Text style={styles.moreButtonText}>
            {t('reminders.view_more', { count: allItems.length - maxItems })}
          </Text>
        </TouchableOpacity>
      )}

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#212121',
  },
  viewAllText: {
    color: '#1976d2',
    fontWeight: '500',
    fontSize: 14,
  },
  listContainer: {
    paddingBottom: 8,
  },
  reminderItem: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#9e9e9e',
  },
  moreButton: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  moreButtonText: {
    color: '#1976d2',
    fontWeight: '500',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#c62828',
    marginBottom: 8,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1976d2',
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  emptyText: {
    color: '#757575',
    marginLeft: 8,
  },
});

export default RemindersWidget;
