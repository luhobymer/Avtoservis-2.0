import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboardScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const menuItems = [
    {
      id: 'users',
      title: t('admin.users_management'),
      icon: 'people-outline',
      screen: 'UsersManagement',
      description: t('admin.users_management_desc')
    },
    {
      id: 'services',
      title: t('admin.services_management'),
      icon: 'build-outline',
      screen: 'ServicesManagement',
      description: t('admin.services_management_desc')
    },
    {
      id: 'parts',
      title: t('admin.parts_management'),
      icon: 'cog-outline',
      screen: 'PartsManagement',
      description: t('admin.parts_management_desc')
    },
    {
      id: 'vehicles',
      title: t('admin.vehicles_management'),
      icon: 'car-outline',
      screen: 'VehiclesManagement',
      description: t('admin.vehicles_management_desc')
    },
    {
      id: 'appointments',
      title: t('admin.appointments_management'),
      icon: 'calendar-outline',
      screen: 'AppointmentsManagement',
      description: t('admin.appointments_management_desc')
    },
    {
      id: 'statistics',
      title: t('admin.statistics'),
      icon: 'stats-chart-outline',
      screen: 'AdminStatistics',
      description: t('admin.statistics_desc')
    }
  ];

  const renderMenuItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={() => navigation.navigate(item.screen)}
    >
      <View style={styles.menuItemHeader}>
        <Ionicons name={item.icon} size={24} color="#1976d2" />
        <Text style={styles.menuItemTitle}>{item.title}</Text>
      </View>
      <Text style={styles.menuItemDescription}>{item.description}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color="#666" style={styles.menuItemArrow} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('admin.dashboard')}</Text>
        <Text style={styles.subtitle}>
          {t('admin.welcome')}, {user?.name}
        </Text>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map(renderMenuItem)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  menuContainer: {
    padding: 16,
  },
  menuItem: {
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
  menuItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuItemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
  },
  menuItemArrow: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
});