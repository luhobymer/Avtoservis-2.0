import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axiosAuth from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';

export default function MyMechanicsScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mechanics, setMechanics] = useState([]);

  const isClient = String(user?.role || '').toLowerCase() === 'client';

  const fetchMechanics = async () => {
    try {
      setLoading(true);
      const response = await axiosAuth.get('/api/relationships/mechanics');
      const rows = Array.isArray(response.data) ? response.data : [];
      setMechanics(rows);
    } catch (error) {
      console.error('[MyMechanicsScreen] Failed to load mechanics:', error);
      Alert.alert(t('common.error'), t('common.data_load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isClient) {
      setLoading(false);
      return;
    }
    fetchMechanics();
  }, [isClient]);

  const openChatWithMechanic = (mechanic) => {
    if (!mechanic?.mechanic_id) return;
    navigation.navigate('ChatScreen', {
      recipientId: mechanic.mechanic_id,
      recipientName: mechanic.name || mechanic.email || t('auth.roleMaster'),
      recipientRole: 'master',
    });
  };

  const renderMechanicItem = ({ item }) => {
    const status = String(item.status || '').toLowerCase();
    let statusLabel = status;
    if (status === 'pending') statusLabel = t('common.pending', 'Очікує підтвердження');
    if (status === 'accepted') statusLabel = t('common.active', 'Активний механік');
    if (status === 'rejected') statusLabel = t('common.rejected', 'Відхилено');

    return (
      <TouchableOpacity style={styles.item} onPress={() => openChatWithMechanic(item)}>
        <View style={styles.avatar}>
          <Ionicons name="construct-outline" size={32} color="#1976d2" />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name || item.email || t('auth.roleMaster')}</Text>
          {!!item.email && <Text style={styles.secondary}>{item.email}</Text>}
          {!!item.phone && <Text style={styles.secondary}>{item.phone}</Text>}
          <Text style={styles.status}>{statusLabel}</Text>
        </View>
        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#1976d2" />
      </TouchableOpacity>
    );
  };

  if (!isClient) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('relationships.only_for_clients', 'Цей розділ доступний лише для клієнтів')}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  if (!mechanics.length) {
    return (
      <View style={styles.center}>
        <Ionicons name="construct-outline" size={64} color="#ccc" />
        <Text style={styles.message}>{t('relationships.no_mechanics', 'Немає підключених майстрів')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={mechanics}
        renderItem={renderMechanicItem}
        keyExtractor={(item) => String(item.id || `${item.client_id}-${item.mechanic_id}`)}
        contentContainerStyle={styles.list}
      />
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
  },
  avatar: {
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  secondary: {
    fontSize: 14,
    color: '#757575',
  },
  status: {
    marginTop: 4,
    fontSize: 13,
    color: '#1976d2',
  },
});

