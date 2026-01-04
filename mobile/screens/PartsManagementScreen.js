import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
import { supabase } from '../api/supabaseClient';

export default function PartsManagementScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '',
    manufacturer: '',
    partNumber: ''
  });

  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('id, name, description, price, quantity, manufacturer, part_number')
        .order('name');
      if (error) throw error;
      setParts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch parts:', error);
      Alert.alert(t('common.error'), t('admin.parts.fetch_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchParts();
    });

    return unsubscribe;
  }, [navigation]);

  const handleAddPart = async () => {
    if (!formData.name || !formData.price || !formData.quantity) {
      Alert.alert(t('common.error'), t('admin.parts.required_fields'));
      return;
    }

    try {
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: Number(formData.price) || 0,
        quantity: Number(formData.quantity) || 0,
        manufacturer: formData.manufacturer || '',
        part_number: formData.partNumber || ''
      };
      const { error } = await supabase
        .from('parts')
        .insert(payload);
      if (error) throw error;

      setFormData({
        name: '',
        description: '',
        price: '',
        quantity: '',
        manufacturer: '',
        partNumber: ''
      });
      fetchParts();
    } catch (error) {
      console.error('Failed to add part:', error);
      Alert.alert(t('common.error'), t('admin.parts.add_error'));
    }
  };

  const handleUpdatePart = async () => {
    if (!editingPart) return;

    try {
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: Number(formData.price) || 0,
        quantity: Number(formData.quantity) || 0,
        manufacturer: formData.manufacturer || '',
        part_number: formData.partNumber || ''
      };
      const { error } = await supabase
        .from('parts')
        .update(payload)
        .eq('id', editingPart.id);
      if (error) throw error;

      setEditingPart(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        quantity: '',
        manufacturer: '',
        partNumber: ''
      });
      fetchParts();
    } catch (error) {
      console.error('Failed to update part:', error);
      Alert.alert(t('common.error'), t('admin.parts.update_error'));
    }
  };

  const handleDeletePart = async (partId) => {
    Alert.alert(
      t('admin.parts.delete_title'),
      t('admin.parts.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('parts')
                .delete()
                .eq('id', partId);
              if (error) throw error;

              fetchParts();
            } catch (error) {
              console.error('Failed to delete part:', error);
              Alert.alert(t('common.error'), t('admin.parts.delete_error'));
            }
          }
        }
      ]
    );
  };

  const renderPartItem = ({ item }) => (
    <View style={styles.partCard}>
      <View style={styles.partHeader}>
        <View style={styles.partInfo}>
          <Text style={styles.partName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.partDescription}>{item.description}</Text>
          )}
        </View>
        <Text style={styles.partPrice}>{item.price} ₴</Text>
      </View>

      <View style={styles.partDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="cube-outline" size={16} color="#666" />
          <Text style={styles.detailText}>{t('admin.parts.quantity')}: {item.quantity}</Text>
        </View>

        {item.manufacturer && (
          <View style={styles.detailItem}>
            <Ionicons name="business-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{item.manufacturer}</Text>
          </View>
        )}

        {item.partNumber && (
          <View style={styles.detailItem}>
            <Ionicons name="barcode-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{item.partNumber}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        <CustomButton
          title={t('common.edit')}
          onPress={() => {
            setEditingPart(item);
            setFormData({
              name: item.name,
              description: item.description || '',
              price: item.price.toString(),
              quantity: item.quantity.toString(),
              manufacturer: item.manufacturer || '',
              partNumber: item.partNumber || ''
            });
          }}
          style={styles.editButton}
        />
        <CustomButton
          title={t('common.delete')}
          onPress={() => handleDeletePart(item.id)}
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
          {editingPart ? t('admin.parts.edit_part') : t('admin.parts.add_part')}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={t('admin.parts.name')}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
        />

        <TextInput
          style={styles.input}
          placeholder={t('admin.parts.description')}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder={t('admin.parts.price')}
          value={formData.price}
          onChangeText={(text) => setFormData({ ...formData, price: text })}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder={t('admin.parts.quantity')}
          value={formData.quantity}
          onChangeText={(text) => setFormData({ ...formData, quantity: text })}
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          placeholder={t('admin.parts.manufacturer')}
          value={formData.manufacturer}
          onChangeText={(text) => setFormData({ ...formData, manufacturer: text })}
        />

        <TextInput
          style={styles.input}
          placeholder={t('admin.parts.part_number')}
          value={formData.partNumber}
          onChangeText={(text) => setFormData({ ...formData, partNumber: text })}
        />

        <View style={styles.formButtons}>
          {editingPart ? (
            <>
              <CustomButton
                title={t('common.update')}
                onPress={handleUpdatePart}
                style={styles.submitButton}
              />
              <CustomButton
                title={t('common.cancel')}
                onPress={() => {
                  setEditingPart(null);
                  setFormData({
                    name: '',
                    description: '',
                    price: '',
                    quantity: '',
                    manufacturer: '',
                    partNumber: ''
                  });
                }}
                style={styles.cancelButton}
              />
            </>
          ) : (
            <CustomButton
              title={t('common.add')}
              onPress={handleAddPart}
              style={styles.submitButton}
            />
          )}
        </View>
      </View>

      <FlatList
        data={parts}
        renderItem={renderPartItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchParts();
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
    marginRight: editingPart ? 8 : 0,
  },
  cancelButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#666',
  },
  list: {
    padding: 16,
  },
  partCard: {
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
  partHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  partInfo: {
    flex: 1,
    marginRight: 16,
  },
  partName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  partDescription: {
    fontSize: 14,
    color: '#666',
  },
  partPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  partDetails: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
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
