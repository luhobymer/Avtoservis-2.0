import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getNotifications, markNotificationAsRead } from '../api/notificationsService';
import { sendPushTokenToServer } from '../api/pushNotificationsService';

// Конфігурація сповіщень для додатку
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { isAuthenticated, getToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expoPushToken, setExpoPushToken] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications();
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const registerForPushNotifications = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(t('notifications.permission_required'));
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId
      })).data;
      setExpoPushToken(token);
      const { data } = await getToken();
      const authToken = data?.session?.access_token || null;
      await sendPushTokenToServer(token, authToken);
    } catch (error) {
      console.error('Failed to get push token:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data } = await getToken();
      const uid = data?.user?.id || null;
      const token = data?.session?.access_token || null;
      if (!uid) return;
      const list = await getNotifications(uid, token, 20, 0);
      setNotifications(list);
      setUnreadCount(list.filter(notification => !notification.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleNotificationPress = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id, await getToken());
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      // Навігація в залежності від типу сповіщення
      if (notification.type === 'appointment') {
        navigation.navigate('AppointmentDetails', { id: notification.referenceId });
      } else if (notification.type === 'service-record') {
        navigation.navigate('ServiceRecordDetails', { id: notification.referenceId });
      }
    } catch (error) {
      console.error('Failed to handle notification:', error);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('Notifications')}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="notifications-outline" size={24} color="#333" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#c62828',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
