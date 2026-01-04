import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { pickImage, checkGalleryPermissions, checkCameraPermissions, optimizeImage } from '../utils/imageUtils';
import { ocrManager } from '../utils/ocrUtils';
import { supabase } from '../api/supabaseClient';

export default function PartPhotoInput({ onPhotoSelect, onDetailsRecognized, vehicleId }) {
  const { t } = useTranslation();
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [partHistory, setPartHistory] = useState(null);

  const handlePickImage = async () => {
    try {
      const hasPermission = await checkGalleryPermissions();
      if (!hasPermission) {
        Alert.alert(t('common.error'), t('permissions.gallery_denied'));
        return;
      }

      const result = await pickImage();
      if (!result.canceled) {
        const optimizedUri = await optimizeImage(result.uri);
        setPhoto(optimizedUri);
        onPhotoSelect(optimizedUri);
        await recognizeDetails(optimizedUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('parts.photo_error'));
    }
  };

  const handleTakePhoto = async () => {
    try {
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) {
        Alert.alert(t('common.error'), t('permissions.camera_denied'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const optimizedUri = await optimizeImage(result.assets[0].uri);
        setPhoto(optimizedUri);
        onPhotoSelect(optimizedUri);
        await recognizeDetails(optimizedUri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error'), t('parts.photo_error'));
    }
  };

  const fetchPartHistory = async (partNumber, vehicleVin) => {
    try {
      if (!partNumber) return null;

      let vehicleId = null;
      let vehicleName = '';

      if (vehicleVin) {
        const { data: vehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .select('id, make, model, year, vin')
          .eq('vin', vehicleVin)
          .single();

        if (vehicleError) {
          console.error('Error fetching vehicle for part history:', vehicleError);
        } else if (vehicle) {
          vehicleId = vehicle.id;
          vehicleName = `${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`;
        }
      }

      let records = [];

      if (vehicleId) {
        const { data, error } = await supabase
          .from('service_records')
          .select('id, service_date, description, mileage, cost')
          .eq('vehicle_id', vehicleId)
          .order('service_date', { ascending: false });

        if (error) throw error;
        records = Array.isArray(data) ? data : [];
      } else {
        const { data, error } = await supabase
          .from('service_records')
          .select('id, service_date, description, mileage, cost')
          .order('service_date', { ascending: false })
          .limit(50);

        if (error) throw error;
        records = Array.isArray(data) ? data : [];
      }

      const filtered = records.filter(
        r => typeof r.description === 'string' && r.description.includes(partNumber)
      );

      const history = filtered.map(record => ({
        date: record.service_date,
        vehicleName,
        price: record.cost
      }));

      return history;
    } catch (error) {
      console.error('Error fetching part history:', error);
      return null;
    }
  };

  const recognizeDetails = async (uri) => {
    setLoading(true);
    try {
      // Використовуємо імпортований ocrManager напряму
      const details = await ocrManager.recognizePartDetails(uri);
      
      if (details) {
        console.log('Розпізнані дані запчастини:', details);
        
        // Отримуємо історію використання запчастини
        let history = null;
        if (details.partNumber) {
          history = await fetchPartHistory(details.partNumber, vehicleId);
          setPartHistory(history);
        }
        
        // Показуємо повідомлення про успішне розпізнавання
        Alert.alert(
          t('common.success'),
          t('parts.ocr_success'),
          [{ text: t('common.ok') }]
        );
        
        // Передаємо розпізнані дані батьківському компоненту
        onDetailsRecognized({ 
          ...details, 
          history: history || partHistory 
        });
      } else {
        Alert.alert(
          t('common.warning'),
          t('parts.ocr_no_data'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      console.error('Error recognizing details:', error);
      Alert.alert(t('common.error'), t('parts.ocr_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.photoButton}
        onPress={photo ? undefined : handlePickImage}
        disabled={loading}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={40} color="#666" />
            <Text style={styles.placeholderText}>{t('parts.add_photo')}</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.galleryButton]} 
          onPress={handlePickImage}
          disabled={loading}
        >
          <Ionicons name="images-outline" size={24} color="#fff" />
          <Text style={styles.buttonText}>{t('common.gallery')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.cameraButton]} 
          onPress={handleTakePhoto}
          disabled={loading}
        >
          <Ionicons name="camera-outline" size={24} color="#fff" />
          <Text style={styles.buttonText}>{t('common.camera')}</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>{t('parts.recognizing')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
  photoButton: {
    width: '100%',
    aspectRatio: 4/3,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  galleryButton: {
    backgroundColor: '#0066cc',
  },
  cameraButton: {
    backgroundColor: '#34c759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#0066cc',
    fontSize: 16,
  },
});
