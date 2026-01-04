import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as statisticsDao from '../../api/dao/statisticsDao';

export default function AdminStatisticsScreen() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    revenue: {
      daily: [],
      monthly: [],
      total: 0
    },
    appointments: {
      pending: 0,
      completed: 0,
      cancelled: 0
    },
    services: {
      popular: [],
      revenue: []
    }
  });

  const fetchStatistics = async () => {
    try {
      const s = await statisticsDao.fetchAdminStatistics();
      setStatistics(s);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  const screenWidth = Dimensions.get('window').width;

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Загальна статистика */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.statistics_section.overview')}</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={32} color="#4caf50" />
            <Text style={styles.statValue}>
              {statistics.revenue.total} {t('common.currency')}
            </Text>
            <Text style={styles.statLabel}>{t('admin.statistics_section.total_revenue')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={32} color="#1976d2" />
            <Text style={styles.statValue}>{statistics.appointments.pending}</Text>
            <Text style={styles.statLabel}>{t('admin.statistics_section.pending_appointments')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color="#4caf50" />
            <Text style={styles.statValue}>{statistics.appointments.completed}</Text>
            <Text style={styles.statLabel}>{t('admin.statistics_section.completed_services')}</Text>
          </View>
        </View>
      </View>

      {/* Графік доходів */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.statistics_section.revenue_chart')}</Text>
        <LineChart
          data={{
            labels: statistics.revenue.monthly.map(item => item.month),
            datasets: [{
              data: statistics.revenue.monthly.map(item => item.amount)
            }]
          }}
          width={screenWidth - 32}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>

      {/* Популярні послуги */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.statistics_section.popular_services')}</Text>
        <BarChart
          data={{
            labels: statistics.services.popular.map(service => service.name),
            datasets: [{
              data: statistics.services.popular.map(service => service.count)
            }]
          }}
          width={screenWidth - 32}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
          verticalLabelRotation={30}
        />
      </View>
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
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '30%',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});
