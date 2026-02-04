import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import CustomButton from '../components/CustomButton';
import { pickImage, checkGalleryPermissions, checkCameraPermissions, optimizeImage } from '../utils/imageUtils';
import { ocrManager } from '../utils/ocrUtils';
import { Picker } from '@react-native-picker/picker';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import { brandModelYears, getVehicleSpecs } from '../data/vehicleData';
import axiosAuth from '../api/axiosConfig';

export default function AddVehicle({ navigation }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [documentPhoto, setDocumentPhoto] = useState(null);
  const [licensePlatePhoto, setLicensePlatePhoto] = useState(null);
  
  // Дані для випадаючих списків
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [colors, setColors] = useState([
    { id: 'black', name: 'Black' },
    { id: 'white', name: 'White' },
    { id: 'gray', name: 'Gray' },
    { id: 'silver', name: 'Silver' },
    { id: 'red', name: 'Red' },
    { id: 'blue', name: 'Blue' },
    { id: 'green', name: 'Green' },
    { id: 'yellow', name: 'Yellow' },
    { id: 'brown', name: 'Brown' },
    { id: 'orange', name: 'Orange' },
    { id: 'purple', name: 'Purple' },
    { id: 'beige', name: 'Beige' }
  ]);
  
  const [availableSpecs, setAvailableSpecs] = useState({
    engines: ['petrol', 'diesel', 'gas', 'hybrid', 'electric'],
    transmissions: ['manual', 'automatic', 'robot', 'variator']
  });

  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: '',
    vin: '',
    licensePlate: '',
    color: '',
    mileage: '',
    engineType: '',
    transmission: '',
    engineCapacity: '',
    power: '',
    registrationDate: '',
    lastServiceDate: '',
  });
  
  // Ініціалізація списку марок
  useEffect(() => {
    const sortedMakes = Object.keys(brandModelYears).sort((a, b) => a.localeCompare(b));
    setMakes(sortedMakes);
  }, []);

  // Оновлення моделей при зміні марки
  useEffect(() => {
    if (formData.make && brandModelYears[formData.make]) {
      const modelList = Object.keys(brandModelYears[formData.make]).sort();
      setModels(modelList);
    } else {
      setModels([]);
    }
  }, [formData.make]);

  // Оновлення років при зміні моделі
  useEffect(() => {
    if (formData.make && formData.model && brandModelYears[formData.make] && brandModelYears[formData.make][formData.model]) {
      setYears(brandModelYears[formData.make][formData.model]);
    } else {
      setYears([]);
    }
  }, [formData.make, formData.model]);

  // Оновлення специфікацій (двигун/КПП) при зміні року
  useEffect(() => {
    if (formData.make && formData.model && formData.year) {
      const specs = getVehicleSpecs(formData.make, formData.model, formData.year);
      setAvailableSpecs(specs);
      
      // Скидання, якщо поточне значення не доступне
      if (formData.engineType && !specs.engines.includes(formData.engineType)) {
        setFormData(prev => ({ ...prev, engineType: '' }));
      }
      if (formData.transmission && !specs.transmissions.includes(formData.transmission)) {
        setFormData(prev => ({ ...prev, transmission: '' }));
      }
    }
  }, [formData.make, formData.model, formData.year]);

  // Логіка для електромобілів (очищення об'єму)
  useEffect(() => {
    if (formData.engineType === 'electric') {
      if (formData.engineCapacity !== '') {
        setFormData(prev => ({ ...prev, engineCapacity: '' }));
      }
    }
  }, [formData.engineType]);

  // Ініціалізація OCR
  useEffect(() => {
    const initializeOCR = async () => {
      try {
        if (!ocrManager.initialized) {
            await ocrManager.initialize();
        }
      } catch (error) {
        console.error('Помилка ініціалізації OCR:', error);
      }
    };
    initializeOCR();
  }, []);

  // Пошук за номером
  const handleLookupByPlate = async () => {
    if (!formData.licensePlate) {
        Alert.alert(t('common.error'), t('validation.enter_license_plate'));
        return;
    }

    setLookupLoading(true);
    try {
        const normalizeLicensePlate = (plate) => {
            if (!plate) return null;
            return plate.replace(/[\s-]/g, '').toUpperCase();
        };

        const normalizedPlate = normalizeLicensePlate(formData.licensePlate);
        
        const response = await axiosAuth.get('/api/vehicle-registry', {
            params: { license_plate: normalizedPlate }
        });

        if (response.data) {
            const data = response.data;
            
            // Маппінг типу палива
            let engineType = '';
            const fuelRaw = String(data.fuel_type || '').toUpperCase();
            if (fuelRaw.includes('BENZINE') || fuelRaw.includes('PETROL')) engineType = 'petrol';
            else if (fuelRaw.includes('DIESEL')) engineType = 'diesel';
            else if (fuelRaw.includes('GAS')) engineType = 'gas';
            else if (fuelRaw.includes('ELECTRO') || fuelRaw.includes('ELECTRIC')) engineType = 'electric';
            else if (fuelRaw.includes('HYBRID')) engineType = 'hybrid';

            // Маппінг кольору (спрощений, можна покращити)
            let color = '';
            const colorRaw = String(data.color || '').toLowerCase();
            const foundColor = colors.find(c => c.id === colorRaw || c.name.toLowerCase() === colorRaw);
            if (foundColor) color = foundColor.id;

            setFormData(prev => ({
                ...prev,
                make: data.brand || prev.make,
                model: data.model || prev.model,
                year: data.make_year ? String(data.make_year) : prev.year,
                vin: data.vin || prev.vin,
                color: color || prev.color,
                engineType: engineType || prev.engineType,
                engineCapacity: data.engine_volume ? String(data.engine_volume) : prev.engineCapacity,
                licensePlate: data.n_reg_new || data.license_plate || normalizedPlate
            }));
            
            Alert.alert(t('common.success'), t('vehicles.found_success'));
        } else {
            Alert.alert(t('common.info'), t('vehicles.not_found'));
        }
    } catch (error) {
        console.error('Lookup error:', error);
        Alert.alert(t('common.error'), t('vehicles.lookup_error'));
    } finally {
        setLookupLoading(false);
    }
  };

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

  const pickDocumentImage = async () => {
    // ... existing logic for document OCR ...
    // Note: For brevity, keeping simple or calling existing utils. 
    // Assuming recognizeDocument logic handles form update.
    // Re-implementing simplified version that uses ocrUtils
    try {
        const hasPermission = await checkGalleryPermissions();
        if (!hasPermission) return;
        const result = await pickImage();
        if (!result.canceled) {
            setRecognizing(true);
            const optimizedUri = await optimizeImage(result.uri);
            setDocumentPhoto(optimizedUri);
            const data = await ocrManager.recognizeVehicleDocument(optimizedUri);
            if (data) updateFormWithOCRData(data);
            setRecognizing(false);
        }
    } catch (e) {
        setRecognizing(false);
        console.error(e);
    }
  };

  const pickLicensePlateImage = async () => {
      try {
          const hasPermission = await checkGalleryPermissions();
          if (!hasPermission) return;
          const result = await pickImage();
          if (!result.canceled) {
              setRecognizing(true);
              const optimizedUri = await optimizeImage(result.uri);
              setLicensePlatePhoto(optimizedUri);
              const data = await ocrManager.recognizeLicensePlateAndGetVehicleData(optimizedUri);
              if (data) updateFormWithOCRData(data);
              setRecognizing(false);
          }
      } catch (e) {
          setRecognizing(false);
          console.error(e);
      }
  };

  const takeVehiclePhoto = async () => {
      // Similar to pickVehicleImage but with camera
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) return;
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled) {
          const optimizedUri = await optimizeImage(result.assets[0].uri);
          setPhoto(optimizedUri);
      }
  };

  const takeDocumentPhoto = async () => {
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) return;
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled) {
          setRecognizing(true);
          const optimizedUri = await optimizeImage(result.assets[0].uri);
          setDocumentPhoto(optimizedUri);
          const data = await ocrManager.recognizeVehicleDocument(optimizedUri);
          if (data) updateFormWithOCRData(data);
          setRecognizing(false);
      }
  };

  const takeLicensePlatePhoto = async () => {
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) return;
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled) {
          setRecognizing(true);
          const optimizedUri = await optimizeImage(result.assets[0].uri);
          setLicensePlatePhoto(optimizedUri);
          const data = await ocrManager.recognizeLicensePlateAndGetVehicleData(optimizedUri);
          if (data) updateFormWithOCRData(data);
          setRecognizing(false);
      }
  };

  const updateFormWithOCRData = (data) => {
      setFormData(prev => ({
          ...prev,
          make: data.make || prev.make,
          model: data.model || prev.model,
          year: data.year ? String(data.year) : prev.year,
          vin: data.vin || prev.vin,
          licensePlate: data.licensePlate || prev.licensePlate,
          // color mapping logic might be needed
          color: data.color ? (colors.find(c => c.name.toLowerCase() === data.color.toLowerCase())?.id || data.color) : prev.color,
          engineType: data.engineType || prev.engineType,
          engineCapacity: data.engineVolume ? String(data.engineVolume) : prev.engineCapacity
      }));
  };

  const validateForm = () => {
    if (!formData.make) { Alert.alert(t('common.error'), t('validation.please_select_make')); return false; }
    if (!formData.model) { Alert.alert(t('common.error'), t('validation.please_select_model')); return false; }
    if (!formData.year) { Alert.alert(t('common.error'), t('validation.please_select_year')); return false; }
    if (formData.vin && formData.vin.length !== 17) { Alert.alert(t('common.error'), t('validation.invalid_vin')); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const vehicleData = {
        make: formData.make,
        model: formData.model,
        year: formData.year ? Number(formData.year) : null,
        vin: formData.vin,
        licensePlate: formData.licensePlate,
        color: formData.color,
        mileage: formData.mileage ? parseInt(formData.mileage, 10) : null,
        engine_type: formData.engineType,
        transmission: formData.transmission,
        engine_capacity: formData.engineCapacity ? parseFloat(formData.engineCapacity) : null,
        power: formData.power ? parseInt(formData.power, 10) : null
      };
      
      await vehiclesDao.create(vehicleData, user?.id);
      Alert.alert(t('common.success'), t('vehicles.add_success'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
    } catch (error) {
      console.error('Error adding vehicle:', error);
      Alert.alert(t('common.error'), t('vehicles.add_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView>
        {/* Photo Sections - simplified for brevity, assume they exist as in original */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('vehicles.photo')}</Text>
          <TouchableOpacity style={styles.photoContainer} onPress={pickVehicleImage}>
             {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <View style={styles.photoPlaceholder}><Ionicons name="car-outline" size={64} color="#666" /><Text style={styles.photoText}>{t('vehicles.add_photo')}</Text></View>}
          </TouchableOpacity>
          <View style={styles.photoButtonContainer}>
             <TouchableOpacity style={styles.photoButton} onPress={takeVehiclePhoto}><Ionicons name="camera-outline" size={24} color="#fff" /><Text style={styles.photoButtonText}>{t('vehicles.take_photo')}</Text></TouchableOpacity>
             <TouchableOpacity style={styles.photoButton} onPress={pickVehicleImage}><Ionicons name="images-outline" size={24} color="#fff" /><Text style={styles.photoButtonText}>{t('vehicles.pick_from_gallery')}</Text></TouchableOpacity>
          </View>
        </View>

         <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('vehicles.documents')}</Text>
          <TouchableOpacity style={styles.photoContainer} onPress={pickDocumentImage}>
             {documentPhoto ? <Image source={{ uri: documentPhoto }} style={styles.photo} /> : <View style={styles.photoPlaceholder}><Ionicons name="document-text-outline" size={64} color="#666" /><Text style={styles.photoText}>{t('vehicles.add_photo')}</Text></View>}
             {recognizing && <View style={styles.recognizingOverlay}><ActivityIndicator size="large" color="#fff" /><Text style={styles.recognizingText}>{t('vehicles.recognizing')}</Text></View>}
          </TouchableOpacity>
          <View style={styles.photoButtonContainer}>
             <TouchableOpacity style={styles.photoButton} onPress={takeDocumentPhoto}><Ionicons name="camera-outline" size={24} color="#fff" /><Text style={styles.photoButtonText}>{t('vehicles.take_photo')}</Text></TouchableOpacity>
             <TouchableOpacity style={styles.photoButton} onPress={pickDocumentImage}><Ionicons name="images-outline" size={24} color="#fff" /><Text style={styles.photoButtonText}>{t('vehicles.pick_from_gallery')}</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('vehicles.license_plate_photo')}</Text>
          <TouchableOpacity style={styles.photoContainer} onPress={pickLicensePlateImage}>
             {licensePlatePhoto ? <Image source={{ uri: licensePlatePhoto }} style={styles.photo} /> : <View style={styles.photoPlaceholder}><Ionicons name="car-sport-outline" size={64} color="#666" /><Text style={styles.photoText}>{t('vehicles.add_license_plate')}</Text></View>}
             {recognizing && <View style={styles.recognizingOverlay}><ActivityIndicator size="large" color="#fff" /><Text style={styles.recognizingText}>{t('vehicles.recognizing')}</Text></View>}
          </TouchableOpacity>
          <View style={styles.photoButtonContainer}>
             <TouchableOpacity style={styles.photoButton} onPress={takeLicensePlatePhoto}><Ionicons name="camera-outline" size={24} color="#fff" /><Text style={styles.photoButtonText}>{t('vehicles.take_photo')}</Text></TouchableOpacity>
             <TouchableOpacity style={styles.photoButton} onPress={pickLicensePlateImage}><Ionicons name="images-outline" size={24} color="#fff" /><Text style={styles.photoButtonText}>{t('vehicles.pick_from_gallery')}</Text></TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>{t('vehicles.details')}</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.license_plate')}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TextInput
                    style={[styles.input, {flex: 1, marginBottom: 0}]}
                    placeholder={t('vehicles.license_plate')}
                    value={formData.licensePlate}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, licensePlate: text.toUpperCase() }))}
                    autoCapitalize="characters"
                />
                <TouchableOpacity 
                    style={[styles.searchButton, (!formData.licensePlate || lookupLoading) && styles.disabledButton]} 
                    onPress={handleLookupByPlate}
                    disabled={!formData.licensePlate || lookupLoading}
                >
                    {lookupLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
                </TouchableOpacity>
            </View>
          </View>

          <View style={styles.pickerContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.make')}</Text>
            <Picker
              selectedValue={formData.make}
              onValueChange={(value) => setFormData(prev => ({ ...prev, make: value, model: '', year: '' }))}
              style={styles.picker}
            >
              <Picker.Item label={t('vehicles.select_make')} value="" />
              {makes.map((make) => (
                <Picker.Item key={make} label={make} value={make} />
              ))}
            </Picker>
          </View>
          
          <View style={styles.pickerContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.model')}</Text>
            <Picker
              selectedValue={formData.model}
              onValueChange={(value) => setFormData(prev => ({ ...prev, model: value, year: '' }))}
              style={styles.picker}
              enabled={models.length > 0}
            >
              <Picker.Item label={t('vehicles.select_model')} value="" />
              {models.map((model) => (
                <Picker.Item key={model} label={model} value={model} />
              ))}
            </Picker>
          </View>
          
          <View style={styles.pickerContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.year')}</Text>
            <Picker
              selectedValue={formData.year}
              onValueChange={(value) => setFormData(prev => ({ ...prev, year: value }))}
              style={styles.picker}
              enabled={years.length > 0}
            >
              <Picker.Item label={t('vehicles.select_year')} value="" />
              {years.map(year => (
                <Picker.Item label={String(year)} value={String(year)} key={year} />
              ))}
            </Picker>
          </View>
          
          <TextInput
            style={styles.input}
            placeholder={t('vehicles.vin')}
            value={formData.vin}
            onChangeText={(text) => setFormData(prev => ({ ...prev, vin: text.toUpperCase() }))}
            autoCapitalize="characters"
            maxLength={17}
          />
          
          <View style={styles.pickerContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.engine_type')}</Text>
            <Picker
              selectedValue={formData.engineType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, engineType: value }))}
              style={styles.picker}
              enabled={!!formData.year}
            >
              <Picker.Item label={t('vehicles.select_engine_type')} value="" />
              {availableSpecs.engines.map(type => (
                 <Picker.Item label={t(`vehicles.engine_types.${type}`) || type} value={type} key={type} />
              ))}
            </Picker>
          </View>
          
          <View style={styles.pickerContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.transmission')}</Text>
            <Picker
              selectedValue={formData.transmission}
              onValueChange={(value) => setFormData(prev => ({ ...prev, transmission: value }))}
              style={styles.picker}
              enabled={!!formData.year}
            >
              <Picker.Item label={t('vehicles.select_transmission')} value="" />
              {availableSpecs.transmissions.map(type => (
                 <Picker.Item label={t(`vehicles.transmissions.${type}`) || type} value={type} key={type} />
              ))}
            </Picker>
          </View>
          
          <TextInput
            style={[styles.input, (formData.engineType === 'electric' || !formData.engineType) && styles.disabledInput]}
            placeholder={t('vehicles.engine_capacity')}
            value={formData.engineCapacity}
            onChangeText={(text) => setFormData(prev => ({ ...prev, engineCapacity: text }))}
            keyboardType="numeric"
            editable={formData.engineType !== 'electric' && !!formData.engineType}
          />
          
          <View style={styles.pickerContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.color')}</Text>
            <Picker
              selectedValue={formData.color}
              onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}
              style={styles.picker}
            >
              <Picker.Item label={t('vehicles.select_color')} value="" />
              {colors.map(color => (
                <Picker.Item label={t(`vehicles.colors.${color.id}`) || color.name} value={color.id} key={color.id} />
              ))}
            </Picker>
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('vehicles.mileage')}
            value={formData.mileage}
            onChangeText={(text) => setFormData(prev => ({ ...prev, mileage: text }))}
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
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  sectionContainer: { marginBottom: 20, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  sectionDescription: { fontSize: 14, color: '#666', marginBottom: 10 },
  photoContainer: { width: '100%', height: 200, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { alignItems: 'center' },
  photoText: { marginTop: 8, color: '#666', fontSize: 16 },
  photoButtonContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  photoButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0066cc', borderRadius: 8, padding: 10, marginHorizontal: 5 },
  photoButtonText: { color: '#fff', marginLeft: 8 },
  recognizingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  recognizingText: { color: '#fff', marginTop: 10, fontSize: 16 },
  form: { padding: 16 },
  inputContainer: { marginBottom: 12 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  disabledInput: { backgroundColor: '#e0e0e0', color: '#999' },
  inputLabel: { fontSize: 16, marginBottom: 5, color: '#555' },
  pickerContainer: { marginBottom: 12 },
  picker: { backgroundColor: '#fff', borderRadius: 8 },
  submitButton: { marginTop: 16, backgroundColor: '#1976d2' },
  searchButton: { backgroundColor: '#0066cc', padding: 12, borderRadius: 8, marginLeft: 10, alignItems: 'center', justifyContent: 'center', width: 50 },
  disabledButton: { backgroundColor: '#ccc' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
});
