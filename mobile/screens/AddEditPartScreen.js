import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Picker } from '@react-native-picker/picker';
import CustomButton from '../components/CustomButton';
import PartPhotoInput from '../components/PartPhotoInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabaseClient';

export default function AddEditPartScreen({ route, navigation }) {
  const { t } = useTranslation();
  const editingPart = route.params?.part;
  const selectedVehicleId = route.params?.vehicleId;

  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [fetchingVehicles, setFetchingVehicles] = useState(false);
  const [partHistory, setPartHistory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '',
    manufacturer: '',
    partNumber: '',
    vehicleId: selectedVehicleId || '',
    category: 'other',
    specifications: {},
    photo: null
  });

  // Завантаження списку автомобілів
  useEffect(() => {
    const fetchVehicles = async () => {
      setFetchingVehicles(true);
      try {
        const cachedVehicles = await AsyncStorage.getItem('vehicles');
        if (cachedVehicles) {
          setVehicles(JSON.parse(cachedVehicles));
        }

        const { data: session } = await supabase.auth.getSession();
        const uid = session?.user?.id || null;
        if (!uid) return;

        const { data, error } = await supabase
          .from('vehicles')
          .select('vin, make, model, year')
          .eq('user_id', uid);

        if (error) throw error;

        const list = Array.isArray(data)
          ? data.map(v => ({ id: v.vin, brand: v.make, model: v.model, year: v.year }))
          : [];

        setVehicles(list);
        await AsyncStorage.setItem('vehicles', JSON.stringify(list));
      } catch (error) {
        console.error('Failed to fetch vehicles:', error);
      } finally {
        setFetchingVehicles(false);
      }
    };

    fetchVehicles();
  }, []);

  // Заповнення форми при редагуванні
  useEffect(() => {
    if (editingPart) {
      setFormData({
        ...editingPart,
        price: editingPart.price.toString(),
        quantity: editingPart.quantity.toString(),
        vehicleId: editingPart.vehicleId || selectedVehicleId || '',
        category: editingPart.category || 'other',
        specifications: editingPart.specifications || {}
      });
      
      if (editingPart.partNumber) {
        fetchPartHistory(editingPart.partNumber, editingPart.vehicleId);
      }
    }
  }, [editingPart, selectedVehicleId]);

  // Отримання історії використання запчастини
  const fetchPartHistory = async (partNumber, vehicleVin) => {
    try {
      if (!partNumber) return;

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

      setPartHistory(history);
    } catch (error) {
      console.error('Error fetching part history:', error);
    }
  };

  const handlePhotoSelect = (uri) => {
    setFormData(prev => ({ ...prev, photo: uri }));
  };

  const handleDetailsRecognized = (details) => {
    console.log('Отримано розпізнані дані:', details);
    
    // Перевірка наявності даних перед оновленням форми
    if (!details) return;
    
    // Створюємо оновлений об'єкт даних
    const updatedData = { ...formData };
    
    // Оновлюємо тільки ті поля, які були розпізнані
    if (details.partNumber) updatedData.partNumber = details.partNumber;
    if (details.manufacturer) updatedData.manufacturer = details.manufacturer;
    if (details.description) updatedData.description = details.description;
    if (details.category) updatedData.category = details.category;
    
    // Оновлюємо технічні характеристики, якщо вони є
    if (details.specifications && Object.keys(details.specifications).length > 0) {
      updatedData.specifications = details.specifications;
    }
    
    // Оновлюємо ціну, видаляючи всі символи, крім цифр і крапки/коми
    if (details.price) {
      const cleanPrice = details.price.replace(/[^\d.,]/g, '').replace(',', '.');
      updatedData.price = cleanPrice;
    }
    
    // Оновлюємо дані форми
    setFormData(updatedData);
    
    // Показуємо повідомлення про успішне розпізнавання
    Alert.alert(
      t('common.success'),
      t('parts.ocr_success'),
      [{ text: t('common.ok') }]
    );
    
    // Якщо є номер запчастини і вибраний автомобіль, отримуємо історію
    if (details.partNumber && updatedData.vehicleId) {
      fetchPartHistory(details.partNumber, updatedData.vehicleId);
    }
    
    // Якщо є історія використання, оновлюємо її
    if (details.history) {
      setPartHistory(details.history);
    }
  };

  const validateForm = () => {
    if (!formData.name || !formData.price || !formData.quantity) {
      Alert.alert(t('common.error'), t('parts.required_fields'));
      return false;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      Alert.alert(t('common.error'), t('parts.invalid_price'));
      return false;
    }

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity < 0) {
      Alert.alert(t('common.error'), t('parts.invalid_quantity'));
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: Number(formData.price) || 0,
        quantity: Number(formData.quantity) || 0,
        manufacturer: formData.manufacturer || '',
        part_number: formData.partNumber || '',
        vehicle_vin: formData.vehicleId || null,
        category: formData.category || 'other',
        specifications: formData.specifications || {},
        photo_url: null
      };

      if (editingPart) {
        const { error } = await supabase
          .from('parts')
          .update(payload)
          .eq('id', editingPart.id)
          .select('*')
          .single();
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('parts')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
      }

      const cachedParts = JSON.parse((await AsyncStorage.getItem('parts')) || '[]');
      if (editingPart) {
        const updatedParts = cachedParts.map(p =>
          p.id === editingPart.id ? { ...payload, id: editingPart.id } : p
        );
        await AsyncStorage.setItem('parts', JSON.stringify(updatedParts));
      } else {
        const { data: latest } = await supabase
          .from('parts')
          .select('id, name, description, price, quantity, manufacturer, part_number, vehicle_vin, category, specifications')
          .order('id', { ascending: false })
          .limit(1);
        const newPart = Array.isArray(latest) && latest[0] ? latest[0] : { id: Date.now() };
        cachedParts.push({ ...payload, id: newPart.id });
        await AsyncStorage.setItem('parts', JSON.stringify(cachedParts));
      }

      Alert.alert(t('common.success'), t(editingPart ? 'parts.updated' : 'parts.added'));
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save part:', error);
      Alert.alert(t('common.error'), t('parts.save_error'));
    } finally {
      setLoading(false);
    }
  };

  // Відображення історії використання запчастини
  const renderPartHistory = () => {
    if (!partHistory || partHistory.length === 0) return null;
    
    return (
      <View style={styles.historyContainer}>
        <Text style={styles.sectionTitle}>{t('parts.usage_history')}</Text>
        {partHistory.map((item, index) => (
          <View key={index} style={styles.historyItem}>
            <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
            <Text>{item.vehicleName || t('parts.unknown_vehicle')}</Text>
            <Text>{item.price ? `${item.price} ${t('common.currency')}` : ''}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Відображення технічних характеристик
  const renderSpecifications = () => {
    if (!formData.specifications || Object.keys(formData.specifications).length === 0) return null;
    
    return (
      <View style={styles.specificationsContainer}>
        <Text style={styles.sectionTitle}>{t('parts.specifications')}</Text>
        {Object.entries(formData.specifications).map(([key, value]) => (
          <View key={key} style={styles.specificationItem}>
            <Text style={styles.specificationLabel}>{t(`parts.spec_${key}`)}</Text>
            <Text style={styles.specificationValue}>{value}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        <PartPhotoInput
          onPhotoSelect={handlePhotoSelect}
          onDetailsRecognized={handleDetailsRecognized}
          vehicleId={formData.vehicleId}
        />

        <TextInput
          style={styles.input}
          placeholder={t('parts.name')}
          value={formData.name}
          onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
        />

        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder={t('parts.description')}
          value={formData.description}
          onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
          multiline
          numberOfLines={4}
        />

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>{t('parts.vehicle')}</Text>
          <Picker
            selectedValue={formData.vehicleId}
            onValueChange={(itemValue) => {
              setFormData(prev => ({ ...prev, vehicleId: itemValue }));
              if (formData.partNumber && itemValue) {
                fetchPartHistory(formData.partNumber, itemValue);
              }
            }}
            style={styles.picker}
          >
            <Picker.Item label={t('parts.select_vehicle')} value="" />
            {vehicles.map(vehicle => (
              <Picker.Item 
                key={vehicle.id} 
                label={`${vehicle.make || vehicle.brand} ${vehicle.model} (${vehicle.year})`} 
                value={vehicle.id} 
              />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>{t('parts.category')}</Text>
          <Picker
            selectedValue={formData.category}
            onValueChange={(itemValue) => setFormData(prev => ({ ...prev, category: itemValue }))}
            style={styles.picker}
          >
            <Picker.Item label={t('parts.categories.other')} value="other" />
            <Picker.Item label={t('parts.categories.engine')} value="engine" />
            <Picker.Item label={t('parts.categories.transmission')} value="transmission" />
            <Picker.Item label={t('parts.categories.brakes')} value="brakes" />
            <Picker.Item label={t('parts.categories.suspension')} value="suspension" />
            <Picker.Item label={t('parts.categories.electrical')} value="electrical" />
            <Picker.Item label={t('parts.categories.body')} value="body" />
            <Picker.Item label={t('parts.categories.interior')} value="interior" />
          </Picker>
        </View>

        <TextInput
          style={styles.input}
          placeholder={t('parts.price')}
          value={formData.price}
          onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
          keyboardType="decimal-pad"
        />

        <TextInput
          style={styles.input}
          placeholder={t('parts.quantity')}
          value={formData.quantity}
          onChangeText={(text) => setFormData(prev => ({ ...prev, quantity: text }))}
          keyboardType="number-pad"
        />

        <TextInput
          style={styles.input}
          placeholder={t('parts.manufacturer')}
          value={formData.manufacturer}
          onChangeText={(text) => setFormData(prev => ({ ...prev, manufacturer: text }))}
        />

        <TextInput
          style={styles.input}
          placeholder={t('parts.part_number')}
          value={formData.partNumber}
          onChangeText={(text) => setFormData(prev => ({ ...prev, partNumber: text }))}
        />

        {renderSpecifications()}
        
        {renderPartHistory()}

        <CustomButton
          title={editingPart ? t('common.save') : t('parts.add')}
          onPress={handleSubmit}
          loading={loading}
          style={styles.button}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  scrollView: {
    flex: 1,
    padding: 16
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16
  },
  multiline: {
    height: 100,
    textAlignVertical: 'top'
  },
  pickerContainer: {
    marginBottom: 16
  },
  pickerLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555'
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#333'
  },
  specificationsContainer: {
    marginVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10
  },
  specificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5
  },
  specificationLabel: {
    fontWeight: '500',
    color: '#555'
  },
  specificationValue: {
    color: '#333'
  },
  historyContainer: {
    marginVertical: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 10
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd'
  },
  historyDate: {
    fontWeight: '500'
  },
  button: {
    marginVertical: 16
  }
});
