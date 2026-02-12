import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { completeAppointment } from '../api/appointmentsService';
import PartPhotoInput from '../components/PartPhotoInput';

export default function CompleteAppointmentScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { getToken } = useAuth();

  const { appointmentId, currentNotes, vehicleVin } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [completionNotes, setCompletionNotes] = useState(currentNotes || '');
  const [completionMileage, setCompletionMileage] = useState('');
  const [parts, setParts] = useState([]);
  
  // New part manual entry state
  const [modalVisible, setModalVisible] = useState(false);
  const [newPart, setNewPart] = useState({ name: '', price: '', quantity: '1', purchased_by: 'owner' });

  const handleComplete = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      const payload = {
        notes: completionNotes,
        completion_mileage: completionMileage ? Number(completionMileage) : null,
        parts: parts.map(p => ({
          name: p.name,
          part_number: p.partNumber || '',
          price: p.price ? Number(p.price) : 0,
          quantity: p.quantity ? Number(p.quantity) : 1,
          purchased_by: p.purchased_by || 'owner',
          notes: p.notes || ''
        }))
      };

      await completeAppointment(appointmentId, payload, token);
      
      Alert.alert(
        t('common.success'),
        t('appointments.complete_success'),
        [
          { text: t('common.ok'), onPress: () => navigation.navigate('Appointments') } // Or back to Details
        ]
      );
    } catch (error) {
      console.error('[CompleteAppointmentScreen] Error:', error);
      Alert.alert(t('common.error'), t('appointments.complete_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddPart = () => {
    if (!newPart.name) {
      Alert.alert(t('common.warning'), t('parts.name_required'));
      return;
    }
    setParts([...parts, { ...newPart, id: Date.now().toString() }]);
    setNewPart({ name: '', price: '', quantity: '1', purchased_by: 'owner' });
    setModalVisible(false);
  };

  const handlePartRecognized = (details) => {
    // details contains { partName, partNumber, price, ... }
    const recognizedPart = {
      id: Date.now().toString(),
      name: details.partName || t('parts.unnamed_part'),
      partNumber: details.partNumber,
      price: details.price,
      quantity: 1,
      purchased_by: 'owner',
      notes: 'Added via OCR'
    };
    setParts([...parts, recognizedPart]);
  };

  const removePart = (id) => {
    setParts(parts.filter(p => p.id !== id));
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('appointments.complete_title', 'Завершення запису')}</Text>
          
          <Text style={styles.label}>{t('appointments.mileage', 'Пробіг (км)')}:</Text>
          <TextInput
            style={styles.input}
            value={completionMileage}
            onChangeText={setCompletionMileage}
            placeholder="150000"
            keyboardType="numeric"
          />

          <Text style={styles.label}>{t('appointments.notes', 'Примітки')}:</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={completionNotes}
            onChangeText={setCompletionNotes}
            multiline
            numberOfLines={4}
            placeholder={t('appointments.notes_placeholder')}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('parts.usedParts', 'Використані запчастини')}</Text>
          
          {parts.map((part) => (
            <View key={part.id} style={styles.partItem}>
              <View style={{flex: 1}}>
                <Text style={styles.partName}>{part.name}</Text>
                {part.partNumber ? <Text style={styles.partDetail}>#{part.partNumber}</Text> : null}
                <Text style={styles.partDetail}>
                  {part.quantity} x {part.price} {t('currency', 'грн')} ({t(`parts.${part.purchased_by}`, part.purchased_by)})
                </Text>
              </View>
              <TouchableOpacity onPress={() => removePart(part.id)} style={styles.removeButton}>
                <Ionicons name="trash-outline" size={20} color="#f44336" />
              </TouchableOpacity>
            </View>
          ))}

          {parts.length === 0 && (
            <Text style={styles.emptyText}>{t('parts.no_parts_added', 'Запчастини не додано')}</Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#1976d2" />
              <Text style={styles.secondaryButtonText}>{t('parts.add_manual', 'Додати вручну')}</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.label, {marginTop: 16}]}>{t('parts.scan_from_photo', 'Або сканувати з фото')}:</Text>
          <PartPhotoInput 
            onPhotoSelect={() => {}} 
            onDetailsRecognized={handlePartRecognized}
            vehicleId={vehicleVin || null}
          />
        </View>

        <TouchableOpacity
          style={[styles.mainButton, loading && styles.disabledButton]}
          onPress={handleComplete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.mainButtonText}>{t('appointments.confirm_completion', 'Підтвердити завершення')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Manual Add Part Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('parts.add_part', 'Додати запчастину')}</Text>
            
            <TextInput
              style={styles.input}
              placeholder={t('parts.name', 'Назва')}
              value={newPart.name}
              onChangeText={(text) => setNewPart({...newPart, name: text})}
            />
            
            <View style={styles.row}>
              <TextInput
                style={[styles.input, {flex: 1, marginRight: 8}]}
                placeholder={t('parts.price', 'Ціна')}
                value={newPart.price}
                onChangeText={(text) => setNewPart({...newPart, price: text})}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, {flex: 1, marginLeft: 8}]}
                placeholder={t('parts.qty', 'К-сть')}
                value={newPart.quantity}
                onChangeText={(text) => setNewPart({...newPart, quantity: text})}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.confirmButton]} 
                onPress={handleAddPart}
              >
                <Text style={styles.buttonText}>{t('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  partItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  partName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  partDetail: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 16,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  mainButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#1976d2',
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#1976d2',
    marginLeft: 8,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  confirmButton: {
    backgroundColor: '#4caf50',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
