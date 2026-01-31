import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getUserVehicles } from '../api/vehiclesApi';
import { getUserServiceRecords } from '../api/servicesApi';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [timeRange, setTimeRange] = useState('year'); // year, month, week

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (selectedVehicle) {
      fetchStatistics();
    }
  }, [selectedVehicle, timeRange]);

  const fetchVehicles = async () => {
    try {
      const list = await getUserVehicles(null);
      setVehicles(list);
      if (list.length > 0) {
        setSelectedVehicle(list[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      Alert.alert(t('common.error'), t('vehicles.fetch_error'));
    }
  };

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const start = new Date(now);
      if (timeRange === 'year') start.setFullYear(now.getFullYear() - 1);
      else if (timeRange === 'month') start.setMonth(now.getMonth() - 1);
      else if (timeRange === 'week') start.setDate(now.getDate() - 7);

      const rows = await getUserServiceRecords(null);
      const filtered = (rows || []).filter(r => {
        if (!r.service_date) return false;
        if (r.vehicle_vin !== selectedVehicle && r.vehicle_id !== selectedVehicle) return false;
        const d = new Date(r.service_date);
        return d >= start && d <= now;
      });
      const totalSpent = filtered.reduce((s, r) => s + (Number(r.cost) || 0), 0);
      const servicesCount = filtered.length;
      const totalMileage = 0; // якщо є джерело пробігу, додамо пізніше

      const expensesOverTime = {};
      const servicesByType = {};
      filtered.forEach(r => {
        const d = r.service_date ? new Date(r.service_date) : now;
        const label = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
        expensesOverTime[label] = (expensesOverTime[label] || 0) + (Number(r.cost) || 0);
        const type = (r.service_details || '').split(':')[0] || 'Інше';
        servicesByType[type] = (servicesByType[type] || 0) + 1;
      });

      const expensesLabels = Object.keys(expensesOverTime).sort((a,b)=>a.localeCompare(b));
      const stats = {
        totalSpent,
        servicesCount,
        totalMileage,
        expensesOverTime: {
          labels: expensesLabels,
          data: expensesLabels.map(l => expensesOverTime[l])
        },
        servicesByType: {
          labels: Object.keys(servicesByType),
          data: Object.keys(servicesByType).map(k => servicesByType[k])
        }
      };
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
      Alert.alert(t('common.error'), t('statistics.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
    style: {
      borderRadius: 16
    }
  };

  const renderSummaryCard = (icon, title, value, unit) => (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={24} color="#1976d2" style={styles.cardIcon} />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>
        {value} {unit}
      </Text>
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedVehicle}
            onValueChange={(value) => setSelectedVehicle(value)}
            style={styles.picker}
          >
            {vehicles.map((vehicle) => (
              <Picker.Item
                key={vehicle.id}
                label={`${vehicle.brand} ${vehicle.model}`}
                value={vehicle.id}
              />
            ))}
          </Picker>
        </View>

        <View style={styles.timeRangeContainer}>
          <Picker
            selectedValue={timeRange}
            onValueChange={(value) => setTimeRange(value)}
            style={styles.picker}
          >
            <Picker.Item label={t('statistics.year')} value="year" />
            <Picker.Item label={t('statistics.month')} value="month" />
            <Picker.Item label={t('statistics.week')} value="week" />
          </Picker>
        </View>
      </View>

      {statistics && (
        <View style={styles.content}>
          <View style={styles.summaryContainer}>
            {renderSummaryCard(
              'cash-outline',
              t('statistics.total_spent'),
              statistics.totalSpent,
              t('common.currency')
            )}
            {renderSummaryCard(
              'build-outline',
              t('statistics.services_count'),
              statistics.servicesCount,
              t('statistics.times')
            )}
            {renderSummaryCard(
              'speedometer-outline',
              t('statistics.total_mileage'),
              statistics.totalMileage,
              t('common.km')
            )}
          </View>

          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{t('statistics.expenses_over_time')}</Text>
            <LineChart
              data={{
                labels: statistics.expensesOverTime.labels,
                datasets: [{
                  data: statistics.expensesOverTime.data
                }]
              }}
              width={Dimensions.get('window').width - 30}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>

          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{t('statistics.services_by_type')}</Text>
            <BarChart
              data={{
                labels: statistics.servicesByType.labels,
                datasets: [{
                  data: statistics.servicesByType.data
                }]
              }}
              width={Dimensions.get('window').width - 30}
              height={220}
              chartConfig={chartConfig}
              style={styles.chart}
              showValuesOnTopOfBars
            />
          </View>
        </View>
      )}
    </ScrollView>
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
  header: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  pickerContainer: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  timeRangeContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    backgroundColor: '#fff',
  },
  content: {
    padding: 15,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  summaryCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardIcon: {
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  chart: {
    borderRadius: 8,
    marginVertical: 8,
  },
});
