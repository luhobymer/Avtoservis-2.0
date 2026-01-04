import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { createInteraction } from '../api/interactionService';
import * as usersDao from '../api/dao/usersDao';
import * as vehiclesService from '../api/vehiclesService';
import * as appointmentsApi from '../api/appointmentsApi';
import { Picker } from '@react-native-picker/picker';

export default function NewInteractionScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { user, getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [message, setMessage] = useState('');
  const [interactionType, setInteractionType] = useState('message');
  const [relatedEntities, setRelatedEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Отримуємо список можливих отримувачів (адміністратори та майстри)
  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const allUsers = await usersDao.listAll();
      const candidates = (allUsers || []).filter(u => u.role === 'admin' || u.role === 'master').map(u => ({ id: u.id, name: u.name || u.email, role: u.role }));
      setRecipients(candidates);
      if (route.params?.recipientId) {
        const recipient = candidates.find(r => r.id === route.params.recipientId);
        if (recipient) setSelectedRecipient(recipient);
      } else if (candidates.length > 0) {
        setSelectedRecipient(candidates[0]);
      }
    } catch (error) {
      console.error('[NewInteractionScreen] Помилка при отриманні списку отримувачів:', error);
      Alert.alert(t('common.error'), t('interactions.recipients_error'));
    } finally {
      setLoading(false);
    }
  };

  // Отримуємо список пов'язаних сутностей (автомобілі, записи на сервіс)
  const fetchRelatedEntities = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const vehicles = await vehiclesService.getAllVehicles();
      const vehicleItems = (vehicles || []).map(v => ({ id: `veh_${v.id}`, type: 'vehicle', name: `${v.make} ${v.model} (${v.year || ''})`.trim(), entityId: v.id }));
      const appointments = await appointmentsApi.getUserAppointments(token);
      const userAppointments = (appointments || []).filter(a => a.user_id === user?.id);
      const appointmentItems = userAppointments.map(a => ({ id: `app_${a.id}`, type: 'appointment', name: new Date(a.scheduled_time).toLocaleString(), entityId: a.id }));
      setRelatedEntities([...vehicleItems, ...appointmentItems]);
    } catch (error) {
      console.error('[NewInteractionScreen] Помилка при отриманні списку сутностей:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipients();
    fetchRelatedEntities();
  }, []);

  const handleSend = async () => {
    if (!selectedRecipient) {
      Alert.alert(t('common.error'), t('interactions.select_recipient'));
      return;
    }

    if (!message.trim()) {
      Alert.alert(t('common.error'), t('interactions.enter_message'));
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      
      const interactionData = {
        senderId: user.id,
        senderRole: user.role,
        senderName: user.name || user.email,
        recipientId: selectedRecipient.id,
        recipientRole: selectedRecipient.role,
        recipientName: selectedRecipient.name,
        message: message.trim(),
        type: interactionType,
        relatedEntity: selectedEntity?.type,
        relatedEntityId: selectedEntity?.entityId
      };
      
      await createInteraction(interactionData, token);
      
      Alert.alert(
        t('common.success'),
        t('interactions.send_success'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('[NewInteractionScreen] Помилка при відправленні взаємодії:', error);
      Alert.alert(t('common.error'), t('interactions.send_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>{t('interactions.recipient')}</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedRecipient?.id}
            onValueChange={(itemValue) => {
              const recipient = recipients.find(r => r.id === itemValue);
              setSelectedRecipient(recipient);
            }}
            style={styles.picker}
            enabled={!loading}
          >
            {recipients.map((recipient) => (
              <Picker.Item 
                key={recipient.id} 
                label={`${recipient.name} (${recipient.role === 'admin' ? t('auth.roleAdmin') : recipient.role === 'master' ? t('auth.roleMaster') : t('auth.roleClient')})` }
                value={recipient.id} 
              />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>{t('interactions.type')}</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={interactionType}
            onValueChange={(itemValue) => setInteractionType(itemValue)}
            style={styles.picker}
            enabled={!loading}
          >
            <Picker.Item label={t('interactions.types.message')} value="message" />
            <Picker.Item label={t('interactions.types.question')} value="question" />
            <Picker.Item label={t('interactions.types.request')} value="request" />
          </Picker>
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>{t('interactions.related_entity')}</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedEntity?.id}
            onValueChange={(itemValue) => {
              if (itemValue === 0) {
                setSelectedEntity(null);
              } else {
                const entity = relatedEntities.find(e => e.id === itemValue);
                setSelectedEntity(entity);
              }
            }}
            style={styles.picker}
            enabled={!loading}
          >
            <Picker.Item label={t('interactions.no_entity')} value={0} />
            {relatedEntities.map((entity) => (
              <Picker.Item 
                key={entity.id} 
                label={`${entity.name} (${t(`interactions.entities.${entity.type}`)})` }
                value={entity.id} 
              />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>{t('interactions.message')}</Text>
        <TextInput
          style={styles.messageInput}
          multiline
          placeholder={t('interactions.message_placeholder')}
          value={message}
          onChangeText={setMessage}
          editable={!loading}
        />
      </View>

      <TouchableOpacity
        style={[styles.sendButton, !message.trim() && styles.disabledButton]}
        onPress={handleSend}
        disabled={loading || !message.trim()}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.sendButtonText}>{t('interactions.send')}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  contentContainer: {
    padding: 16,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  messageInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#9e9e9e',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
