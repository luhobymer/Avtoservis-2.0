import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// Screens
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import UsersManagementScreen from '../screens/admin/UsersManagementScreen';
import ServicesManagementScreen from '../screens/admin/ServicesManagementScreen';
import PartsManagementScreen from '../screens/admin/PartsManagementScreen';
import AppointmentsManagementScreen from '../screens/admin/AppointmentsManagementScreen';
import AdminStatisticsScreen from '../screens/admin/AdminStatisticsScreen';

const Tab = createBottomTabNavigator();

export default function AdminNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'AdminDashboard':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Users':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Services':
              iconName = focused ? 'build' : 'build-outline';
              break;
            case 'Parts':
              iconName = focused ? 'cube' : 'cube-outline';
              break;
            case 'AdminAppointments':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Statistics':
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              break;
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#c62828',
        tabBarInactiveTintColor: '#9e9e9e',
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#000000',
        headerTitleStyle: {
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: t('admin.dashboard') }}
      />
      <Tab.Screen
        name="Users"
        component={UsersManagementScreen}
        options={{ title: t('admin.users') }}
      />
      <Tab.Screen
        name="Services"
        component={ServicesManagementScreen}
        options={{ title: t('admin.services') }}
      />
      <Tab.Screen
        name="Parts"
        component={PartsManagementScreen}
        options={{ title: t('admin.parts') }}
      />
      <Tab.Screen
        name="AdminAppointments"
        component={AppointmentsManagementScreen}
        options={{ title: t('admin.appointments') }}
      />
      <Tab.Screen
        name="Statistics"
        component={AdminStatisticsScreen}
        options={{ title: t('admin.statistics') }}
      />
    </Tab.Navigator>
  );
}