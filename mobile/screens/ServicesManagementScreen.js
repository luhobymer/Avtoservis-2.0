import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
import { supabase } from '../api/supabaseClient';

export default function ServicesManagementScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    category: ''
  });

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, description, price, duration, category')
        .order('name');
      if (error) throw error;
      setServices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      Alert.alert(t('common.error'), t('admin.services.fetch_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchServices();
    });

    return unsubscribe;
  }, [navigation]);

  const handleAddService = async () => {
    if (!formData.name || !formData.price) {
      Alert.alert(t('common.error'), t('admin.services.required_fields'));
      return;
    }

    try {
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: Number(formData.price) || 0,
        duration: formData.duration ? Number(formData.duration) : null,
        category: formData.category || ''
      };
      const { error } = await supabase
        .from('services')
        .insert(payload);
      if (error) throw error;

      setFormData({
        name: '',
        description: '',
        price: '',
        duration: '',
        category: ''
      });
      fetchServices();
    } catch (error) {
      console.error('Failed to add service:', error);
      Alert.alert(t('common.error'), t('admin.services.add_error'));
    }
  };

  const handleUpdateService = async () => {
    if (!editingService) return;

    try {
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: Number(formData.price) || 0,
        duration: formData.duration ? Number(formData.duration) : null,
        category: formData.category || ''
      };
      const { error } = await supabase
        .from('services')
        .update(payload)
        .eq('id', editingService.id);
      if (error) throw error;

      setEditingService(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        duration: '',
        category: ''
      });
      fetchServices();
    } catch (error) {
      console.error('Failed to update service:', error);
      Alert.alert(t('common.error'), t('admin.services.update_error'));
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
              const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', serviceId);
              if (error) throw error;

              fetchServices();
            } catch (error) {
              console.error('Failed to delete service:', error);
              Alert.alert(t('common.error'), t('admin.services.delete_error'));
            }
          }
        }
      ]
    );
  };

  const renderServiceItem = ({ item }) => (
    <View style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.serviceDescription}>{item.description}</Text>
          )}
        </View>
        <Text style={styles.servicePrice}>{item.price} ₴</Text>
      </View>

      {item.category && (
        <View style={styles.serviceCategory}>
          <Ionicons name="bookmark-outline" size={16} color="#666" />
          <Text style={styles.serviceCategoryText}>{item.category}</Text>
        </View>
      )}

      {item.duration && (
        <View style={styles.serviceDuration}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.serviceDurationText}>{item.duration} хв.</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        <CustomButton
          title={t('common.edit')}
          onPress={() => {
            setEditingService(item);
            setFormData({
              name: item.name,
              description: item.description || '',
              price: item.price.toString(),
              duration: item.duration?.toString() || '',
              category: item.category || ''
            });
          }}
          style={styles.editButton}
        />
        <CustomButton
          title={t('common.delete')}
          onPress={() => handleDeleteService(item.id)}
          style={styles.deleteButton}
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>
          {editingService ? t('admin.services.edit_service') : t('admin.services.add_service')}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={t('admin.services.name')}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
        />

        <TextInput
          style={styles.input}
          placeholder={t('admin.services.description')}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder={t('admin.services.price')}
          value={formData.price}
          onChangeText={(text) => setFormData({ ...formData, price: text })}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder={t('admin.services.duration')}
          value={formData.duration}
          onChangeText={(text) => setFormData({ ...formData, duration: text })}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder={t('admin.services.category')}
          value={formData.category}
          onChangeText={(text) => setFormData({ ...formData, category: text })}
        />

        <View style={styles.formButtons}>
          {editingService ? (
            <>
              <CustomButton
                title={t('common.update')}
                onPress={handleUpdateService}
                style={styles.submitButton}
              />
              <CustomButton
                title={t('common.cancel')}
                onPress={() => {
                  setEditingService(null);
                  setFormData({
                    name: '',
                    description: '',
                    price: '',
                    duration: '',
                    category: ''
                  });
                }}
                style={styles.cancelButton}
              />
            </>
          ) : (
            <CustomButton
              title={t('common.add')}
              onPress={handleAddService}
              style={styles.submitButton}
            />
          )}
        </View>
      </View>

      <FlatList
        data={services}
        renderItem={renderServiceItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchServices();
        }}
      />
    </View>
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
    backgroundColor: '#f5f5f7',
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#f5f5f7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  submitButton: {
    flex: 1,
    marginRight: editingService ? 8 : 0,
  },
  cancelButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#666',
  },
  list: {
    padding: 16,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 16,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  serviceCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceCategoryText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  serviceDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceDurationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#4caf50',
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#f44336',
  },
});
