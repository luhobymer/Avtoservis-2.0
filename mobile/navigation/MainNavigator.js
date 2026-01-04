import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../context/AuthContext';

// Екрани
import DashboardScreen from '../screens/DashboardScreen';
import MasterDashboardScreen from '../screens/MasterDashboardScreen';
import VehiclesScreen from '../screens/VehiclesScreen';
import ServiceBookScreen from '../screens/ServiceBookScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import InteractionsScreen from '../screens/InteractionsScreen';
import ServiceRecordsScreen from '../screens/ServiceRecordsScreen';
import ServiceRecordDetails from '../screens/ServiceRecordDetails';
import NotificationsScreen from '../screens/NotificationsScreen';

const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Перевіряємо, чи користувач є майстром
  const isMaster = user?.role === 'master';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
            case 'MasterDashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Vehicles':
              iconName = focused ? 'car' : 'car-outline';
              break;
            case 'ServiceBook':
              iconName = focused ? 'book' : 'book-outline';
              break;
            case 'Appointments':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Interactions':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'ServiceRecords':
              iconName = focused ? 'book' : 'book-outline';
              break;
            case 'Notifications':
              iconName = focused ? 'notifications' : 'notifications-outline';
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
      {isMaster ? (
        // Навігація для майстра
        <Tab.Screen
          name="MasterDashboard"
          component={MasterDashboardScreen}
          options={{ title: t('master.dashboard_title') }}
        />
      ) : (
        // Навігація для клієнта
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: t('nav.dashboard') }}
        />
      )}
      
      <Tab.Screen
        name="Vehicles"
        component={VehiclesScreen}
        options={{ title: t('nav.vehicles') }}
      />
      
      <Tab.Screen
        name="ServiceBook"
        component={ServiceBookScreen}
        options={{ title: t('nav.service_book') }}
      />
      
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ title: t('nav.appointments') }}
      />
      
      <Tab.Screen
        name="Interactions"
        component={InteractionsScreen}
        options={{ title: t('nav.interactions') }}
      />
      
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('nav.profile') }}
      />
      
      <Tab.Screen
        name="ServiceRecords"
        component={ServiceRecordsScreen}
        options={{ title: t('nav.service_records') }}
      />
      
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: t('nav.notifications') }}
      />
    </Tab.Navigator>
  );
}
