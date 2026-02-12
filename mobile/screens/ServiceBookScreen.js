import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import CustomButton from '../components/CustomButton';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Buffer } from 'buffer';
import { downloadServiceHistoryPdf, getAllServiceRecords } from '../api/serviceRecordsService';
import FloatingActionButton from '../components/FloatingActionButton';
import { getAllVehicles } from '../api/vehiclesService';

export default function ServiceBookScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVehicles();
    fetchServiceRecords();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await getAllVehicles();
      setVehicles(Array.isArray(data) ? data : []);
      if (data.length > 0) {
        setSelectedVehicle(data[0]);
      }
    } catch (error) {
      console.error('[ServiceBook] Помилка при отриманні автомобілів:', error);
      setVehicles([]);
      setSelectedVehicle(null);
      if (!error.isNetworkError && !error.isTimeoutError) {
        setError(t('vehicles.fetch_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceRecords = async () => {
    try {
      setLoading(true);
      const serviceRecords = await getAllServiceRecords();
      const formattedRecords = (serviceRecords || []).map(record => ({
        id: record.id,
        date: record.service_date,
        title: (record.description || '').split(':')[0] || 'Сервіс',
        description: record.description || '',
        mileage: record.mileage,
        cost: record.cost,
        masterName: 'Сервісний центр',
        vehicleId: record.vehicle_id,
        parts: ''
      }));
      setServiceHistory(formattedRecords);
    } catch (error) {
      console.error('[ServiceBook] Помилка при отриманні сервісних записів:', error);
      setError(t('service_book.fetch_error'));
      setServiceHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const filterServiceHistoryByVehicle = () => {
    if (!selectedVehicle) return [];
    return serviceHistory.filter(record => record.vehicleId === selectedVehicle.id);
  };

  const exportToPDF = async () => {
    if (!selectedVehicle) return;

    setLoading(true);
    try {
      const vehicleVin = selectedVehicle.vin || selectedVehicle.vehicle_vin || '';
      if (!vehicleVin) {
        Alert.alert(t('common.error'), t('service_book.export_error'));
        return;
      }
      const { data, filename } = await downloadServiceHistoryPdf(vehicleVin);
      const fileName = filename || `service-book-${vehicleVin}.pdf`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      const base64 = Buffer.from(data).toString('base64');
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: t('service_book.export_dialog_title')
      });
    } catch (error) {
      console.error('[ServiceBook] Помилка при експорті сервісної книги:', error);
      Alert.alert(t('common.error'), t('service_book.export_error'));
    } finally {
      setLoading(false);
    }
  };

  const renderVehicleSelector = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.vehicleSelector}
    >
      {vehicles.map((vehicle) => (
        <TouchableOpacity
          key={vehicle.id}
          style={[
            styles.vehicleItem,
            selectedVehicle?.id === vehicle.id && styles.selectedVehicle
          ]}
          onPress={() => {
            setSelectedVehicle(vehicle);
          }}
        >
          <Text style={[
            styles.vehicleText,
            selectedVehicle?.id === vehicle.id && styles.selectedVehicleText
          ]}>
            {vehicle.make} {vehicle.model} ({vehicle.year})
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderServiceRecord = (record) => (
    <View key={record.id} style={styles.recordItem}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordDate}>
          {new Date(record.date).toLocaleDateString()}
        </Text>
        <Text style={styles.recordMileage}>
          {record.mileage} {t('common.km')}
        </Text>
      </View>
      <Text style={styles.recordTitle}>{record.title}</Text>
      <Text style={styles.recordDescription}>{record.description}</Text>
      {record.parts && (
        <Text style={styles.recordParts}>{t('service_book.parts')}: {record.parts}</Text>
      )}
      <View style={styles.recordFooter}>
        <Text style={styles.recordCost}>
          {record.cost} {t('common.currency')}
        </Text>
        <Text style={styles.recordMaster}>{record.masterName}</Text>
      </View>
    </View>
  );

  const filteredRecords = filterServiceHistoryByVehicle();

  return (
    <View style={styles.container}>
      {renderVehicleSelector()}

      {selectedVehicle && (
        <View style={styles.header}>
          <Text style={styles.title}>{t('service_book.title')}</Text>
          <CustomButton
            title={t('service_book.export')}
            onPress={exportToPDF}
            style={styles.exportButton}
            icon="download-outline"
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#c62828" />
          <Text style={styles.errorText}>{error}</Text>
          <CustomButton
            title={t('common.retry')}
            onPress={() => {
              setError(null);
              fetchVehicles();
              fetchServiceRecords();
            }}
            style={styles.retryButton}
          />
        </View>
      ) : filteredRecords.length > 0 ? (
        <ScrollView style={styles.content}>
          {filteredRecords.map(renderServiceRecord)}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color="#666" />
          <Text style={styles.emptyText}>{t('service_book.no_records')}</Text>
          {user && user.role === 'admin' && (
            <CustomButton
              title={t('service_book.add_record')}
              onPress={() => navigation.navigate('CreateServiceRecord', { vehicleId: selectedVehicle?.id })}
              style={styles.addButton}
            />
          )}
        </View>
      )}
      
      {selectedVehicle && (
        <FloatingActionButton 
          onPress={() => navigation.navigate('CreateServiceRecord', { vehicleId: selectedVehicle?.id })}
          icon="add"
          color="#4CAF50"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  vehicleSelector: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  vehicleItem: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  selectedVehicle: {
    backgroundColor: '#1976d2',
  },
  vehicleText: {
    fontSize: 14,
    color: '#666',
  },
  selectedVehicleText: {
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  exportButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 15,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  recordItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recordDate: {
    fontSize: 14,
    color: '#666',
  },
  recordMileage: {
    fontSize: 14,
    color: '#1976d2',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  recordDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  recordParts: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic'
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  recordCost: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  recordMaster: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 10,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#c62828',
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 30,
  },
  addButton: {
    backgroundColor: '#4caf50',
    marginTop: 20,
  },
});
