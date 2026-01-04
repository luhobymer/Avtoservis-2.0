import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';

export default function VehicleDetails({ route, navigation }) {
  const vin = route.params?.vehicleId || route.params?.id;
  const { t } = useTranslation();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchVehicleDetails();
  }, []);

  const fetchVehicleDetails = async () => {
    try {
      const v = await vehiclesDao.getById(vin);
      setVehicle({ ...v, make: v.brand });
    } catch (error) {
      console.error('Failed to fetch vehicle details:', error);
      Alert.alert(t('common.error'), t('vehicles.fetch_error'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      t('vehicles.delete_title'),
      t('vehicles.delete_confirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await vehiclesDao.deleteById(vin);
              navigation.goBack();
            } catch (error) {
              console.error('Failed to delete vehicle:', error);
              Alert.alert(t('common.error'), t('vehicles.delete_error'));
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('vehicles.not_found')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {vehicle.photoUrl ? (
        <Image 
          source={{ uri: vehicle.photoUrl }} 
          style={styles.photo}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="car-outline" size={64} color="#ccc" />
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{vehicle.make} {vehicle.model}</Text>
          <Text style={styles.year}>{vehicle.year}</Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="speedometer-outline" size={20} color="#666" />
            <Text style={styles.infoText}>{t('vehicles.mileage')}: {vehicle.mileage} км</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="color-palette-outline" size={20} color="#666" />
            <Text style={styles.infoText}>{t('vehicles.color')}: {vehicle.color}</Text>
          </View>

          {vehicle.vin && (
            <View style={styles.infoRow}>
              <Ionicons name="barcode-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{t('vehicles.vin')}: {vehicle.vin}</Text>
            </View>
          )}

          {vehicle.licensePlate && (
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{t('vehicles.license_plate')}: {vehicle.licensePlate}</Text>
            </View>
          )}
          
          {vehicle.engineType && (
            <View style={styles.infoRow}>
              <Ionicons name="construct-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{t('vehicles.engine_type')}: {t(`vehicles.engine_types.${vehicle.engineType}`)}</Text>
            </View>
          )}
          
          {vehicle.transmission && (
            <View style={styles.infoRow}>
              <Ionicons name="cog-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{t('vehicles.transmission')}: {t(`vehicles.transmissions.${vehicle.transmission}`)}</Text>
            </View>
          )}
          
          {vehicle.engineCapacity && (
            <View style={styles.infoRow}>
              <Ionicons name="flask-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{t('vehicles.engine_capacity')}: {vehicle.engineCapacity} л</Text>
            </View>
          )}
          
          {vehicle.power && (
            <View style={styles.infoRow}>
              <Ionicons name="flash-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{t('vehicles.power')}: {vehicle.power} к.с.</Text>
            </View>
          )}
        </View>

        {vehicle.nextService && (
          <View style={styles.serviceAlert}>
            <Ionicons name="alert-circle-outline" size={24} color="#c62828" />
            <Text style={styles.serviceAlertText}>
              {t('vehicles.next_service')}: {new Date(vehicle.nextService).toLocaleDateString()}
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <CustomButton
            title={t('common.edit')}
            onPress={() => navigation.navigate('EditVehicle', { vehicle })}
            style={styles.editButton}
          />
          <CustomButton
            title={deleting ? '' : t('common.delete')}
            onPress={handleDelete}
            style={styles.deleteButton}
            loading={deleting}
          />
        </View>
      </View>
    </ScrollView>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  photo: {
    width: '100%',
    height: 250,
  },
  photoPlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  year: {
    fontSize: 18,
    color: '#666',
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  serviceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  serviceAlertText: {
    flex: 1,
    fontSize: 16,
    color: '#c62828',
    marginLeft: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#1976d2',
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#c62828',
  },
});
