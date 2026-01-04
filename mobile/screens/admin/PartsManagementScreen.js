import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
 
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as partsDao from '../../api/dao/partsDao';

export default function PartsManagementScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('name_asc');
  const [updating, setUpdating] = useState(false);
  

  const fetchParts = async () => {
    try {
      setLoading(true);
      const list = await partsDao.listAll();
      setParts(list);
    } catch (error) {
      console.error('Failed to fetch parts:', error);
      Alert.alert(t('common.error'), t('admin.parts.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddPart = async () => {
    if (!formData.name || !formData.price || !formData.stock) {
      Alert.alert(t('common.error'), t('admin.parts.required_fields'));
      return;
    }
    try {
      setUpdating(true);
      const priceNum = parseFloat(formData.price);
      const stockNum = parseInt(formData.stock, 10);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        Alert.alert(t('common.error'), t('admin.services.invalid_price'));
        return;
      }
      if (Number.isNaN(stockNum) || stockNum < 0) {
        Alert.alert(t('common.error'), t('admin.parts.required_fields'));
        return;
      }
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: priceNum,
        stock: stockNum
      };
      await partsDao.create(payload);
      setFormData({ name: '', description: '', price: '', stock: '' });
      await fetchParts();
    } catch (error) {
      console.error('Failed to add part:', error);
      Alert.alert(t('common.error'), t('admin.parts.add_error'));
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePart = async () => {
    if (!editingPart) return;
    try {
      setUpdating(true);
      const priceNum = parseFloat(formData.price);
      const stockNum = parseInt(formData.stock, 10);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        Alert.alert(t('common.error'), t('admin.services.invalid_price'));
        return;
      }
      if (Number.isNaN(stockNum) || stockNum < 0) {
        Alert.alert(t('common.error'), t('admin.parts.required_fields'));
        return;
      }
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: priceNum,
        stock: stockNum
      };
      await partsDao.updateById(editingPart.id, payload);
      setEditingPart(null);
      setFormData({ name: '', description: '', price: '', stock: '' });
      await fetchParts();
    } catch (error) {
      console.error('Failed to update part:', error);
      Alert.alert(t('common.error'), t('admin.parts.update_error'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeletePart = async (partId) => {
    Alert.alert(
      t('admin.parts.delete_title'),
      t('admin.parts.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: async () => {
          try {
            setUpdating(true);
            await partsDao.deleteById(partId);
            await fetchParts();
          } catch (error) {
            console.error('Failed to delete part:', error);
            Alert.alert(t('common.error'), t('admin.parts.delete_error'));
          } finally {
            setUpdating(false);
          }
        }}
      ]
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchParts();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchParts();
  }, []);

  

  const handlePartPress = (part) => {
    setEditingPart(part);
    setFormData({
      name: part.name,
      description: part.description || '',
      price: String(part.price || ''),
      stock: String(part.stock || '')
    });
  };

  const renderPartItem = ({ item }) => (
    <TouchableOpacity
      style={styles.partItem}
      onPress={() => handlePartPress(item)}
    >
      <View style={styles.partInfo}>
        <View style={styles.partHeader}>
          <Ionicons name="cog-outline" size={24} color="#1976d2" />
          <Text style={styles.partName}>{item.name}</Text>
        </View>
        
        <Text style={styles.partDescription}>{item.description}</Text>
        <View style={styles.partDetails}>
          <Text style={styles.partPrice}>
            {item.price} {t('common.currency')}
          </Text>
          <Text style={[styles.partStock, {
            backgroundColor: item.stock > 10 ? '#e8f5e9' : '#ffebee',
            color: item.stock > 10 ? '#4caf50' : '#f44336'
          }]}
          >
            {t('admin.parts.stock', { count: item.stock })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#4caf50', opacity: updating ? 0.6 : 1 }]}
            disabled={updating}
            onPress={() => handlePartPress(item)}
          >
            <Text style={styles.actionText}>{t('common.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#f44336', opacity: updating ? 0.6 : 1 }]}
            disabled={updating}
            onPress={() => handleDeletePart(item.id)}
          >
            <Text style={styles.actionText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f7' }}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  const filteredParts = parts.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  });

  const sortedParts = [...filteredParts].sort((a, b) => {
    switch (sortOption) {
      case 'name_asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name_desc':
        return (b.name || '').localeCompare(a.name || '');
      case 'price_asc':
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      case 'price_desc':
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      case 'stock_asc':
        return (Number(a.stock) || 0) - (Number(b.stock) || 0);
      case 'stock_desc':
        return (Number(b.stock) || 0) - (Number(a.stock) || 0);
      default:
        return 0;
    }
  });

  return (
    <View style={styles.container}>
      
      <View style={{ backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 }}>
          {editingPart ? t('admin.parts.edit_part') : t('admin.parts.add_part')}
        </Text>
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 }}
          placeholder={t('admin.parts.name')}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
        />
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 }}
          placeholder={t('admin.parts.description')}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          multiline
        />
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 }}
          placeholder={t('admin.parts.price')}
          value={formData.price}
          onChangeText={(text) => setFormData({ ...formData, price: text })}
          keyboardType="numeric"
        />
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 }}
          placeholder={t('admin.parts.quantity')}
          value={formData.stock}
          onChangeText={(text) => setFormData({ ...formData, stock: text })}
          keyboardType="numeric"
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {editingPart ? (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#1976d2', opacity: updating ? 0.6 : 1 }]}
                disabled={updating}
                onPress={handleUpdatePart}
              >
                <Text style={styles.actionText}>{t('common.update')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#666' }]}
                onPress={() => { setEditingPart(null); setFormData({ name: '', description: '', price: '', stock: '' }); }}
              >
                <Text style={styles.actionText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#4caf50', opacity: updating ? 0.6 : 1 }]}
              disabled={updating}
              onPress={handleAddPart}
            >
              <Text style={styles.actionText}>{t('common.add')}</Text>
            </TouchableOpacity>
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
              <Picker.Item label={t('admin.sort.stock_asc')} value="stock_asc" />
              <Picker.Item label={t('admin.sort.stock_desc')} value="stock_desc" />
            </Picker>
          </View>
        </View>
      </View>
      <FlatList
        data={sortedParts}
        renderItem={renderPartItem}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cog-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>{t('admin.parts.no_parts')}</Text>
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
  partItem: {
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
  partInfo: {
    flex: 1,
  },
  partHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  partName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  partDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
    marginBottom: 8,
  },
  partDetails: {
    flexDirection: 'row',
    marginLeft: 36,
  },
  partPrice: {
    fontSize: 14,
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  partStock: {
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
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
  },
});
