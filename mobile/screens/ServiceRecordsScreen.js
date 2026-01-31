import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { getAllServiceRecords } from '../api/serviceRecordsService';

export default function ServiceRecordsScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchServiceRecords = async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('Токен недоступний');

      const data = await getAllServiceRecords();
      const recordsData = Array.isArray(data) ? data : [];

      const normalized = recordsData.map(r => ({
        id: r.id,
        vehicle: {
          brand: r.vehicle?.make || r.vehicle?.brand || '',
          model: r.vehicle?.model || ''
        },
        date: r.service_date,
        serviceType: (r.description || '').split(':')[0] || 'Сервіс',
        description: r.description || '',
        status: 'completed',
        cost: Number(r.cost) || 0
      }));

      setRecords(normalized);
    } catch (error) {
      console.error('Failed to fetch service records:', error);
      Alert.alert(t('common.error'), t('service_records.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchServiceRecords();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchServiceRecords();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('ServiceRecordDetails', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.vehicleName}>{item.vehicle.brand} {item.vehicle.model}</Text>
        <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.serviceType}>{item.serviceType}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.status}>{t(`service_records.status.${item.status}`)}</Text>
        <Text style={styles.cost}>{item.cost} ₴</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={records}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976d2']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>{t('service_records.empty')}</Text>
          </View>
        }
      />
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => navigation.navigate('CreateServiceRecord')}
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
    padding: 16
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2'
  },
  date: {
    fontSize: 14,
    color: '#666'
  },
  cardContent: {
    marginBottom: 12
  },
  serviceType: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4
  },
  description: {
    fontSize: 14,
    color: '#666'
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  status: {
    fontSize: 14,
    color: '#1976d2'
  },
  cost: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
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
    shadowRadius: 4
  }
});
