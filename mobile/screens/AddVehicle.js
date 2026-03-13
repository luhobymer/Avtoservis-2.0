import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CustomButton from '../components/CustomButton';
import { pickImage, checkGalleryPermissions, checkCameraPermissions, optimizeImage, takePhoto } from '../utils/imageUtils';
import { ocrManager } from '../utils/ocrUtils';
import { Picker } from '@react-native-picker/picker';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import * as usersDao from '../api/dao/usersDao';
import { brandModelYears, getVehicleSpecs } from '../data/vehicleData';
import { getPhoneContacts } from '../utils/contactsUtils';
import axiosAuth from '../api/axiosConfig';

export default function AddVehicle({ navigation }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isMaster = user?.role === 'master';
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [vinLookupLoading, setVinLookupLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [documentPhoto, setDocumentPhoto] = useState(null);
  const [licensePlatePhoto, setLicensePlatePhoto] = useState(null);
  const [owners, setOwners] = useState([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [ownerModalVisible, setOwnerModalVisible] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerForm, setOwnerForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [ownerContacts, setOwnerContacts] = useState([]);
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  
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

  useEffect(() => {
    if (!isMaster) return;
    const loadOwners = async () => {
      setOwnersLoading(true);
      try {
        const response = await axiosAuth.get('/api/relationships/clients');
        const rows = Array.isArray(response.data) ? response.data : [];
        const accepted = rows
          .filter((row) => String(row.status || '').toLowerCase() === 'accepted')
          .map((row) => {
            const id = row.client_id || row.clientId || row.user_id || row.userId;
            if (!id) return null;
            return {
              id,
              name: row.name || row.email,
              email: row.email,
              role: 'client',
            };
          })
          .filter(Boolean);
        const ownersMap = new Map();
        accepted.forEach((owner) => ownersMap.set(String(owner.id), owner));
        const sortedClients = Array.from(ownersMap.values()).sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
        const selfOption = user?.id
          ? { id: String(user.id), name: 'Я', email: user.email, role: 'client' }
          : null;
        const combined = selfOption
          ? [selfOption, ...sortedClients].filter(
              (o, idx, arr) => arr.findIndex((x) => String(x.id) === String(o.id)) === idx
            )
          : sortedClients;
        setOwners(combined);
        if (!selectedOwnerId && user?.id) {
          setSelectedOwnerId(String(user.id));
        }
      } catch (error) {
        try {
          const users = await usersDao.listAll();
          const clients = users.filter((u) => u.role === 'client' && u.status === 'active');
          const sortedClients = clients.sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
          );
          const selfOption = user?.id
            ? { id: String(user.id), name: 'Я', email: user.email, role: 'client' }
            : null;
          const combined = selfOption
            ? [selfOption, ...sortedClients].filter(
                (o, idx, arr) => arr.findIndex((x) => String(x.id) === String(o.id)) === idx
              )
            : sortedClients;
          setOwners(combined);
          if (!selectedOwnerId && user?.id) {
            setSelectedOwnerId(String(user.id));
          }
        } catch (fallbackError) {
          console.error('Failed to load owners:', fallbackError);
        }
      } finally {
        setOwnersLoading(false);
      }
    };
    loadOwners();
  }, [isMaster]);

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
            return plate.replace(/[\s\-_.]/g, '').toUpperCase();
        };

        const normalizedPlate = normalizeLicensePlate(formData.licensePlate);

        try {
          const dbVehicle = await vehiclesDao.getDetailsByLicensePlate(normalizedPlate);
          if (dbVehicle) {
            setFormData(prev => ({
              ...prev,
              make: dbVehicle.make || prev.make,
              model: dbVehicle.model || prev.model,
              year: dbVehicle.year ? String(dbVehicle.year) : prev.year,
              vin: dbVehicle.vin || prev.vin,
              licensePlate: dbVehicle.licensePlate || normalizedPlate,
              color: dbVehicle.color || prev.color,
              mileage: dbVehicle.mileage != null ? String(dbVehicle.mileage) : prev.mileage,
              engineType: dbVehicle.engineType || prev.engineType,
              engineCapacity: dbVehicle.engineCapacity
                ? String(dbVehicle.engineCapacity)
                : prev.engineCapacity,
              transmission: dbVehicle.transmission || prev.transmission,
            }));
            Alert.alert(t('common.success'), t('vehicles.found_success'));
            return;
          }
        } catch (dbErr) {
          console.warn('Vehicle DB lookup by plate failed:', dbErr);
        }

        const response = await axiosAuth.get('/api/vehicle-registry', {
            params: { license_plate: normalizedPlate }
        });

        if (response.data) {
            const data = response.data;
            
            let engineType = '';
            const fuelRaw = String(data.fuel_type || '').toUpperCase();
            if (fuelRaw.includes('BENZINE') || fuelRaw.includes('PETROL')) engineType = 'petrol';
            else if (fuelRaw.includes('DIESEL')) engineType = 'diesel';
            else if (fuelRaw.includes('GAS')) engineType = 'gas';
            else if (fuelRaw.includes('ELECTRO') || fuelRaw.includes('ELECTRIC')) engineType = 'electric';
            else if (fuelRaw.includes('HYBRID')) engineType = 'hybrid';

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
                licensePlate: data.license_plate || normalizedPlate
            }));
            
            Alert.alert(t('common.success'), t('vehicles.found_success'));
        } else {
            Alert.alert(t('common.info'), t('vehicles.not_found'));
        }
    } catch (error) {
        const status = error?.response?.status;
        if (status === 404) {
          Alert.alert(t('common.info'), t('vehicles.not_found'));
        } else if (status === 400) {
          Alert.alert(t('common.error'), t('validation.enter_license_plate'));
        } else {
          console.error('Lookup error:', error);
          Alert.alert(t('common.error'), t('vehicles.lookup_error'));
        }
    } finally {
        setLookupLoading(false);
    }
  };

  const handleLookupByVin = async () => {
    if (!formData.vin) {
        Alert.alert(t('common.error'), t('validation.invalid_vin'));
        return;
    }

    setVinLookupLoading(true);
    try {
        const normalizedVin = String(formData.vin || '').replace(/\s+/g, '').toUpperCase();

        try {
          const dbVehicle = await vehiclesDao.getDetailsByVin(normalizedVin);
          if (dbVehicle) {
            setFormData(prev => ({
              ...prev,
              make: dbVehicle.make || prev.make,
              model: dbVehicle.model || prev.model,
              year: dbVehicle.year ? String(dbVehicle.year) : prev.year,
              vin: dbVehicle.vin || normalizedVin,
              licensePlate: dbVehicle.licensePlate || prev.licensePlate,
              color: dbVehicle.color || prev.color,
              mileage: dbVehicle.mileage != null ? String(dbVehicle.mileage) : prev.mileage,
              engineType: dbVehicle.engineType || prev.engineType,
              engineCapacity: dbVehicle.engineCapacity
                ? String(dbVehicle.engineCapacity)
                : prev.engineCapacity,
              transmission: dbVehicle.transmission || prev.transmission,
            }));
            Alert.alert(t('common.success'), t('vehicles.found_success'));
            return;
          }
        } catch (dbErr) {
          console.warn('Vehicle DB lookup by VIN failed:', dbErr);
        }

        const response = await axiosAuth.get('/api/vehicle-registry', {
            params: { vin: normalizedVin }
        });

        if (response.data) {
            const data = response.data;
            let engineType = '';
            const fuelRaw = String(data.fuel_type || '').toUpperCase();
            if (fuelRaw.includes('BENZINE') || fuelRaw.includes('PETROL')) engineType = 'petrol';
            else if (fuelRaw.includes('DIESEL')) engineType = 'diesel';
            else if (fuelRaw.includes('GAS')) engineType = 'gas';
            else if (fuelRaw.includes('ELECTRO') || fuelRaw.includes('ELECTRIC')) engineType = 'electric';
            else if (fuelRaw.includes('HYBRID')) engineType = 'hybrid';

            let color = '';
            const colorRaw = String(data.color || '').toLowerCase();
            const foundColor = colors.find(c => c.id === colorRaw || c.name.toLowerCase() === colorRaw);
            if (foundColor) color = foundColor.id;

            setFormData(prev => ({
                ...prev,
                make: data.brand || prev.make,
                model: data.model || prev.model,
                year: data.make_year ? String(data.make_year) : prev.year,
                vin: data.vin || normalizedVin,
                color: color || prev.color,
                engineType: engineType || prev.engineType,
                engineCapacity: data.engine_volume ? String(data.engine_volume) : prev.engineCapacity,
                licensePlate: data.n_reg_new || data.license_plate || prev.licensePlate
            }));

            Alert.alert(t('common.success'), t('vehicles.found_success'));
        } else {
            Alert.alert(t('common.info'), t('vehicles.not_found'));
        }
    } catch (error) {
        console.error('VIN lookup error:', error);
        Alert.alert(t('common.error'), t('vehicles.lookup_error'));
    } finally {
        setVinLookupLoading(false);
    }
  };

  const normalizeOwnerPhone = (phone) => {
    let normalizedPhone = String(phone || '').trim().replace(/\s+/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = `+380${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.startsWith('380')) {
      normalizedPhone = `+${normalizedPhone}`;
    }
    return normalizedPhone;
  };

  const handleCreateOwner = async () => {
    const firstName = String(ownerForm.firstName || '').trim();
    const lastName = String(ownerForm.lastName || '').trim();
    const phone = String(ownerForm.phone || '').trim();
    const password = '12345678';

    if (!firstName || !lastName || !phone) {
      Alert.alert(t('common.error', 'Помилка'), t('validation.please_fill_all_fields'));
      return;
    }
    const phoneRegex = /^(\+?380|0)\d{9}$/;
    if (phone && !phoneRegex.test(phone)) {
      Alert.alert(t('common.error', 'Помилка'), t('validation.invalid_phone'));
      return;
    }

    const normalizedPhone = phone ? normalizeOwnerPhone(phone) : '';
    setOwnerSaving(true);
    try {
      const created = await usersDao.createUser({
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        phone: normalizedPhone,
        password,
        role: 'client',
      });
      if (created?.id) {
        try {
          await axiosAuth.post('/api/relationships/clients', { client_id: created.id });
        } catch (error) {}
        const newOwner = {
          id: created.id,
          name: created.name || `${firstName} ${lastName}`.trim(),
          email: created.email || created.email,
          role: 'client',
        };
        setOwners((prev) => {
          const ownersMap = new Map();
          [newOwner, ...prev].forEach((owner) => ownersMap.set(String(owner.id), owner));
          return Array.from(ownersMap.values()).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
          );
        });
        setSelectedOwnerId(String(created.id));
        setOwnerModalVisible(false);
        setOwnerForm({ firstName: '', lastName: '', phone: '' });
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || t('common.error', 'Помилка');
      Alert.alert(t('common.error', 'Помилка'), message);
    } finally {
      setOwnerSaving(false);
    }
  };

  const runSmartPhotoRecognition = async (uri) => {
    if (!uri) return;
    setRecognizing(true);
    try {
      let data = null;
      try {
        data = await ocrManager.recognizeLicensePlateAndGetVehicleData(uri);
      } catch (e) {
        console.warn('License plate OCR failed:', e);
      }

      if (!data) {
        try {
          data = await ocrManager.recognizeVehicleDocument(uri);
        } catch (e) {
          console.warn('Document OCR failed:', e);
        }
      }

      if (data) {
        updateFormWithOCRData(data);
      }
    } finally {
      setRecognizing(false);
    }
  };

  const openOwnerContacts = async () => {
    try {
      const contacts = await getPhoneContacts();
      setOwnerContacts(contacts);
      if (contacts.length) {
        setContactsModalVisible(true);
      } else {
        Alert.alert(t('common.info', 'Інформація'), t('contacts.no_contacts', 'Не знайдено контактів з телефонами'));
      }
    } catch (e) {
      console.error('Failed to load contacts:', e);
      Alert.alert(t('common.error', 'Помилка'), t('contacts.load_error', 'Не вдалося завантажити контакти'));
    }
  };

  const handleSelectOwnerContact = (contact) => {
    if (!contact) return;
    const parts = String(contact.name || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ');
    setOwnerForm({
      firstName,
      lastName,
      phone: contact.phone || '',
    });
    setContactsModalVisible(false);
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
        await runSmartPhotoRecognition(optimizedUri);
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
      const result = await takePhoto();
      if (!result.canceled) {
          setPhoto(result.uri);
          await runSmartPhotoRecognition(result.uri);
      }
  };

  const takeDocumentPhoto = async () => {
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) return;
      const result = await takePhoto();
      if (!result.canceled) {
          setRecognizing(true);
          setDocumentPhoto(result.uri);
          const data = await ocrManager.recognizeVehicleDocument(result.uri);
          if (data) updateFormWithOCRData(data);
          setRecognizing(false);
      }
  };

  const takeLicensePlatePhoto = async () => {
      const hasPermission = await checkCameraPermissions();
      if (!hasPermission) return;
      const result = await takePhoto();
      if (!result.canceled) {
          setRecognizing(true);
          setLicensePlatePhoto(result.uri);
          const data = await ocrManager.recognizeLicensePlateAndGetVehicleData(result.uri);
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
    if (isMaster && !selectedOwnerId) { Alert.alert(t('common.error'), t('validation.please_fill_all_fields')); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      let uploadedPhotoUrl = null;
      if (photo) {
        const uploadResult = await vehiclesDao.uploadPhoto(photo);
        uploadedPhotoUrl = uploadResult?.url || null;
      }
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
        power: formData.power ? parseInt(formData.power, 10) : null,
        photoUrl: uploadedPhotoUrl,
      };
      
      const ownerId = isMaster ? selectedOwnerId : user?.id;
      try {
        if (isMaster && ownerId) {
          const resp = await axiosAuth.post('/api/relationships/clients', { client_id: ownerId });
          if (resp && (resp.status === 200 || resp.status === 201)) {
            Alert.alert(t('common.success'), t('relationships.client_connected', 'Клієнта додано до ваших клієнтів'));
          }
        }
      } catch (relErr) {
        // ігноруємо, якщо зв'язок вже існує
        try {
          Alert.alert(t('common.info'), t('relationships.client_already_connected', 'Клієнт вже підключений'));
        } catch (_) {}
      }
      await vehiclesDao.create(vehicleData, ownerId);
      try {
        Alert.alert(t('common.success'), t('vehicles.add_success', 'Авто успішно додано'));
      } catch (_) {}
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

          {isMaster && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('vehicles.owner', 'Власник')}</Text>
              <View style={styles.ownerRow}>
                <View style={styles.ownerPicker}>
                  {ownersLoading ? (
                    <View style={styles.ownerLoading}>
                      <ActivityIndicator size="small" color="#1976d2" />
                    </View>
                  ) : (
                    <Picker
                      selectedValue={selectedOwnerId}
                      onValueChange={(value) => setSelectedOwnerId(value)}
                      style={styles.picker}
                    >
                      <Picker.Item label={t('vehicles.select_owner', 'Оберіть власника')} value="" />
                      {owners.map((owner) => (
                        <Picker.Item key={owner.id} label={owner.name || owner.email} value={String(owner.id)} />
                      ))}
                    </Picker>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.ownerAddButton}
                  onPress={() => setOwnerModalVisible(true)}
                >
                  <Ionicons name="person-add-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
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
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('vehicles.vin')}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TextInput
                style={[styles.input, {flex: 1, marginBottom: 0}]}
                placeholder={t('vehicles.vin')}
                value={formData.vin}
                onChangeText={(text) => setFormData(prev => ({ ...prev, vin: text.toUpperCase() }))}
                autoCapitalize="characters"
                maxLength={17}
              />
              <TouchableOpacity
                style={[styles.searchButton, (!formData.vin || vinLookupLoading) && styles.disabledButton]}
                onPress={handleLookupByVin}
                disabled={!formData.vin || vinLookupLoading}
              >
                {vinLookupLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
          
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
      <Modal
        visible={ownerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOwnerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('clients.add', 'Додати клієнта')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('common.name', 'Імʼя')}
              value={ownerForm.firstName}
              onChangeText={(value) => setOwnerForm((prev) => ({ ...prev, firstName: value }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t('common.last_name', 'Прізвище')}
              value={ownerForm.lastName}
              onChangeText={(value) => setOwnerForm((prev) => ({ ...prev, lastName: value }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t('common.phone', 'Телефон')}
              value={ownerForm.phone}
              onChangeText={(value) => setOwnerForm((prev) => ({ ...prev, phone: value }))}
              keyboardType="phone-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setOwnerModalVisible(false)}
                disabled={ownerSaving}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Скасувати')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSecondary]}
                onPress={openOwnerContacts}
                disabled={ownerSaving}
              >
                <Text style={styles.modalSecondaryText}>{t('contacts.from_phone', 'З контактів')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirm]}
                onPress={handleCreateOwner}
                disabled={ownerSaving}
              >
                {ownerSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>{t('common.save', 'Зберегти')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={contactsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setContactsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.contactsModalContent}>
            <Text style={styles.modalTitle}>{t('contacts.select_owner', 'Оберіть контакт')}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {ownerContacts.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.contactItem}
                  onPress={() => handleSelectOwnerContact(contact)}
                >
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setContactsModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Скасувати')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: '#000' },
  disabledInput: { backgroundColor: '#e0e0e0', color: '#999' },
  inputLabel: { fontSize: 16, marginBottom: 5, color: '#555' },
  pickerContainer: { marginBottom: 12 },
  picker: { backgroundColor: '#fff', borderRadius: 8 },
  ownerRow: { flexDirection: 'row', alignItems: 'center' },
  ownerPicker: { flex: 1, backgroundColor: '#fff', borderRadius: 8 },
  ownerAddButton: { backgroundColor: '#1976d2', padding: 12, borderRadius: 8, marginLeft: 10, alignItems: 'center', justifyContent: 'center', width: 50 },
  ownerLoading: { height: 50, alignItems: 'center', justifyContent: 'center' },
  submitButton: { marginTop: 16, backgroundColor: '#1976d2' },
  searchButton: { backgroundColor: '#0066cc', padding: 12, borderRadius: 8, marginLeft: 10, alignItems: 'center', justifyContent: 'center', width: 50 },
  disabledButton: { backgroundColor: '#ccc' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalContent: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  modalInput: { backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, color: '#000' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginLeft: 8 },
  modalCancel: { backgroundColor: '#e0e0e0' },
  modalConfirm: { backgroundColor: '#1976d2' },
  modalCancelText: { color: '#333', fontSize: 14 },
  modalConfirmText: { color: '#fff', fontSize: 14 },
  modalSecondary: { backgroundColor: '#f0f0f0' },
  modalSecondaryText: { color: '#1976d2', fontSize: 14 },
  contactsModalContent: { width: '100%', maxHeight: 500, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  contactItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  contactName: { fontSize: 16, color: '#111' },
  contactPhone: { fontSize: 14, color: '#555', marginTop: 2 },
});
