import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axiosAuth from '../api/axiosConfig';
import * as usersDao from '../api/dao/usersDao';
import { useAuth } from '../context/AuthContext';
import { getPhoneContacts } from '../utils/contactsUtils';

export default function MyClientsScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchText, setSearchText] = useState('');

  const isMaster = String(user?.role || '').toLowerCase() === 'master';

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await axiosAuth.get('/api/relationships/clients');
      const rows = Array.isArray(response.data) ? response.data : [];
      setClients(rows);
    } catch (error) {
      console.error('[MyClientsScreen] Failed to load clients:', error);
      Alert.alert(t('common.error'), t('common.data_load_error'));
    } finally {
      setLoading(false);
    }
  };

  const normalizePhone = (phone) => {
    let normalizedPhone = String(phone || '').trim().replace(/[^\d+]/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = `+380${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.startsWith('380')) {
      normalizedPhone = `+${normalizedPhone}`;
    }
    return normalizedPhone;
  };

  const handleCreateClient = async () => {
    const firstName = String(form.firstName || '').trim();
    const lastName = String(form.lastName || '').trim();
    let phoneInput = String(form.phone || '').trim();
    
    // Очищаємо номер від зайвих символів (пробіли, дужки, дефіси) перед валідацією
    const cleanedPhone = phoneInput.replace(/[^\d+]/g, '');

    if (!firstName || !lastName || !cleanedPhone) {
      Alert.alert(t('common.error'), t('validation.please_fill_all_fields'));
      return;
    }
    const phoneRegex = /^(\+?380|0)\d{9}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      Alert.alert(t('common.error'), t('validation.invalid_phone'));
      return;
    }

    const normalizedPhone = normalizePhone(cleanedPhone);
    setSaving(true);
    try {
      const created = await usersDao.createUser({
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        phone: normalizedPhone,
        password: '12345678',
        role: 'client',
      });
      if (created?.id) {
        try {
          await axiosAuth.post('/api/relationships/clients', { client_id: created.id });
        } catch (e) {}

        const newRow = {
          id: created.id,
          client_id: created.id,
          name: created.name,
          email: created.email,
          phone: created.phone,
          status: 'accepted',
        };
        setClients(prev => [newRow, ...prev]);
        setForm({ firstName: '', lastName: '', phone: '' });
        setAddModalVisible(false);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || t('common.error', 'Помилка');
      Alert.alert(t('common.error'), message);
    } finally {
      setSaving(false);
    }
  };

  const openContacts = async () => {
    try {
      const list = await getPhoneContacts();
      setContacts(list);
      setFilteredContacts(list);
      setSearchText('');
      if (list.length) {
        setContactsModalVisible(true);
      } else {
        Alert.alert(t('common.info'), t('contacts.no_contacts', 'Не знайдено контактів з телефонами'));
      }
    } catch (e) {
      console.error('[MyClientsScreen] Failed to load contacts:', e);
      Alert.alert(t('common.error'), t('contacts.load_error', 'Не вдалося завантажити контакти'));
    }
  };

  const handleSearchContacts = (text) => {
    setSearchText(text);
    if (!text.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    const lower = text.toLowerCase();
    const filtered = contacts.filter(c => 
      (c.name || '').toLowerCase().includes(lower) || 
      (c.phone || '').includes(lower)
    );
    setFilteredContacts(filtered);
  };

  const handleSelectContact = (contact) => {
    if (!contact) return;
    const parts = String(contact.name || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ');
    setForm({
      firstName,
      lastName,
      phone: contact.phone || '',
    });
    setContactsModalVisible(false);
  };

  useEffect(() => {
    if (!isMaster) {
      setLoading(false);
      return;
    }
    fetchClients();
  }, [isMaster]);

  const openChatWithClient = (client) => {
    if (!client?.client_id) return;
    navigation.navigate('ChatScreen', {
      recipientId: client.client_id,
      recipientName: client.name || client.email || t('auth.roleClient'),
      recipientRole: 'client',
    });
  };

  const renderClientItem = ({ item }) => {
    const status = String(item.status || '').toLowerCase();
    let statusLabel = status;
    if (status === 'pending') statusLabel = t('common.pending', 'Очікує підтвердження');
    if (status === 'accepted') statusLabel = t('common.active', 'Активний клієнт');
    if (status === 'rejected') statusLabel = t('common.rejected', 'Відхилено');

    return (
      <TouchableOpacity style={styles.item} onPress={() => openChatWithClient(item)}>
        <View style={styles.avatar}>
          <Ionicons name="person-circle-outline" size={32} color="#1976d2" />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name || item.email || t('auth.roleClient')}</Text>
          {!!item.email && <Text style={styles.secondary}>{item.email}</Text>}
          {!!item.phone && <Text style={styles.secondary}>{item.phone}</Text>}
          <Text style={styles.status}>{statusLabel}</Text>
        </View>
        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#1976d2" />
      </TouchableOpacity>
    );
  };

  if (!isMaster) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('errors.mechanicProfileNotFound', 'Цей розділ доступний лише для майстрів')}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {clients.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
          <Text style={styles.message}>
            {t('relationships.no_clients', 'Немає підключених клієнтів')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={clients}
          renderItem={renderClientItem}
          keyExtractor={(item) => String(item.id || `${item.client_id}-${item.mechanic_id}`)}
          contentContainerStyle={styles.list}
        />
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setAddModalVisible(true)}
      >
        <Ionicons name="person-add-outline" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('clients.add', 'Додати клієнта')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('common.name_placeholder', 'Введіть імʼя')}
              value={form.firstName}
              onChangeText={value => setForm(prev => ({ ...prev, firstName: value }))}
            />
            <Text style={styles.hintText}>{t('common.name_hint', 'Наприклад: Іван')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('common.lastname_placeholder', 'Введіть прізвище')}
              value={form.lastName}
              onChangeText={value => setForm(prev => ({ ...prev, lastName: value }))}
            />
            <Text style={styles.hintText}>{t('common.lastname_hint', 'Наприклад: Петренко')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('common.phone_placeholder', 'Наприклад: 0501234567')}
              value={form.phone}
              onChangeText={value => setForm(prev => ({ ...prev, phone: value }))}
              keyboardType="phone-pad"
            />
            <Text style={styles.hintText}>{t('common.phone_hint', 'Формат: 0XXXXXXXXX або +380XXXXXXXXX')}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setAddModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Скасувати')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSecondary]}
                onPress={openContacts}
                disabled={saving}
              >
                <Text style={styles.modalSecondaryText}>{t('contacts.from_phone', 'З контактів')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirm]}
                onPress={handleCreateClient}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('common.save', 'Зберегти')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={contactsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setContactsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.contactsModalContent}>
            <Text style={styles.modalTitle}>{t('contacts.select_owner', 'Оберіть контакт')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('common.search', 'Пошук...')}
              value={searchText}
              onChangeText={handleSearchContacts}
            />
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleSelectContact(item)}
                >
                  <Text style={styles.contactName}>{item.name}</Text>
                  <Text style={styles.contactPhone}>{item.phone}</Text>
                </TouchableOpacity>
              )}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setContactsModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Скасувати')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  list: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
  },
  avatar: {
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  secondary: {
    fontSize: 14,
    color: '#757575',
  },
  status: {
    marginTop: 4,
    fontSize: 13,
    color: '#1976d2',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  modalInput: {
    backgroundColor: '#f5f5f7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#000',
  },
  hintText: {
    width: '100%',
    fontSize: 12,
    color: '#888',
    marginTop: -6,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalCancel: {
    backgroundColor: '#e0e0e0',
  },
  modalConfirm: {
    backgroundColor: '#1976d2',
  },
  modalCancelText: {
    color: '#333',
    fontSize: 14,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 14,
  },
  modalSecondary: {
    backgroundColor: '#f0f0f0',
  },
  modalSecondaryText: {
    color: '#1976d2',
    fontSize: 14,
  },
  contactsModalContent: {
    width: '100%',
    maxHeight: 500,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  contactItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  contactName: {
    fontSize: 16,
    color: '#111',
  },
  contactPhone: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
});
