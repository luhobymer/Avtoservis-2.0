import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../context/AuthContext';

// Навігатори
import MainNavigator from './MainNavigator';
import AuthNavigator from './AuthNavigator';
import AdminNavigator from './AdminNavigator';

// Екрани для деталей
import AppointmentDetailsScreen from '../screens/AppointmentDetailsScreen';
import VehicleDetailsScreen from '../screens/VehicleDetails';
import ServiceRecordDetailsScreen from '../screens/ServiceRecordDetails';
import ServiceRecordsScreen from '../screens/ServiceRecordsScreen';
import AddVehicleScreen from '../screens/AddVehicle';
import EditVehicleScreen from '../screens/EditVehicle';
import CreateServiceRecord from '../screens/CreateServiceRecord';
import ActionMenu from '../screens/ActionMenu';
import NewInteractionScreen from '../screens/NewInteractionScreen';
import ChatScreen from '../screens/ChatScreen';
import CreateAppointmentScreen from '../screens/CreateAppointmentScreen';
import CompleteAppointmentScreen from '../screens/CompleteAppointmentScreen';
import MasterWorkingHoursScreen from '../screens/MasterWorkingHoursScreen';
import MasterDashboardScreen from '../screens/MasterDashboardScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#000000',
        headerTitleStyle: {
          fontWeight: '500',
        },
      }}
    >
      {!user ? (
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={user.role === 'master' ? AdminNavigator : MainNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AppointmentDetails"
            component={AppointmentDetailsScreen}
            options={{ headerShown: true, title: t('appointments.appointment_details') }}
          />
          <Stack.Screen
            name="VehicleDetails"
            component={VehicleDetailsScreen}
            options={{ headerShown: true, title: t('vehicles.vehicle_details') }}
          />
          <Stack.Screen
            name="ServiceRecordDetails"
            component={ServiceRecordDetailsScreen}
            options={{ headerShown: true, title: t('service_records.details') }}
          />
          <Stack.Screen
            name="ServiceRecords"
            component={ServiceRecordsScreen}
            options={{ headerShown: true, title: t('nav.service_records') }}
          />
          <Stack.Screen
            name="AddVehicle"
            component={AddVehicleScreen}
            options={{ headerShown: true, title: t('vehicles.add_vehicle') }}
          />
          <Stack.Screen
            name="EditVehicle"
            component={EditVehicleScreen}
            options={{ headerShown: true, title: t('vehicles.edit_vehicle') }}
          />
          <Stack.Screen
            name="CreateServiceRecord"
            component={CreateServiceRecord}
            options={{ headerShown: true, title: t('service_records.add_record') }}
          />
          <Stack.Screen
            name="ActionMenu"
            component={ActionMenu}
            options={{ 
              headerShown: false, 
              presentation: 'transparentModal',
              cardOverlayEnabled: true,
              cardStyle: { backgroundColor: 'transparent' }
            }}
          />
          <Stack.Screen
            name="NewInteraction"
            component={NewInteractionScreen}
            options={{ 
              headerShown: true, 
              title: t('interactions.new_interaction')
            }}
          />
          <Stack.Screen
            name="ChatScreen"
            component={ChatScreen}
            options={{ 
              headerShown: true
            }}
          />
          <Stack.Screen
            name="CreateAppointment"
            component={CreateAppointmentScreen}
            options={{ 
              headerShown: true, 
              title: t('appointments.add_appointment')
            }}
          />
          <Stack.Screen
            name="CompleteAppointment"
            component={CompleteAppointmentScreen}
            options={{ 
              headerShown: true, 
              title: t('appointments.complete_appointment', 'Завершити запис')
            }}
          />
          <Stack.Screen
            name="MasterWorkingHours"
            component={MasterWorkingHoursScreen}
            options={{ 
              headerShown: true, 
              title: t('master.working_hours_title')
            }}
          />
          <Stack.Screen
            name="MasterDashboard"
            component={MasterDashboardScreen}
            options={{ 
              headerShown: true, 
              title: t('master.dashboard_title')
            }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ headerShown: true, title: t('nav.notifications') }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
