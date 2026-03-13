import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axiosAuth from '../api/axiosConfig';

export default function MyPartsScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);

  const fetchParts = async () => {
    try {
      setLoading(true);
      const response = await axiosAuth.get('/api/vehicle-parts');
      const rows = Array.isArray(response.data) ? response.data : [];
      setParts(rows);
    } catch (error) {
      console.error('[MyPartsScreen] Failed to load parts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, []);

  const renderPartItem = ({ item }) => {
    const name = item.name || t('parts.name', 'Запчастина');
    const partNumber = item.part_number || item.partNumber;
    const price =
      typeof item.price === 'number'
        ? `${item.price} ${t('common.currency', 'грн')}`
        : '';
    const vehicleVin = item.vehicle_vin || item.vehicleVin;

    return (
      <View style={styles.item}>
        <View style={styles.iconContainer}>
          <Ionicons name="cog-outline" size={24} color="#1976d2" />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          {!!partNumber && (
            <Text style={styles.secondary}>
              {t('parts.part_number', 'Номер')} {partNumber}
            </Text>
          )}
          {!!vehicleVin && (
            <Text style={styles.secondary}>
              {t('parts.vehicle_vin', 'VIN')}: {vehicleVin}
            </Text>
          )}
          {!!price && <Text style={styles.price}>{price}</Text>}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  if (!parts.length) {
    return (
      <View style={styles.center}>
        <Ionicons name="cog-outline" size={64} color="#ccc" />
        <Text style={styles.message}>
          {t('parts.no_parts', 'У вас ще немає доданих запчастин')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={parts}
        renderItem={renderPartItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  list: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  secondary: {
    fontSize: 14,
    color: '#757575',
  },
  price: {
    marginTop: 4,
    fontSize: 13,
    color: '#1976d2',
  },
});

