import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axiosAuth from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';

export default function MyServicesScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mechanic, setMechanic] = useState(null);
  const [services, setServices] = useState([]);

  const isMaster = ['master', 'mechanic', 'admin'].includes(String(user?.role || '').toLowerCase());

  const loadMechanicAndServices = async () => {
    try {
      setLoading(true);
      const mechanicRes = await axiosAuth.get('/api/mechanics/me');
      const mechanicData = mechanicRes.data;
      if (!mechanicData?.id) {
        setMechanic(null);
        setServices([]);
        return;
      }
      setMechanic(mechanicData);

      const listRes = await axiosAuth.get(`/api/mechanics/${mechanicData.id}/services`, {
        params: { enabled: 1 },
      });
      const rows = Array.isArray(listRes.data) ? listRes.data : Array.isArray(listRes.data?.data) ? listRes.data.data : [];
      setServices(rows);
    } catch (error) {
      console.error('[MyServicesScreen] Failed to load mechanic services:', error);
      Alert.alert(t('common.error'), t('common.data_load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isMaster) {
      setLoading(false);
      return;
    }
    loadMechanicAndServices();
  }, [isMaster]);

  const renderServiceItem = ({ item }) => {
    const price = item.price_text != null ? String(item.price_text) : item.price != null ? `${item.price} грн` : '';
    const duration =
      item.duration_text != null
        ? String(item.duration_text)
        : item.duration != null
        ? `${item.duration} ${t('common.minutes', 'хв')}`
        : '';

    return (
      <View style={styles.item}>
        <View style={styles.iconContainer}>
          <Ionicons name="build-outline" size={24} color="#1976d2" />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name || t('services.unnamed', 'Без назви')}</Text>
          {!!item.description && <Text style={styles.description}>{item.description}</Text>}
          <View style={styles.metaRow}>
            {!!price && <Text style={styles.meta}>{price}</Text>}
            {!!duration && <Text style={styles.meta}>{duration}</Text>}
          </View>
        </View>
      </View>
    );
  };

  if (!isMaster) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          {t('services.only_for_masters', 'Цей розділ доступний лише для майстрів')}
        </Text>
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

  if (!mechanic) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={64} color="#ccc" />
        <Text style={styles.message}>
          {t(
            'errors.mechanicProfileNotFound',
            'Профіль механіка не знайдено. Налаштуйте його у веб-версії.'
          )}
        </Text>
      </View>
    );
  }

  if (!services.length) {
    return (
      <View style={styles.center}>
        <Ionicons name="construct-outline" size={64} color="#ccc" />
        <Text style={styles.message}>
          {t('services.noServices', 'У вас ще немає налаштованих послуг')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {t('services.for_mechanic', 'Послуги майстра')}{' '}
        {mechanic.first_name || mechanic.last_name ? `${mechanic.first_name || ''} ${mechanic.last_name || ''}`.trim() : ''}
      </Text>
      <FlatList
        data={services}
        renderItem={renderServiceItem}
        keyExtractor={(item) => String(item.id)}
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
  header: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    color: '#212121',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  description: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  meta: {
    marginRight: 12,
    fontSize: 13,
    color: '#1976d2',
  },
});

