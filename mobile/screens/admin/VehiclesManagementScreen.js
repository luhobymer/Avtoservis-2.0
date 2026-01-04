import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as vehiclesDao from '../../api/dao/vehiclesDao';

export default function VehiclesManagementScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOption, setSortOption] = useState('name_asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(h);
  }, [searchQuery]);
  

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const list = await vehiclesDao.listAllAdmin();
      setVehicles(list);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      Alert.alert(t('common.error'), t('admin.vehicles.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchVehicles();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  

  const handleVehiclePress = (vehicle) => {
    navigation.navigate('VehicleDetails', { vehicleId: vehicle.id });
  };

  const renderVehicleItem = ({ item }) => (
    <TouchableOpacity
      style={styles.vehicleItem}
      onPress={() => handleVehiclePress(item)}
    >
      <View style={styles.vehicleInfo}>
        <View style={styles.vehicleHeader}>
          <Ionicons name="car-outline" size={24} color="#1976d2" />
          <Text style={styles.vehicleName}>
            {item.make} {item.model} ({item.year})
          </Text>
        </View>
        <Text style={styles.vehicleDetails}>
          {t('vehicles.license_plate')}: {item.licensePlate}
        </Text>
        <View style={styles.vehicleStatus}>
          <Text style={[styles.statusTag, {
            backgroundColor: item.status === 'active' ? '#e8f5e9' : '#ffebee',
            color: item.status === 'active' ? '#4caf50' : '#f44336'
          }]}>
            {item.status === 'active' ? t('admin.users.active') : t('admin.users.inactive')}
          </Text>
          <Text style={styles.ownerInfo}>
            {t('dashboard.user')}: {item.ownerName}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  const filteredVehicles = vehicles.filter(v => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      `${v.make || ''} ${v.model || ''}`.toLowerCase().includes(q) ||
      (v.licensePlate || '').toLowerCase().includes(q) ||
      (v.ownerName || '').toLowerCase().includes(q)
    );
  });

  const statusFiltered = filteredVehicles.filter(v => {
    if (statusFilter === 'all') return true;
    return (v.status || '') === statusFilter;
  });

  const sortedVehicles = [...statusFiltered].sort((a, b) => {
    const nameA = `${a.make || ''} ${a.model || ''}`.trim();
    const nameB = `${b.make || ''} ${b.model || ''}`.trim();
    switch (sortOption) {
      case 'name_asc':
        return nameA.localeCompare(nameB);
      case 'name_desc':
        return nameB.localeCompare(nameA);
      case 'year_asc':
        return (Number(a.year) || 0) - (Number(b.year) || 0);
      case 'year_desc':
        return (Number(b.year) || 0) - (Number(a.year) || 0);
      case 'status_active_first':
        return (b.status === 'active') - (a.status === 'active');
      case 'status_inactive_first':
        return (a.status === 'active') - (b.status === 'active');
      default:
        return 0;
    }
  });

  return (
    <View style={styles.container}>
      
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{t('common.sort')}</Text>
        <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
          <Picker selectedValue={sortOption} onValueChange={(v) => setSortOption(v)}>
            <Picker.Item label={t('admin.sort.name_asc')} value="name_asc" />
            <Picker.Item label={t('admin.sort.name_desc')} value="name_desc" />
            <Picker.Item label={t('admin.sort.year_asc')} value="year_asc" />
            <Picker.Item label={t('admin.sort.year_desc')} value="year_desc" />
            <Picker.Item label={t('admin.sort.status_active_first')} value="status_active_first" />
            <Picker.Item label={t('admin.sort.status_inactive_first')} value="status_inactive_first" />
          </Picker>
        </View>
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginTop: 12, fontSize: 16 }}
          placeholder={t('common.search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{t('admin.filters.status')}</Text>
          <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
            <Picker selectedValue={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <Picker.Item label={t('admin.filters.all')} value="all" />
              <Picker.Item label={t('admin.users.active')} value="active" />
              <Picker.Item label={t('admin.users.inactive')} value="inactive" />
            </Picker>
          </View>
        </View>
      </View>
      <FlatList
        data={sortedVehicles}
        renderItem={renderVehicleItem}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="car-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>{t('admin.vehicles.no_vehicles')}</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddVehicle')}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  vehicleItem: {
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
  vehicleInfo: {
    flex: 1,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
    marginBottom: 8,
  },
  vehicleStatus: {
    flexDirection: 'row',
    marginLeft: 36,
    alignItems: 'center',
  },
  statusTag: {
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  ownerInfo: {
    fontSize: 14,
    color: '#666',
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
  },
});
