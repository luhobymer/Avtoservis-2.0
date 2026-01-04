import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as servicesDao from '../../api/dao/servicesDao';
import CustomButton from '../../components/CustomButton';

export default function ServicesManagementScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('name_asc');
  const [updating, setUpdating] = useState(false);
  

  const fetchServices = async () => {
    try {
      setLoading(true);
      const list = await servicesDao.listAll();
      setServices(list);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      Alert.alert(t('common.error'), t('admin.services.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!formData.name || !formData.price) {
      Alert.alert(t('common.error'), t('admin.services.required_fields'));
      return;
    }

    try {
      setUpdating(true);
      const priceNum = parseFloat(formData.price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        Alert.alert(t('common.error'), t('admin.services.invalid_price'));
        return;
      }
      let durationNum = null;
      if (formData.duration) {
        const d = parseInt(formData.duration, 10);
        if (Number.isNaN(d) || d <= 0) {
          Alert.alert(t('common.error'), t('admin.services.invalid_duration'));
          return;
        }
        durationNum = d;
      }
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: priceNum,
        duration: durationNum
      };
      await servicesDao.create(payload);
      setFormData({ name: '', description: '', price: '', duration: '' });
      await fetchServices();
    } catch (error) {
      console.error('Failed to add service:', error);
      Alert.alert(t('common.error'), t('admin.services.add_error'));
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateService = async () => {
    if (!editingService) return;

    try {
      setUpdating(true);
      const priceNum = parseFloat(formData.price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        Alert.alert(t('common.error'), t('admin.services.invalid_price'));
        return;
      }
      let durationNum = null;
      if (formData.duration) {
        const d = parseInt(formData.duration, 10);
        if (Number.isNaN(d) || d <= 0) {
          Alert.alert(t('common.error'), t('admin.services.invalid_duration'));
          return;
        }
        durationNum = d;
      }
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: priceNum,
        duration: durationNum
      };
      await servicesDao.updateById(editingService.id, payload);
      setEditingService(null);
      setFormData({ name: '', description: '', price: '', duration: '' });
      await fetchServices();
    } catch (error) {
      console.error('Failed to update service:', error);
      Alert.alert(t('common.error'), t('admin.services.update_error'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteService = async (serviceId) => {
    Alert.alert(
      t('admin.services.delete_title'),
      t('admin.services.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              await servicesDao.deleteById(serviceId);
              await fetchServices();
            } catch (error) {
              console.error('Failed to delete service:', error);
              Alert.alert(t('common.error'), t('admin.services.delete_error'));
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchServices();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchServices();
  }, []);

  

  const handleServicePress = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price?.toString() || '',
      duration: service.duration?.toString() || ''
    });
  };

  const renderServiceItem = ({ item }) => (
    <View style={styles.serviceItem}>
      <View style={styles.serviceInfo}>
        <View style={styles.serviceHeader}>
          <Ionicons name="build-outline" size={24} color="#1976d2" />
          <Text style={styles.serviceName}>{item.name}</Text>
        </View>
        
        {!!item.description && (
          <Text style={styles.serviceDescription}>{item.description}</Text>
        )}
        <View style={styles.serviceDetails}>
          <Text style={styles.servicePrice}>{item.price} {t('common.currency')}</Text>
          {!!item.duration && (
            <Text style={styles.serviceDuration}>{item.duration} {t('common.minutes')}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <CustomButton
            title={t('common.edit')}
            onPress={() => handleServicePress(item)}
            style={{ flex: 1, marginRight: 8, backgroundColor: '#4caf50' }}
          />
          <CustomButton
            title={t('common.delete')}
            onPress={() => handleDeleteService(item.id)}
            style={{ flex: 1, marginLeft: 8, backgroundColor: '#f44336' }}
          />
        </View>
      </View>
    </View>
  );

  const filteredServices = services.filter(s => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  });

  const sortedServices = [...filteredServices].sort((a, b) => {
    switch (sortOption) {
      case 'name_asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name_desc':
        return (b.name || '').localeCompare(a.name || '');
      case 'price_asc':
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      case 'price_desc':
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      case 'duration_asc':
        return (Number(a.duration) || 0) - (Number(b.duration) || 0);
      case 'duration_desc':
        return (Number(b.duration) || 0) - (Number(a.duration) || 0);
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f7' }}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      <View style={{ backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 }}>
          {editingService ? t('admin.services.edit_service') : t('admin.services.add_service')}
        </Text>

        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 }}
          placeholder={t('admin.services.name')}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
        />
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 }}
          placeholder={t('admin.services.description')}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          multiline
        />
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 }}
          placeholder={t('admin.services.price')}
          value={formData.price}
          onChangeText={(text) => setFormData({ ...formData, price: text })}
          keyboardType="numeric"
        />
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 }}
          placeholder={t('admin.services.duration')}
          value={formData.duration}
          onChangeText={(text) => setFormData({ ...formData, duration: text })}
          keyboardType="numeric"
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {editingService ? (
            <>
              <CustomButton
                title={t('common.update')}
                onPress={() => { if (updating) return; handleUpdateService(); }}
                style={{ flex: 1, marginRight: 8, opacity: updating ? 0.6 : 1 }}
              />
              <CustomButton
                title={t('common.cancel')}
                onPress={() => {
                  setEditingService(null);
                  setFormData({ name: '', description: '', price: '', duration: '' });
                }}
                style={{ flex: 1, marginLeft: 8, backgroundColor: '#666' }}
              />
            </>
          ) : (
            <CustomButton
              title={t('common.add')}
              onPress={() => { if (updating) return; handleAddService(); }}
              style={{ flex: 1, opacity: updating ? 0.6 : 1 }}
            />
          )}
        </View>
        {updating ? (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#1976d2" />
          </View>
        ) : null}
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginTop: 16, fontSize: 16 }}
          placeholder={t('common.search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{t('common.sort')}</Text>
          <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
            <Picker selectedValue={sortOption} onValueChange={(v) => setSortOption(v)}>
              <Picker.Item label={t('admin.sort.name_asc')} value="name_asc" />
              <Picker.Item label={t('admin.sort.name_desc')} value="name_desc" />
              <Picker.Item label={t('admin.sort.price_asc')} value="price_asc" />
              <Picker.Item label={t('admin.sort.price_desc')} value="price_desc" />
              <Picker.Item label={t('admin.sort.duration_asc')} value="duration_asc" />
              <Picker.Item label={t('admin.sort.duration_desc')} value="duration_desc" />
            </Picker>
          </View>
        </View>
      </View>

      <FlatList
        data={sortedServices}
        renderItem={renderServiceItem}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>{t('admin.services.no_services')}</Text>
          </View>
        }
      />
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
    marginBottom: 8,
  },
  serviceDetails: {
    flexDirection: 'row',
    marginLeft: 36,
  },
  servicePrice: {
    fontSize: 14,
    color: '#4caf50',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  serviceDuration: {
    fontSize: 14,
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unsyncedTag: {
    marginLeft: 36,
    marginBottom: 6,
    fontSize: 12,
    color: '#ad8b00',
    backgroundColor: '#fffbe6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  }
});
