import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../api/supabaseClient';

export default function AdminStatisticsScreen() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAppointments: 0,
    completedAppointments: 0,
    totalRevenue: 0,
    popularServices: [],
    activeUsers: 0,
    totalVehicles: 0,
    partsInventory: 0
  });

  const fetchStatistics = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Токен недоступний');
      }

      const { count: totalAppointments } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true });

      const { count: completedAppointments } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed');

      const { data: serviceCosts, error: serviceCostsError } = await supabase
        .from('service_records')
        .select('cost');
      if (serviceCostsError) throw serviceCostsError;
      const totalRevenue = (serviceCosts || []).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        .select('service_id, services ( name )')
        .not('service_id', 'is', null);
      if (apptsError) throw apptsError;
      const serviceCountMap = {};
      (appts || []).forEach(a => {
        const key = (a.services && a.services.name) || 'Інше';
        serviceCountMap[key] = (serviceCountMap[key] || 0) + 1;
      });
      const popularServices = Object.entries(serviceCountMap)
        .map(([name, count], idx) => ({ id: idx + 1, name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const { count: activeUsers } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('active', true);

      const { count: totalVehicles } = await supabase
        .from('vehicles')
        .select('vin', { count: 'exact', head: true });

      const { data: parts, error: partsError } = await supabase
        .from('parts')
        .select('quantity');
      if (partsError) throw partsError;
      const partsInventory = (parts || []).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

      setStats({
        totalAppointments: totalAppointments || 0,
        completedAppointments: completedAppointments || 0,
        totalRevenue,
        popularServices,
        activeUsers: activeUsers || 0,
        totalVehicles: totalVehicles || 0,
        partsInventory
      });
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  const StatCard = ({ title, value, icon, color = '#1976d2' }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
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
        <Text style={styles.title}>{t('admin.statistics')}</Text>
        <Text style={styles.subtitle}>{t('admin.statistics_desc')}</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          title={t('admin.stats.total_appointments')}
          value={stats.totalAppointments}
          icon="calendar-outline"
        />
        <StatCard
          title={t('admin.stats.completed_appointments')}
          value={stats.completedAppointments}
          icon="checkmark-circle-outline"
          color="#4caf50"
        />
        <StatCard
          title={t('admin.stats.total_revenue')}
          value={`${stats.totalRevenue} ₴`}
          icon="cash-outline"
          color="#2e7d32"
        />
        <StatCard
          title={t('admin.stats.active_users')}
          value={stats.activeUsers}
          icon="people-outline"
          color="#1565c0"
        />
        <StatCard
          title={t('admin.stats.total_vehicles')}
          value={stats.totalVehicles}
          icon="car-outline"
          color="#0d47a1"
        />
        <StatCard
          title={t('admin.stats.parts_inventory')}
          value={stats.partsInventory}
          icon="cube-outline"
          color="#6a1b9a"
        />
      </View>

      <View style={styles.popularServices}>
        <Text style={styles.sectionTitle}>{t('admin.stats.popular_services')}</Text>
        {stats.popularServices.map((service, index) => (
          <View key={service.id} style={styles.serviceItem}>
            <Text style={styles.serviceRank}>#{index + 1}</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceCount}>
                {t('admin.stats.times_booked', { count: service.count })}
              </Text>
            </View>
          </View>
        ))}
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
    backgroundColor: '#f5f5f7',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  statsGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '48%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  popularServices: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
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
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  serviceRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    width: 40,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  serviceCount: {
    fontSize: 14,
    color: '#666',
  },
});
