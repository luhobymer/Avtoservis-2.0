import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
import { pickImage, checkGalleryPermissions, checkCameraPermissions, optimizeImage } from '../utils/imageUtils';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { ocrManager } from '../utils/ocrUtils';
import * as vehiclesService from '../api/vehiclesService';

export default function EditVehicle({ route, navigation }) {
  const { vehicle } = route.params;
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [photo, setPhoto] = useState(vehicle.photoUrl);
  const [documentPhoto, setDocumentPhoto] = useState(vehicle.documentPhotoUrl);
  const [formData, setFormData] = useState({
    make: vehicle.make || vehicle.brand || '',
    model: vehicle.model || '',
    year: vehicle.year ? vehicle.year.toString() : '',
    vin: vehicle.vin || '',
    licensePlate: vehicle.licensePlate || '',
    color: vehicle.color || '',
    mileage: vehicle.mileage ? vehicle.mileage.toString() : '',
    engineType: vehicle.engineType || 'petrol',
    transmission: vehicle.transmission || 'manual',
    engineCapacity: vehicle.engineCapacity ? vehicle.engineCapacity.toString() : '',
    power: vehicle.power ? vehicle.power.toString() : '',
    registrationDate: vehicle.registrationDate || '',
    lastServiceDate: vehicle.lastServiceDate || '',
  });

  // Функція вибору фото автомобіля з галереї
  const pickVehicleImage = async () => {
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
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('vehicles.photo_error'));
    }
  };

  // Функція вибору фото для документа (техпаспорт)
  const pickDocumentImage = async () => {
    try {
      const hasPermission = await checkGalleryPermissions();
      if (!hasPermission) {
        Alert.alert(t('common.error'), t('permissions.gallery_denied'));
        return;
      }

      const result = await pickImage();
      if (!result.canceled) {
        setRecognizing(true);
        const optimizedUri = await optimizeImage(result.uri);
        setDocumentPhoto(optimizedUri);
        await recognizeDocumentData(optimizedUri);
        setRecognizing(false);
      }
    } catch (error) {
      console.error('Error picking document image:', error);
      Alert.alert(t('common.error'), t('vehicles.photo_error'));
      setRecognizing(false);
    }
  };

  // Зйомка фото автомобіля камерою
  const takeVehiclePhoto = async () => {
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
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error'), t('vehicles.photo_error'));
    }
  };

  // Зйомка фото документа камерою
  const takeDocumentPhoto = async () => {
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
        setRecognizing(true);
        const optimizedUri = await optimizeImage(result.assets[0].uri);
        setDocumentPhoto(optimizedUri);
        await recognizeDocumentData(optimizedUri);
        setRecognizing(false);
      }
    } catch (error) {
      console.error('Error taking document photo:', error);
      Alert.alert(t('common.error'), t('vehicles.photo_error'));
      setRecognizing(false);
    }
  };

  // Розпізнавання даних з фото документа
  const recognizeDocumentData = async (uri) => {
    try {
      console.log('ocrManager перед викликом:', ocrManager);
      console.log('Методи ocrManager:', Object.keys(ocrManager));
      console.log('Чи є функція recognizeVehicleDocument:', typeof ocrManager.recognizeVehicleDocument === 'function');
      
      const result = await ocrManager.recognizeVehicleDocument(uri);
      
      if (result) {
        // Оновлюємо дані форми з розпізнаними даними
        const updatedData = { ...formData };
        
        if (result.make) updatedData.make = result.make;
        if (result.model) updatedData.model = result.model;
        if (result.year) updatedData.year = result.year.toString();
        if (result.vin) updatedData.vin = result.vin;
        if (result.licensePlate) updatedData.licensePlate = result.licensePlate;
        if (result.color) updatedData.color = result.color;
        if (result.engineType) updatedData.engineType = result.engineType;
        if (result.engineCapacity) updatedData.engineCapacity = result.engineCapacity.toString();
        if (result.power) updatedData.power = result.power.toString();
        if (result.registrationDate) updatedData.registrationDate = result.registrationDate;
        
        setFormData(updatedData);
        
        // Перевіряємо, чи були розпізнані хоча б деякі дані
        const recognizedFields = Object.keys(result).filter(key => 
          result[key] !== null && result[key] !== undefined
        );
        
        if (recognizedFields.length > 0) {
          Alert.alert(
            t('common.success'),
            t('vehicles.ocr_success'),
            [{ text: t('common.ok') }]
          );
        } else {
          Alert.alert(
            t('common.warning'),
            t('vehicles.ocr_partial_data'),
            [{ text: t('common.ok') }]
          );
        }
      } else {
        Alert.alert(
          t('common.warning'),
          t('vehicles.ocr_no_data'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      console.error('Error recognizing document:', error);
      Alert.alert(
        t('common.error'),
        t('vehicles.ocr_error'),
        [{ text: t('common.ok') }]
      );
    }
  };

  const validateForm = () => {
    // Валідація обов'язкових полів
    if (!formData.make || !formData.model || !formData.year) {
      Alert.alert(t('common.error'), t('vehicles.required_fields'));
      return false;
    }

    // Валідація року
    const yearNum = parseInt(formData.year);
    const currentYear = new Date().getFullYear();
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear) {
      Alert.alert(t('common.error'), t('validation.invalid_year'));
      return false;
    }

    // Валідація пробігу
    if (formData.mileage && isNaN(parseInt(formData.mileage))) {
      Alert.alert(t('common.error'), t('validation.invalid_mileage'));
      return false;
    }

    // Валідація VIN-коду (17 символів, тільки букви та цифри)
    if (formData.vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(formData.vin)) {
      Alert.alert(t('common.error'), t('validation.invalid_vin'));
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const updatedVehicle = {
        id: vehicle.id,
        make: formData.make,
        model: formData.model,
        year: parseInt(formData.year),
        license_plate: formData.licensePlate,
        color: formData.color,
        mileage: parseInt(formData.mileage) || 0
      };

      const updated = await vehiclesService.updateVehicle(vehicle.id, updatedVehicle);
      
      Alert.alert(t('common.success'), t('vehicles.edit_success'));

      navigation.goBack();
    } catch (error) {
      console.error('Failed to update vehicle:', error);
      Alert.alert(t('common.error'), t('vehicles.update_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container}>
        {/* Фото автомобіля */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('vehicles.vehicle_photo')}</Text>
          <TouchableOpacity style={styles.photoContainer} onPress={pickVehicleImage}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="car-outline" size={48} color="#666" />
                <Text style={styles.photoText}>{t('vehicles.add_photo')}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.photoButtonContainer}>
            <TouchableOpacity style={styles.photoButton} onPress={pickVehicleImage}>
              <Ionicons name="images-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('common.gallery')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.photoButton} onPress={takeVehiclePhoto}>
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('common.camera')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Фото документів */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('vehicles.document_photo')}</Text>
          <Text style={styles.sectionDescription}>{t('vehicles.document_description')}</Text>
          
          <TouchableOpacity 
            style={styles.photoContainer} 
            onPress={pickDocumentImage}
          >
            {documentPhoto ? (
              <Image source={{ uri: documentPhoto }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="document-outline" size={48} color="#666" />
                <Text style={styles.photoText}>{t('vehicles.add_document')}</Text>
              </View>
            )}
            {recognizing && (
              <View style={styles.recognizingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.recognizingText}>{t('vehicles.recognizing')}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.photoButtonContainer}>
            <TouchableOpacity 
              style={styles.photoButton} 
              onPress={pickDocumentImage}
            >
              <Ionicons name="images-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('common.gallery')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.photoButton} 
              onPress={takeDocumentPhoto}
            >
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('common.camera')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>{t('vehicles.details')}</Text>
          
          <TextInput
            style={styles.input}
            placeholder={t('vehicles.make')}
            value={formData.make}
            onChangeText={(text) => setFormData(prev => ({ ...prev, make: text }))}
          />

          <TextInput
            style={styles.input}
            placeholder={t('vehicles.model')}
            value={formData.model}
            onChangeText={(text) => setFormData(prev => ({ ...prev, model: text }))}
          />

          <TextInput
            style={styles.input}
            placeholder={t('vehicles.year')}
            value={formData.year}
            onChangeText={(text) => setFormData(prev => ({ ...prev, year: text }))}
            keyboardType="numeric"
            maxLength={4}
          />

          <TextInput
            style={styles.input}
            placeholder={t('vehicles.vin')}
            value={formData.vin}
            onChangeText={(text) => setFormData(prev => ({ ...prev, vin: text.toUpperCase() }))}
            autoCapitalize="characters"
            maxLength={17}
          />

          <TextInput
            style={styles.input}
            placeholder={t('vehicles.license_plate')}
            value={formData.licensePlate}
            onChangeText={(text) => setFormData(prev => ({ ...prev, licensePlate: text.toUpperCase() }))}
            autoCapitalize="characters"
          />

          <TextInput
            style={styles.input}
            placeholder={t('vehicles.color')}
            value={formData.color}
            onChangeText={(text) => setFormData(prev => ({ ...prev, color: text }))}
          />

          <TextInput
            style={styles.input}
            placeholder={t('vehicles.mileage')}
            value={formData.mileage}
            onChangeText={(text) => setFormData(prev => ({ ...prev, mileage: text }))}
            keyboardType="numeric"
          />
          
          <View style={styles.pickerContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.engine_type')}</Text>
            <Picker
              selectedValue={formData.engineType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, engineType: value }))}
              style={styles.picker}
            >
              <Picker.Item label={t('vehicles.engine_types.petrol')} value="petrol" />
              <Picker.Item label={t('vehicles.engine_types.diesel')} value="diesel" />
              <Picker.Item label={t('vehicles.engine_types.electric')} value="electric" />
              <Picker.Item label={t('vehicles.engine_types.hybrid')} value="hybrid" />
              <Picker.Item label={t('vehicles.engine_types.gas')} value="gas" />
            </Picker>
          </View>
          
          <View style={styles.pickerContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.transmission')}</Text>
            <Picker
              selectedValue={formData.transmission}
              onValueChange={(value) => setFormData(prev => ({ ...prev, transmission: value }))}
              style={styles.picker}
            >
              <Picker.Item label={t('vehicles.transmissions.manual')} value="manual" />
              <Picker.Item label={t('vehicles.transmissions.automatic')} value="automatic" />
              <Picker.Item label={t('vehicles.transmissions.semi_auto')} value="semi_auto" />
              <Picker.Item label={t('vehicles.transmissions.cvt')} value="cvt" />
            </Picker>
          </View>
          
          <TextInput
            style={styles.input}
            placeholder={t('vehicles.engine_capacity')}
            value={formData.engineCapacity}
            onChangeText={(text) => setFormData(prev => ({ ...prev, engineCapacity: text }))}
            keyboardType="numeric"
          />
          
          <TextInput
            style={styles.input}
            placeholder={t('vehicles.power')}
            value={formData.power}
            onChangeText={(text) => setFormData(prev => ({ ...prev, power: text }))}
            keyboardType="numeric"
          />

          <CustomButton
            title={t('common.save')}
            onPress={handleSubmit}
            style={styles.submitButton}
            loading={loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  sectionContainer: {
    marginBottom: 20,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  photoContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  photoText: {
    marginTop: 8,
    color: '#666',
    fontSize: 16,
  },
  photoButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 5,
  },
  photoButtonText: {
    color: '#fff',
    marginLeft: 8,
  },
  recognizingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recognizingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  form: {
    padding: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
  },
  pickerContainer: {
    marginBottom: 12,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#1976d2',
  },
});
