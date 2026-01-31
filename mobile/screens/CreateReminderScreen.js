import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { createMaintenanceReminder } from '../api/reminderService';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';
import * as Notifications from 'expo-notifications';

export default function CreateReminderScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState({
    vehicleId: '',
    serviceType: '',
    dueDate: new Date(),
    daysBeforeDue: 7,
    notes: ''
  });

  useEffect(() => {
    fetchVehicles();
    checkNotificationPermissions();
  }, []);

  const fetchVehicles = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Token is required');
      }
      const list = await getUserVehicles(token);
      setVehicles(list);
      if (list.length > 0) {
        setFormData(prev => ({ ...prev, vehicleId: list[0].id }));
      }
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      Alert.alert(t('common.error'), t('vehicles.fetch_error'));
    }
  };

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        Alert.alert(
          t('reminders.permissions_title'),
          t('reminders.permissions_message')
        );
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.vehicleId || !formData.serviceType) {
      Alert.alert(t('common.error'), t('reminders.required_fields'));
      return;
    }

    setLoading(true);

    try {
      await createMaintenanceReminder({
        vehicleId: formData.vehicleId,
        maintenanceType: formData.serviceType,
        mileage: undefined,
        dueDate: formData.dueDate.toISOString()
      }, await getToken());
      navigation.goBack();
    } catch (error) {
      console.error('Failed to create reminder:', error);
      Alert.alert(t('common.error'), t('reminders.create_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('reminders.vehicle')}</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.vehicleId}
              onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
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
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('reminders.service_type')}</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.serviceType}
              onValueChange={(value) => setFormData({ ...formData, serviceType: value })}
              style={styles.picker}
            >
              <Picker.Item label={t('services.oil_change')} value="oil_change" />
              <Picker.Item label={t('services.tire_rotation')} value="tire_rotation" />
              <Picker.Item label={t('services.brake_service')} value="brake_service" />
              <Picker.Item label={t('services.general_inspection')} value="general_inspection" />
            </Picker>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('reminders.due_date')}</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.dateButtonText}>
              {formData.dueDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={formData.dueDate}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setFormData({ ...formData, dueDate: selectedDate });
                }
              }}
            />
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('reminders.notify_days_before')}</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.daysBeforeDue}
              onValueChange={(value) => setFormData({ ...formData, daysBeforeDue: value })}
              style={styles.picker}
            >
              <Picker.Item label={t('reminders.days', { count: 1 })} value={1} />
              <Picker.Item label={t('reminders.days', { count: 3 })} value={3} />
              <Picker.Item label={t('reminders.days', { count: 7 })} value={7} />
              <Picker.Item label={t('reminders.days', { count: 14 })} value={14} />
              <Picker.Item label={t('reminders.days', { count: 30 })} value={30} />
            </Picker>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('reminders.notes')}</Text>
          <TextInput
            style={styles.input}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            multiline
            numberOfLines={3}
            placeholder={t('reminders.notes_placeholder')}
          />
        </View>

        <CustomButton
          title={loading ? '' : t('common.save')}
          onPress={handleSubmit}
          style={styles.submitButton}
          loading={loading}
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
  form: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  submitButton: {
    marginTop: 24,
  },
});
