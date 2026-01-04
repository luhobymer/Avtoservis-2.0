import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as vehiclesService from '../api/vehiclesService';
import CustomButton from '../components/CustomButton';

export default function ServiceRecordsManagement({ route, navigation }) {
  const { vehicleId } = route.params;
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [vehicle, setVehicle] = useState(null);

  const fetchRecords = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const data = await vehiclesService.getVehicleServiceRecords(vehicleId);
      setRecords(data);
      const v = await vehiclesService.getVehicleById(vehicleId);
      setVehicle(v || null);
    } catch (err) {
      console.error('Failed to fetch service records:', err);
      setError(t('service_records.fetch_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchRecords();
    });

    return unsubscribe;
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecords(false);
  };

  const renderServiceRecord = ({ item }) => (
    <TouchableOpacity
      style={styles.recordCard}
      onPress={() => navigation.navigate('ServiceRecordDetails', { id: item.id })}
    >
      <View style={styles.recordHeader}>
        <Text style={styles.serviceType}>{item.serviceType}</Text>
        <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.recordDetails}>
        {item.mileage && (
          <View style={styles.detailItem}>
            <Ionicons name="speedometer-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{item.mileage} км</Text>
          </View>
        )}

        {item.cost && (
          <View style={styles.detailItem}>
            <Ionicons name="cash-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{item.cost} грн</Text>
          </View>
        )}

        {item.performedBy && (
          <View style={styles.detailItem}>
            <Ionicons name="person-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{item.performedBy}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {vehicle && (
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>
            {vehicle.brand} {vehicle.model} ({vehicle.year})
          </Text>
          {vehicle.licensePlate && (
            <Text style={styles.licensePlate}>{vehicle.licensePlate}</Text>
          )}
        </View>
      )}

      <FlatList
        data={records}
        renderItem={renderServiceRecord}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976d2']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{t('service_records.no_records')}</Text>
          </View>
        }
      />

      <CustomButton
        title={t('service_records.add_record')}
        onPress={() => navigation.navigate('CreateServiceRecord', { vehicleId })}
        style={styles.addButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  vehicleInfo: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  licensePlate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceType: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  description: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  recordDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  addButton: {
    margin: 16,
    backgroundColor: '#1976d2',
  },
});
