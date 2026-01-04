import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { uk, ru, enUS } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '../api/notificationsService';

const NotificationsScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { user, getToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  // Визначення локалі для date-fns
  const getLocale = () => {
    switch (i18n.language) {
      case 'uk':
        return uk;
      case 'ru':
        return ru;
      default:
        return enUS;
    }
  };

  // Завантаження сповіщень
  const loadNotifications = async (refresh = false) => {
    try {
      if (refresh) {
        setPage(0);
        setHasMore(true);
      }

      if (!hasMore && !refresh) return;

      const newPage = refresh ? 0 : page;
      setLoading(true);
      
      const token = await getToken();
      const result = await getNotifications(user.id, token, limit, newPage * limit);
      
      if (result.length < limit) {
        setHasMore(false);
      }
      
      if (refresh) {
        setNotifications(result);
      } else {
        setNotifications(prev => [...prev, ...result]);
      }
      
      setPage(newPage + 1);
    } catch (error) {
      console.error('[NotificationsScreen] Помилка завантаження сповіщень:', error);
      Alert.alert(t('common.error'), t('notifications.load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Завантаження сповіщень при монтуванні компонента
  useEffect(() => {
    loadNotifications();
  }, []);

  // Оновлення сповіщень при переході на екран
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadNotifications(true);
    });

    return unsubscribe;
  }, [navigation]);

  // Обробник оновлення списку (pull-to-refresh)
  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications(true);
  };

  // Обробник завантаження наступної сторінки
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadNotifications();
    }
  };

  // Позначення сповіщення як прочитане
  const handleMarkAsRead = async (notificationId) => {
    try {
      const token = await getToken();
      await markNotificationAsRead(notificationId, token);
      
      // Оновлюємо стан локально
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true } 
            : notification
        )
      );
    } catch (error) {
      console.error('[NotificationsScreen] Помилка позначення сповіщення як прочитане:', error);
    }
  };

  // Позначення всіх сповіщень як прочитані
  const handleMarkAllAsRead = async () => {
    try {
      const token = await getToken();
      await markAllNotificationsAsRead(user.id, token);
      
      // Оновлюємо стан локально
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      
      Alert.alert(t('notifications.success'), t('notifications.all_marked_read'));
    } catch (error) {
      console.error('[NotificationsScreen] Помилка позначення всіх сповіщень як прочитані:', error);
      Alert.alert(t('common.error'), t('notifications.mark_all_error'));
    }
  };

  // Видалення сповіщення
  const handleDelete = async (notificationId) => {
    try {
      const token = await getToken();
      await deleteNotification(notificationId, token);
      
      // Видаляємо сповіщення зі стану
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
    } catch (error) {
      console.error('[NotificationsScreen] Помилка видалення сповіщення:', error);
      Alert.alert(t('common.error'), t('notifications.delete_error'));
    }
  };

  // Підтвердження видалення сповіщення
  const confirmDelete = (notificationId) => {
    Alert.alert(
      t('notifications.delete_title'),
      t('notifications.delete_confirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('common.delete'),
          onPress: () => handleDelete(notificationId),
          style: 'destructive'
        }
      ]
    );
  };

  // Отримання іконки для типу сповіщення
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'appointment_reminder':
        return 'calendar';
      case 'appointment_status':
        return 'car';
      case 'maintenance_reminder':
        return 'construct';
      case 'mileage_request':
        return 'speedometer';
      case 'chat':
        return 'chatbubbles';
      case 'system':
      default:
        return 'notifications';
    }
  };

  // Отримання кольору для типу сповіщення
  const getNotificationColor = (type) => {
    switch (type) {
      case 'appointment_reminder':
        return '#4caf50';
      case 'appointment_status':
        return '#2196f3';
      case 'maintenance_reminder':
        return '#ff9800';
      case 'mileage_request':
        return '#9c27b0';
      case 'chat':
        return '#00bcd4';
      case 'system':
      default:
        return '#757575';
    }
  };

  // Форматування дати
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'PPp', { locale: getLocale() });
    } catch (error) {
      return dateString;
    }
  };

  // Рендер елемента сповіщення
  const renderNotification = ({ item }) => {
    const iconName = getNotificationIcon(item.type);
    const iconColor = getNotificationColor(item.type);
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.is_read && styles.unreadNotification
        ]}
        onPress={() => {
          if (!item.is_read) {
            handleMarkAsRead(item.id);
          }
          
          // Обробка натискання на сповіщення в залежності від типу
          if (item.type === 'appointment_reminder' && item.data?.appointment_id) {
            navigation.navigate('AppointmentDetails', { appointmentId: item.data.appointment_id });
          } else if (item.type === 'chat' && item.data?.chat_id) {
            navigation.navigate('Chat', { id: item.data.chat_id });
          }
        }}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={iconName} size={24} color={iconColor} />
        </View>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => confirmDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#f44336" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Рендер роздільника між елементами
  const renderSeparator = () => <View style={styles.separator} />;

  // Рендер порожнього списку
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color="#bdbdbd" />
      <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
    </View>
  );

  // Рендер футера списку
  const renderFooter = () => {
    if (!loading || refreshing) return null;
    
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color="#2196f3" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {notifications.length > 0 && (
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllAsRead}
        >
          <Text style={styles.markAllText}>{t('notifications.mark_all_read')}</Text>
        </TouchableOpacity>
      )}
      
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id.toString()}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={!loading && renderEmpty()}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2196f3']}
            tintColor="#2196f3"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={
          notifications.length === 0 ? styles.listContentEmpty : styles.listContent
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingBottom: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  unreadNotification: {
    backgroundColor: '#e3f2fd',
  },
  iconContainer: {
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flex: 1,
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
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#9e9e9e',
  },
  deleteButton: {
    padding: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
  footerContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  markAllButton: {
    backgroundColor: '#2196f3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    margin: 16,
    marginBottom: 0,
    borderRadius: 8,
    alignItems: 'center',
  },
  markAllText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default NotificationsScreen;
