import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { deleteServiceRecord, getServiceRecordById } from '../api/serviceRecordsService';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
 

export default function ServiceRecordDetails({ route, navigation }) {
  const { id } = route.params;
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchServiceRecord();
  }, []);

  const fetchServiceRecord = async () => {
    try {
      const data = await getServiceRecordById(id);
      const normalized = {
        id: data.id,
        date: data.service_date,
        serviceType: (data.description || '').split(':')[0] || 'Сервіс',
        description: data.description || '',
        mileage: data.mileage || 0,
        cost: Number(data.cost) || 0,
        vehicle_vin: data.vehicle_vin || null,
        parts: [],
        photos: [],
        performedBy: ''
      };
      setRecord(normalized);

      const vehicleData = normalized.vehicle_vin ? await vehiclesDao.getById(normalized.vehicle_vin) : null;
      if (vehicleData) setVehicle(vehicleData);
    } catch (error) {
      console.error('Failed to fetch service record:', error);
      Alert.alert(t('common.error'), t('service_records.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      t('service_records.delete_title'),
      t('service_records.delete_confirm'),
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
              await deleteServiceRecord(id);

              navigation.goBack();
            } catch (error) {
              console.error('Failed to delete service record:', error);
              Alert.alert(t('common.error'), t('service_records.delete_error'));
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

  if (!record || !vehicle) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('service_records.not_found')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{record.serviceType}</Text>
          <Text style={styles.date}>
            {new Date(record.date).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.vehicleInfo}>
          <Ionicons name="car-outline" size={24} color="#666" />
          <Text style={styles.vehicleName}>
            {vehicle.brand} {vehicle.model} ({vehicle.year})
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('service_records.description')}</Text>
          <Text style={styles.description}>{record.description}</Text>
        </View>

        <View style={styles.infoGrid}>
          {record.mileage && (
            <View style={styles.infoItem}>
              <Ionicons name="speedometer-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>{t('service_records.mileage')}</Text>
              <Text style={styles.infoValue}>{record.mileage} км</Text>
            </View>
          )}

          {record.cost && (
            <View style={styles.infoItem}>
              <Ionicons name="cash-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>{t('service_records.cost')}</Text>
              <Text style={styles.infoValue}>{record.cost} грн</Text>
            </View>
          )}

          {record.performedBy && (
            <View style={styles.infoItem}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>{t('service_records.performed_by')}</Text>
              <Text style={styles.infoValue}>{record.performedBy}</Text>
            </View>
          )}
        </View>

        {record.parts && record.parts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('service_records.parts')}</Text>
            {record.parts.map((part, index) => (
              <View key={index} style={styles.partItem}>
                <Text style={styles.partName}>{part.name}</Text>
                <Text style={styles.partInfo}>
                  {part.quantity} x {part.price} грн
                </Text>
              </View>
            ))}
          </View>
        )}

        {record.photos && record.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('service_records.photos')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoList}
            >
              {record.photos.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <CustomButton
            title={t('common.edit')}
            onPress={() => navigation.navigate('EditServiceRecord', { record })}
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
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
    color: '#666',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  vehicleName: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    marginHorizontal: -8,
  },
  infoItem: {
    width: '50%',
    padding: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  partItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  partName: {
    fontSize: 16,
    color: '#333',
  },
  partInfo: {
    fontSize: 14,
    color: '#666',
  },
  photoList: {
    marginHorizontal: -4,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#1976d2',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#d32f2f',
  },
});
