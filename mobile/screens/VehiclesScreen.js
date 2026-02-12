import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button } from 'react-native-paper';
import { getAllVehicles } from '../api/vehiclesService';
import FloatingActionButton from '../components/FloatingActionButton';

export default function VehiclesScreen({ navigation }) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await getAllVehicles();
      console.log('Отримано дані:', data ? data.length + ' автомобілів' : 'немає даних');
      
      setVehicles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      Alert.alert(t('common.error') || 'Помилка', t('vehicles.fetch_error') || 'Помилка отримання даних');
      
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchVehicles();
    } catch (error) {
      console.error('Помилка при оновленні даних:', error);
      Alert.alert(t('common.error'), t('vehicles.fetch_error'));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const renderVehicleItem = ({ item }) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate('VehicleDetails', { vehicleId: item.vin || item.id })}
    >
      <Card.Title title={`${item.brand} ${item.model}`} subtitle={`${item.year}`} />
      <Card.Content>
        <View style={styles.vehicleDetails}>
          <Text style={styles.detailText}>{t('vehicles.color')}: {item.color}</Text>
          <Text style={styles.detailText}>{t('vehicles.mileage')}: {item.mileage} км</Text>
          {item.nextService && (
            <Text style={styles.detailText}>
              {t('vehicles.next_service')}: {new Date(item.nextService).toLocaleDateString()}
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('vehicles.title')}</Text>
        <Button 
          mode="contained" 
          icon="plus" 
          style={styles.addButton}
          onPress={() => navigation.navigate('AddVehicle')}
        >
          {t('vehicles.add_vehicle')}
        </Button>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : vehicles.length > 0 ? (
        <FlatList
          data={vehicles}
          renderItem={renderVehicleItem}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2196F3']}
              tintColor={'#2196F3'}
            />
          }
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="car-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>
            {t('vehicles.no_vehicles')}
          </Text>
          <Button 
            mode="contained" 
            icon="plus" 
            onPress={() => navigation.navigate('AddVehicle')}
            style={styles.emptyButton}
          >
            {t('vehicles.add_vehicle')}
          </Button>
        </View>
      )}
      
      <FloatingActionButton 
        onPress={() => navigation.navigate('AddVehicle')}
        icon="add"
        color="#4CAF50"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  vehicleDetails: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#555',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  list: {
    paddingBottom: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 16,
  },
  emptyButton: {
    marginTop: 16,
  },
  addButton: {
    backgroundColor: '#1976d2',
    borderRadius: 4,
    marginLeft: 16
  }
});
