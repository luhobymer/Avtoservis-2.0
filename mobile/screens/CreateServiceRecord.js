import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
import { Button, Dialog, Portal, Provider as PaperProvider } from 'react-native-paper';
import { createServiceRecord } from '../api/serviceRecordsService';
import { getAllVehicles } from '../api/vehiclesService';
import { compressImage } from '../utils/imageUtils';

import * as ImagePicker from 'expo-image-picker';

export default function CreateServiceRecord({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date(),
    serviceType: '',
    description: '',
    mileage: '',
    cost: '',
    parts: [],
    performedBy: '',
    photos: []
  });

  const validateVin = (vin) => {
    if (!vin || vin.length !== 17) return false;
    return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        const compressedImage = await compressImage(result.assets[0].uri);
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, compressedImage]
        }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('service_records.photo_error'));
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const data = await getAllVehicles();
      setVehicles(data);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      Alert.alert(t('common.error'), t('vehicles.fetch_error'));
    }
  };

  const handleSubmit = async () => {
    // Валідація даних
    if (!selectedVehicle || !validateVin(selectedVehicle.vin)) {
      Alert.alert(t('common.error'), t('service_records.invalid_vehicle'));
      return;
    }

    if (!formData.serviceType || !formData.description) {
      Alert.alert(t('common.error'), t('service_records.required_fields'));
      return;
    }

    if (formData.mileage && isNaN(parseInt(formData.mileage))) {
      Alert.alert(t('common.error'), t('service_records.invalid_mileage'));
      return;
    }

    if (formData.cost && isNaN(parseFloat(formData.cost))) {
      Alert.alert(t('common.error'), t('service_records.invalid_cost'));
      return;
    }

    setLoading(true);

    try {
      // Підготовка даних для відправки
      const serviceRecord = {
        vehicle_vin: selectedVehicle.vin || selectedVehicle.id,
        date: formData.date.toISOString(),
        serviceType: formData.serviceType,
        description: formData.description,
        mileage: formData.mileage ? parseInt(formData.mileage) : 0,
        cost: formData.cost ? parseFloat(formData.cost) : 0,
        parts: Array.isArray(formData.parts) ? formData.parts.join(', ') : formData.parts,
        performedBy: formData.performedBy || 'Сервісний центр',
        photos: formData.photos || []
      };

      const result = await createServiceRecord(serviceRecord);
      Alert.alert(
        t('common.success'),
        t('service_records.create_success'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('[CreateServiceRecord] Помилка при створенні запису:', error);
      Alert.alert(t('common.error'), t('service_records.create_error'));
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, date: selectedDate });
    }
  };

  return (
    <PaperProvider>
      <ScrollView style={styles.container}>
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>{t('service_records.vehicle')}</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.vehicleList}
          >
            {vehicles.map(vehicle => (
              <TouchableOpacity
                key={vehicle.vin}
                style={[
                  styles.vehicleCard,
                  selectedVehicle?.vin === vehicle.vin && styles.selectedVehicle
                ]}
                onPress={() => setSelectedVehicle(vehicle)}
              >
                <Ionicons 
                  name="car-outline" 
                  size={24} 
                  color={selectedVehicle?.vin === vehicle.vin ? '#fff' : '#666'} 
                />
                <Text 
                  style={[
                    styles.vehicleName,
                    selectedVehicle?.vin === vehicle.vin && styles.selectedText
                  ]}
                >
                  {vehicle.brand} {vehicle.model}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity 
            style={styles.dateInput} 
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.dateText}>
              {formData.date.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          <Portal>
            <Dialog visible={showDatePicker} onDismiss={() => setShowDatePicker(false)}>
              <Dialog.Title>{t('service_records.select_date')}</Dialog.Title>
              <Dialog.Content>
                <View style={styles.dialogContent}>
                  <View style={styles.datePickerControls}>
                    <Button mode="text" onPress={() => {
                      const newDate = new Date(formData.date);
                      newDate.setDate(newDate.getDate() - 1);
                      setFormData({ ...formData, date: newDate });
                    }}>
                      -
                    </Button>
                    <Text style={styles.dateValue}>{formData.date.getDate().toString().padStart(2, '0')}</Text>
                    <Button mode="text" onPress={() => {
                      const newDate = new Date(formData.date);
                      newDate.setDate(newDate.getDate() + 1);
                      setFormData({ ...formData, date: newDate });
                    }}>
                      +
                    </Button>
                  </View>
                  <Text style={styles.dateSeparator}>/</Text>
                  <View style={styles.datePickerControls}>
                    <Button mode="text" onPress={() => {
                      const newDate = new Date(formData.date);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setFormData({ ...formData, date: newDate });
                    }}>
                      -
                    </Button>
                    <Text style={styles.dateValue}>{(formData.date.getMonth() + 1).toString().padStart(2, '0')}</Text>
                    <Button mode="text" onPress={() => {
                      const newDate = new Date(formData.date);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setFormData({ ...formData, date: newDate });
                    }}>
                      +
                    </Button>
                  </View>
                  <Text style={styles.dateSeparator}>/</Text>
                  <View style={styles.datePickerControls}>
                    <Button mode="text" onPress={() => {
                      const newDate = new Date(formData.date);
                      newDate.setFullYear(newDate.getFullYear() - 1);
                      setFormData({ ...formData, date: newDate });
                    }}>
                      -
                    </Button>
                    <Text style={styles.dateValue}>{formData.date.getFullYear()}</Text>
                    <Button mode="text" onPress={() => {
                      const newDate = new Date(formData.date);
                      newDate.setFullYear(newDate.getFullYear() + 1);
                      setFormData({ ...formData, date: newDate });
                    }}>
                      +
                    </Button>
                  </View>
                </View>
              </Dialog.Content>
              <Dialog.Actions>
                <Button mode="text" onPress={() => setShowDatePicker(false)}>{t('common.cancel')}</Button>
                <Button mode="contained" onPress={() => onDateChange(formData.date)}>{t('common.ok')}</Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>

        <TextInput
          style={styles.input}
          placeholder={t('service_records.service_type')}
          value={formData.serviceType}
          onChangeText={(text) => setFormData({ ...formData, serviceType: text })}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('service_records.description')}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          multiline
          numberOfLines={4}
        />

        <TextInput
          style={styles.input}
          placeholder={t('service_records.mileage')}
          value={formData.mileage}
          onChangeText={(text) => setFormData({ ...formData, mileage: text })}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder={t('service_records.cost')}
          value={formData.cost}
          onChangeText={(text) => setFormData({ ...formData, cost: text })}
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
          <Ionicons name="camera-outline" size={24} color="#666" />
          <Text style={styles.photoButtonText}>{t('service_records.add_photo')}</Text>
        </TouchableOpacity>

        {formData.photos.length > 0 && (
          <ScrollView 
            horizontal 
            style={styles.photoList}
            showsHorizontalScrollIndicator={false}
          >
            {formData.photos.map((photo, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri: photo }} style={styles.photo} />
                <TouchableOpacity 
                  style={styles.removePhotoButton}
                  onPress={() => {
                    const newPhotos = [...formData.photos];
                    newPhotos.splice(index, 1);
                    setFormData(prev => ({ ...prev, photos: newPhotos }));
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <CustomButton
          title={loading ? '' : t('common.save')}
          onPress={handleSubmit}
          style={styles.submitButton}
          loading={loading}
        />
      </View>
    </ScrollView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  photoButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
  },
  photoList: {
    marginBottom: 12,
  },
  photoContainer: {
    position: 'relative',
    marginRight: 8,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  form: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  vehicleList: {
    marginBottom: 16,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    minWidth: 150,
  },
  selectedVehicle: {
    backgroundColor: '#1976d2',
  },
  vehicleName: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  selectedText: {
    color: '#fff',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  dateText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#1976d2',
  },
  dialogContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  datePickerControls: {
    flexDirection: 'column',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  dateValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 8,
    color: '#1976d2',
  },
  dateSeparator: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 4,
    color: '#666',
  },
});
