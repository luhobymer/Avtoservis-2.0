import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
import * as vehiclesDao from '../api/dao/vehiclesDao';

export default function VehicleList({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchVehicles = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const data = user?.id ? await vehiclesDao.listByUser(user.id) : [];
      setVehicles(data);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
      setError(t('vehicles.fetch_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchVehicles();
    });

    return unsubscribe;
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVehicles(false);
  };

  const renderVehicleItem = ({ item }) => (
    <TouchableOpacity
      style={styles.vehicleCard}
      onPress={() => navigation.navigate('VehicleDetails', { id: item.id })}
    >
      {item.photoUrl ? (
        <Image 
          source={{ uri: item.photoUrl }} 
          style={styles.vehiclePhoto}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="car-outline" size={48} color="#ccc" />
        </View>
      )}

      <View style={styles.vehicleInfo}>
        <Text style={styles.vehicleName}>{item.brand} {item.model}</Text>
        <Text style={styles.vehicleYear}>{item.year}</Text>

        <View style={styles.vehicleDetails}>
          {item.licensePlate && (
            <View style={styles.detailItem}>
              <Ionicons name="card-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.licensePlate}</Text>
            </View>
          )}

          {item.mileage && (
            <View style={styles.detailItem}>
              <Ionicons name="speedometer-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.mileage} км</Text>
            </View>
          )}
        </View>

        {item.nextService && (
          <View style={styles.serviceAlert}>
            <Ionicons name="alert-circle-outline" size={16} color="#c62828" />
            <Text style={styles.serviceAlertText}>
              {t('vehicles.next_service')}: {new Date(item.nextService).toLocaleDateString()}
            </Text>
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

      <FlatList
        data={vehicles}
        renderItem={renderVehicleItem}
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
            <Ionicons name="car-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{t('vehicles.no_vehicles')}</Text>
          </View>
        }
      />

      <CustomButton
        title={t('vehicles.add_vehicle')}
        onPress={() => navigation.navigate('AddVehicle')}
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
    marginBottom: 8,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
  },
  vehiclePhoto: {
    width: '100%',
    height: 200,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfo: {
    padding: 16,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vehicleYear: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  vehicleDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 4,
    color: '#666',
  },
  serviceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  serviceAlertText: {
    marginLeft: 4,
    color: '#c62828',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
