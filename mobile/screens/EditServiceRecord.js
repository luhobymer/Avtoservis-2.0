import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { updateServiceRecord } from '../api/serviceRecordsService';

export default function EditServiceRecord({ route, navigation }) {
  const { record } = route.params;
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date(record.date),
    serviceType: record.serviceType,
    description: record.description,
    mileage: record.mileage.toString(),
    cost: record.cost.toString(),
    parts: record.parts || [],
    performedBy: record.performedBy || '',
    photos: record.photos || []
  });

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, result.assets[0].uri]
        }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('service_records.photo_error'));
    }
  };

  const handleSubmit = async () => {
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
      const updatedRecord = {
        ...formData,
        id: record.id,
        vehicle_vin: record.vehicle_vin,
        date: formData.date.toISOString(),
        mileage: parseInt(formData.mileage) || 0,
        cost: parseFloat(formData.cost) || 0,
      };

      await updateServiceRecord(record.id, updatedRecord);

      navigation.goBack();
  } catch (error) {
      console.error('Failed to update service record:', error);
      Alert.alert(t('common.error'), t('service_records.update_error'));
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, date: selectedDate });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <TouchableOpacity 
          style={styles.dateInput} 
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#666" />
          <Text style={styles.dateText}>
            {formData.date.toLocaleDateString()}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={formData.date}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

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

        <TextInput
          style={styles.input}
          placeholder={t('service_records.performed_by')}
          value={formData.performedBy}
          onChangeText={(text) => setFormData({ ...formData, performedBy: text })}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  form: {
    padding: 16,
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
  submitButton: {
    marginTop: 16,
    backgroundColor: '#1976d2',
  },
});
