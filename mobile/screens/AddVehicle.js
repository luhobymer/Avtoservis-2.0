import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import CustomButton from '../components/CustomButton';
import { pickImage, checkGalleryPermissions, checkCameraPermissions, optimizeImage } from '../utils/imageUtils';
import { ocrManager } from '../utils/ocrUtils';
import { Picker } from '@react-native-picker/picker';
import { getVehicleMakes, getVehicleModels, getVehicleYears, getVehicleColors } from '../api/vehicleCatalogApi';
import * as vehiclesDao from '../api/dao/vehiclesDao';

export default function AddVehicle({ navigation }) {
  const { t, i18n } = useTranslation();
  const { user, getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [documentPhoto, setDocumentPhoto] = useState(null);
  const [licensePlatePhoto, setLicensePlatePhoto] = useState(null);
  
  // Дані для випадаючих списків
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [colors, setColors] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: '',
    vin: '',
    licensePlate: '',
    color: '',
    mileage: '',
    engineType: 'petrol',
    transmission: 'manual',
    engineCapacity: '',
    power: '',
    registrationDate: '',
    lastServiceDate: '',
  });
  
  // Завантаження даних для випадаючих списків
  useEffect(() => {
    const loadCatalogData = async () => {
      setLoadingCatalog(true);
      try {
        const token = await getToken();
        
        // Завантажуємо марки
        const makesData = await getVehicleMakes(token);
        // Сортуємо марки за алфавітом з урахуванням мови
        const sortedMakes = [...makesData].sort((a, b) => a.name.localeCompare(b.name, i18n.language));
        setMakes(sortedMakes);
        
        // Завантажуємо кольори
        const colorsData = await getVehicleColors(token);
        setColors(colorsData);
        
        // Встановлюємо роки
        const currentYear = new Date().getFullYear();
        const yearsArray = Array.from({ length: 50 }, (_, i) => currentYear - i);
        setYears(yearsArray);
      } catch (error) {
        console.error('Error loading catalog data:', error);
        Alert.alert(t('common.error'), t('vehicles.catalog_error'));
      } finally {
        setLoadingCatalog(false);
      }
    };
    
    loadCatalogData();
  }, []);
  
  // Завантаження моделей при зміні марки
  useEffect(() => {
    const loadModels = async () => {
      if (!formData.make) {
        setModels([]);
        setFormData(prev => ({ ...prev, model: '' }));
        return;
      }
      
      try {
        const token = await getToken();
        const modelsData = await getVehicleModels(formData.make, token);
        const sortedModels = [...modelsData].sort((a, b) => a.name.localeCompare(b.name, i18n.language));
        setModels(sortedModels);
        
        // Скидаємо вибрану модель, оскільки змінилася марка
        setFormData(prev => ({ ...prev, model: '', year: '' }));
      } catch (error) {
        console.error('Error loading models:', error);
        Alert.alert(t('common.error'), t('vehicles.models_error'));
      }
    };
    
    loadModels();
  }, [formData.make]);
  
  // Завантаження років випуску при зміні моделі
  useEffect(() => {
    const loadYears = async () => {
      if (!formData.make || !formData.model) {
        // Якщо не вибрано марку або модель, завантажуємо загальний список років
        const currentYear = new Date().getFullYear();
        const yearsArray = Array.from({ length: 50 }, (_, i) => currentYear - i);
        setYears(yearsArray);
        setFormData(prev => ({ ...prev, year: '' }));
        return;
      }
      
      try {
        // Завантажуємо роки випуску для вибраної моделі
        const yearsData = await getVehicleYears(formData.make, formData.model);
        setYears(yearsData);
        
        // Скидаємо вибраний рік, оскільки змінилася модель
        setFormData(prev => ({ ...prev, year: '' }));
      } catch (error) {
        console.error('Error loading years:', error);
        Alert.alert(t('common.error'), t('vehicles.years_error'));
      }
    };
    
    loadYears();
  }, [formData.model]);

  // Ініціалізуємо OCR при завантаженні компонента
  useEffect(() => {
    const initializeOCR = async () => {
      try {
        console.log('Ініціалізація OCR...');
        await ocrManager.initialize();
        console.log('OCR ініціалізовано успішно');
      } catch (error) {
        console.error('Помилка ініціалізації OCR:', error);
      }
    };

    initializeOCR();
  }, []);

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
        await recognizeDocument(optimizedUri);
        setRecognizing(false);
      }
    } catch (error) {
      console.error('Error picking document image:', error);
      Alert.alert(t('common.error'), t('vehicles.photo_error'));
      setRecognizing(false);
    }
  };

  // Функція вибору фото номерного знаку
  const pickLicensePlateImage = async () => {
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
        setLicensePlatePhoto(optimizedUri);
        await recognizeLicensePlate(optimizedUri);
        setRecognizing(false);
      }
    } catch (error) {
      console.error('Error picking license plate image:', error);
      Alert.alert(t('common.error'), t('vehicles.photo_error'));
      setRecognizing(false);
    }
  };

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
      console.error('Error taking vehicle photo:', error);
      Alert.alert(t('common.error'), t('vehicles.photo_error'));
    }
  };

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
        await recognizeDocument(optimizedUri);
        setRecognizing(false);
      }
    } catch (error) {
      console.error('Error taking document photo:', error);
      Alert.alert(t('common.error'), t('vehicles.photo_error'));
      setRecognizing(false);
    }
  };

  const takeLicensePlatePhoto = async () => {
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
        setLicensePlatePhoto(optimizedUri);
        await recognizeLicensePlate(optimizedUri);
        setRecognizing(false);
      }
    } catch (error) {
      console.error('Error taking license plate photo:', error);
      Alert.alert(t('common.error'), t('vehicles.photo_error'));
      setRecognizing(false);
    }
  };

  // Функція для розпізнавання документів
  const recognizeDocument = async (imageUri) => {
    try {
      setRecognizing(true);
      
      console.log('Початок розпізнавання документа...');
      // Ініціалізуємо OCR, якщо ще не ініціалізовано
      if (!ocrManager.initialized) {
        console.log('OCR не ініціалізовано, ініціалізуємо...');
        await ocrManager.initialize();
      }
      
      const result = await ocrManager.recognizeVehicleDocument(imageUri);
      
      if (!result) {
        console.log('Не вдалося розпізнати документ');
        Alert.alert(
          t('common.error'),
          t('vehicles.ocr_failed'),
          [{ text: t('common.ok') }]
        );
        setRecognizing(false);
        return;
      }
      
      console.log('Результат розпізнавання:', result);
      
      // Перевіряємо, чи дані розпізнані частково
      if (result.isPartialData) {
        Alert.alert(
          t('common.info'),
          t('vehicles.ocr_partial_data'),
          [{ text: t('common.ok') }]
        );
      }
      
      // Оновлюємо форму з розпізнаними даними
      if (result.vin) setFormData(prev => ({ ...prev, vin: result.vin }));
      
      // Якщо розпізнано марку, знаходимо відповідний ID в списку марок
      if (result.make) {
        const makeObj = makes.find(m => m.name.toLowerCase() === result.make.toLowerCase());
        if (makeObj) {
          handleMakeChange(makeObj.id.toString());
        }
      }
      
      // Якщо розпізнано модель, знаходимо відповідний ID в списку моделей
      if (result.model) {
        setTimeout(() => {
          const modelObj = models.find(m => m.name.toLowerCase() === result.model.toLowerCase());
          if (modelObj) {
            handleModelChange(modelObj.id.toString());
          }
        }, 500); // Даємо час на завантаження моделей
      }
      
      if (result.year) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, year: result.year.toString() }));
        }, 1000); // Даємо час на завантаження років
      }
      
      if (result.color) {
        const colorObj = colors.find(c => c.name.toLowerCase() === result.color.toLowerCase());
        if (colorObj) {
          setFormData(prev => ({ ...prev, color: colorObj.id.toString() }));
        }
      }
      
      if (result.licensePlate) setFormData(prev => ({ ...prev, licensePlate: result.licensePlate }));
      
      setRecognizing(false);
    } catch (error) {
      console.error('Помилка при розпізнаванні документа:', error);
      Alert.alert(
        t('common.error'),
        t('vehicles.ocr_error'),
        [{ text: t('common.ok') }]
      );
      setRecognizing(false);
    }
  };

  // Функція для розпізнавання номерного знаку та отримання даних автомобіля
  const recognizeLicensePlate = async (imageUri) => {
    try {
      setRecognizing(true);
      
      console.log('Початок розпізнавання номерного знаку...');
      // Ініціалізуємо OCR, якщо ще не ініціалізовано
      if (!ocrManager.initialized) {
        console.log('OCR не ініціалізовано, ініціалізуємо...');
        await ocrManager.initialize();
      }
      
      const result = await ocrManager.recognizeLicensePlateAndGetVehicleData(imageUri);
      
      if (!result) {
        console.log('Не вдалося розпізнати номерний знак');
        Alert.alert(
          t('common.error'),
          t('vehicles.ocr_license_plate_failed'),
          [{ text: t('common.ok') }]
        );
        setRecognizing(false);
        return;
      }
      
      console.log('Результат розпізнавання номерного знаку:', result);
      
      // Оновлюємо форму з розпізнаними даними
      if (result.licensePlate) setFormData(prev => ({ ...prev, licensePlate: result.licensePlate }));
      
      // Якщо розпізнано марку, знаходимо відповідний ID в списку марок
      if (result.make) {
        const makeObj = makes.find(m => m.name.toLowerCase() === result.make.toLowerCase());
        if (makeObj) {
          setFormData(prev => ({ ...prev, make: makeObj.id.toString() }));
          // Використовуємо setFormData замість handleMakeChange
        }
      }
      
      // Якщо розпізнано модель, знаходимо відповідний ID в списку моделей
      if (result.model) {
        setTimeout(() => {
          const modelObj = models.find(m => m.name.toLowerCase() === result.model.toLowerCase());
          if (modelObj) {
            // Використовуємо setFormData замість handleModelChange
            setFormData(prev => ({ ...prev, model: modelObj.id.toString() }));
          }
        }, 500); // Даємо час на завантаження моделей
      }
      
      if (result.year) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, year: result.year.toString() }));
        }, 1000); // Даємо час на завантаження років
      }
      
      if (result.color) {
        const colorObj = colors.find(c => c.name.toLowerCase() === result.color.toLowerCase());
        if (colorObj) {
          setFormData(prev => ({ ...prev, color: colorObj.id.toString() }));
        }
      }
      
      if (result.vin) setFormData(prev => ({ ...prev, vin: result.vin }));
      
      setRecognizing(false);
    } catch (error) {
      console.error('Помилка при розпізнаванні номерного знаку:', error);
      Alert.alert(
        t('common.error'),
        t('vehicles.ocr_license_plate_error'),
        [{ text: t('common.ok') }]
      );
      setRecognizing(false);
    }
  };

  const validateForm = () => {
    // Перевірка обов'язкових полів
    if (!formData.make) {
      Alert.alert(t('common.error'), t('validation.please_select_make'));
      return false;
    }
    
    if (!formData.model) {
      Alert.alert(t('common.error'), t('validation.please_select_model'));
      return false;
    }
    
    if (!formData.year) {
      Alert.alert(t('common.error'), t('validation.please_select_year'));
      return false;
    }
    
    if (!formData.color) {
      Alert.alert(t('common.error'), t('validation.please_select_color'));
      return false;
    }
    
    // Перевірка VIN (якщо введено)
    if (formData.vin && formData.vin.length !== 17) {
      Alert.alert(t('common.error'), t('validation.invalid_vin'));
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Знаходимо повні дані марки та моделі за їх ID
      const selectedMake = makes.find(make => make.id?.toString() === formData.make?.toString());
      const selectedModel = models.find(model => model.id?.toString() === formData.model?.toString());
      const selectedColor = colors.find(color => color.id?.toString() === formData.color?.toString());
      
      // Підготовка даних для відправки на сервер
      const vehicleData = {
        make: selectedMake ? selectedMake.name : formData.make,
        model: selectedModel ? selectedModel.name : formData.model,
        year: formData.year ? Number(formData.year) : null,
        vin: formData.vin,
        licensePlate: formData.licensePlate,
        color: selectedColor ? selectedColor.name : formData.color,
        mileage: formData.mileage ? parseInt(formData.mileage, 10) : null,
        engine_type: formData.engineType,
        transmission: formData.transmission,
        engine_capacity: formData.engineCapacity ? parseFloat(formData.engineCapacity) : null,
        power: formData.power ? parseInt(formData.power, 10) : null
      };
      
      const created = await vehiclesDao.create(vehicleData, user?.id);
      Alert.alert(
        t('common.success'),
        t('vehicles.add_success'),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error adding vehicle:', error);
      Alert.alert(t('common.error'), t('vehicles.add_error'));
    } finally {
      setLoading(false);
    }
  };

  // Функція для обробки зміни марки автомобіля
  const handleMakeChange = (makeId) => {
    console.log('handleMakeChange викликано з makeId:', makeId);
    setFormData(prev => ({ ...prev, make: makeId, model: '', year: '' }));
  };
  
  // Функція для обробки зміни моделі автомобіля
  const handleModelChange = (modelId) => {
    console.log('handleModelChange викликано з modelId:', modelId);
    setFormData(prev => ({ ...prev, model: modelId, year: '' }));
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView>
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('vehicles.photo')}</Text>
          <TouchableOpacity 
            style={styles.photoContainer} 
            onPress={pickVehicleImage}
            activeOpacity={0.7}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="car-outline" size={64} color="#666" />
                <Text style={styles.photoText}>{t('vehicles.add_photo')}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.photoButtonContainer}>
            <TouchableOpacity style={styles.photoButton} onPress={takeVehiclePhoto}>
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('vehicles.take_photo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickVehicleImage}>
              <Ionicons name="images-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('vehicles.pick_from_gallery')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('vehicles.documents')}</Text>
          <Text style={styles.sectionDescription}>{t('vehicles.scan_document')}</Text>
          
          <TouchableOpacity 
            style={styles.photoContainer} 
            onPress={pickDocumentImage}
            activeOpacity={0.7}
          >
            {documentPhoto ? (
              <Image source={{ uri: documentPhoto }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="document-text-outline" size={64} color="#666" />
                <Text style={styles.photoText}>{t('vehicles.add_photo')}</Text>
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
            <TouchableOpacity style={styles.photoButton} onPress={takeDocumentPhoto}>
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('vehicles.take_photo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickDocumentImage}>
              <Ionicons name="images-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('vehicles.pick_from_gallery')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('vehicles.license_plate_photo')}</Text>
          <Text style={styles.sectionDescription}>{t('vehicles.license_plate_description')}</Text>
          
          <TouchableOpacity 
            style={styles.photoContainer} 
            onPress={pickLicensePlateImage}
            activeOpacity={0.7}
          >
            {licensePlatePhoto ? (
              <Image source={{ uri: licensePlatePhoto }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="car-sport-outline" size={64} color="#666" />
                <Text style={styles.photoText}>{t('vehicles.add_license_plate')}</Text>
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
            <TouchableOpacity style={styles.photoButton} onPress={takeLicensePlatePhoto}>
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('vehicles.take_photo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickLicensePlateImage}>
              <Ionicons name="images-outline" size={24} color="#fff" />
              <Text style={styles.photoButtonText}>{t('vehicles.pick_from_gallery')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>{t('vehicles.details')}</Text>
          
          {loadingCatalog ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : makes.length > 0 ? (
            <>
              <View style={styles.pickerContainer}>
                <Text style={styles.inputLabel}>{t('vehicles.make')}</Text>
                <Picker
                  selectedValue={formData.make}
                  onValueChange={(value) => handleMakeChange(value)}
                  style={styles.picker}
                >
                  <Picker.Item label={t('vehicles.select_make')} value="" />
                  {makes.map((make) => (
                    <Picker.Item key={make.id} label={make.name} value={make.id.toString()} />
                  ))}
                </Picker>
              </View>
              
              <View style={styles.pickerContainer}>
                <Text style={styles.inputLabel}>{t('vehicles.model')}</Text>
                <Picker
                  selectedValue={formData.model}
                  onValueChange={(value) => handleModelChange(value)}
                  style={styles.picker}
                  enabled={models.length > 0}
                >
                  <Picker.Item label={t('vehicles.select_model')} value="" />
                  {models.map((model) => (
                    <Picker.Item key={model.id} label={model.name} value={model.id.toString()} />
                  ))}
                </Picker>
              </View>
              
              <View style={styles.pickerContainer}>
                <Text style={styles.inputLabel}>{t('vehicles.year')}</Text>
                <Picker
                  selectedValue={formData.year}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, year: value }))}
                  style={styles.picker}
                  enabled={!!formData.model}
                >
                  <Picker.Item label={t('vehicles.select_year')} value="" />
                  {years.map(year => (
                    <Picker.Item label={year.toString()} value={year} key={year} />
                  ))}
                </Picker>
              </View>
              
              <View style={styles.pickerContainer}>
                <Text style={styles.inputLabel}>{t('vehicles.color')}</Text>
                <Picker
                  selectedValue={formData.color}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label={t('vehicles.select_color')} value="" />
                  {colors.map(color => (
                    <Picker.Item label={color.name} value={color.id} key={color.id} />
                  ))}
                </Picker>
              </View>
            </>
          ) : (
            <>
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
                placeholder={t('vehicles.color')}
                value={formData.color}
                onChangeText={(text) => setFormData(prev => ({ ...prev, color: text }))}
              />
            </>
          )}
          
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});
