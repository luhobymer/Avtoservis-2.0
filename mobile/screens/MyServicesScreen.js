import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, Switch, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axiosAuth from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import CustomButton from '../components/CustomButton';

export default function MyServicesScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mechanic, setMechanic] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    categoryId: '',
    enabled: true
  });
  const [categoryMode, setCategoryMode] = useState('select');
  const [customCategory, setCustomCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const isMaster = ['master', 'mechanic', 'admin'].includes(String(user?.role || '').toLowerCase());

  const loadMechanicAndServices = async () => {
    try {
      setLoading(true);
      const mechanicRes = await axiosAuth.get('/api/mechanics/me');
      const mechanicData = mechanicRes.data;
      
      if (!mechanicData?.id) {
        setMechanic(null);
        setServices([]);
        return;
      }
      setMechanic(mechanicData);

      const [listRes, categoriesRes] = await Promise.all([
        axiosAuth.get(`/api/mechanics/${mechanicData.id}/services`),
        axiosAuth.get('/api/service-categories'),
      ]);
      const rows = Array.isArray(listRes.data) ? listRes.data : Array.isArray(listRes.data?.data) ? listRes.data.data : [];
      const categoryRows = Array.isArray(categoriesRes.data)
        ? categoriesRes.data
        : Array.isArray(categoriesRes.data?.data)
          ? categoriesRes.data.data
          : [];
      setServices(rows);
      setCategories(categoryRows);
    } catch (error) {
      console.error('[MyServicesScreen] Failed to load mechanic services:', error);
      Alert.alert(t('common.error'), t('common.data_load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isMaster) {
      setLoading(false);
      return;
    }
    loadMechanicAndServices();
  }, [isMaster]);

  const resolveLocalizedText = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value !== 'object') return null;
    const locale = String(i18n.language || '').toLowerCase();
    const base = locale.split('-')[0];
    const keys = [locale, base];
    if (base === 'uk') keys.push('ua');
    if (base === 'ua') keys.push('uk');
    if (base === 'ru') keys.push('ru');
    if (base === 'en') keys.push('en');
    for (const key of keys) {
      const val = value[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    const first = Object.values(value).find(v => typeof v === 'string' && v.trim());
    return typeof first === 'string' ? first.trim() : null;
  };

  const isLikelyId = (value) => {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^[0-9a-f]{24}$/i.test(trimmed)) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  };

  const getServiceCategoryId = (service) => {
    const raw = service?.category_id ?? service?.categoryId ?? service?.category?.id ?? service?.category;
    return raw != null ? String(raw) : '';
  };

  const getServiceCategoryName = (service) => {
    const rawName =
      service?.category_name ??
      service?.categoryName ??
      service?.categoryTitle ??
      service?.category?.name ??
      service?.category?.title;
    return resolveLocalizedText(rawName) || '';
  };

  const categoryMap = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((c) => {
      const id = c?.id != null ? String(c.id) : '';
      const name = c?.name ? String(c.name).trim() : '';
      if (id && name) {
        map.set(id, name);
      }
    });
    return map;
  }, [categories]);

  const categoryOptions = useMemo(() => {
    const list = Array.from(categoryMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [categoryMap]);

  const resolveCategoryTitle = (service) => {
    const name = getServiceCategoryName(service);
    if (name) return name;
    const categoryId = getServiceCategoryId(service);
    if (categoryId && categoryMap.has(categoryId)) {
      return categoryMap.get(categoryId);
    }
    const raw = service?.category ?? service?.category_name ?? service?.categoryTitle ?? service?.categoryName;
    const direct = resolveLocalizedText(raw);
    if (direct && !isLikelyId(direct)) return direct;
    return t('services.other', 'Інше');
  };

  const handleEdit = (service) => {
    const categoryId = getServiceCategoryId(service);
    const categoryName = getServiceCategoryName(service) || (categoryId && categoryMap.get(categoryId)) || '';
    const hasKnownCategory = categoryId && categoryMap.has(categoryId);
    const useCustom = !hasKnownCategory && !!categoryName;
    setCategoryMode(useCustom ? 'custom' : 'select');
    setCustomCategory(useCustom ? categoryName : '');
    setEditingService(service);
    setForm({
      name: service.name || '',
      description: service.description || '',
      price: service.price ? String(service.price) : '',
      duration: service.duration ? String(service.duration) : '',
      categoryId: useCustom ? '' : hasKnownCategory ? categoryId : '',
      enabled: service.enabled !== 0 && service.enabled !== false
    });
    setModalVisible(true);
  };

  const handleAdd = () => {
    setCategoryMode('select');
    setCustomCategory('');
    setEditingService(null);
    setForm({
      name: '',
      description: '',
      price: '',
      duration: '',
      categoryId: '',
      enabled: true
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.duration) {
      Alert.alert(t('common.error'), t('validation.please_fill_all_fields'));
      return;
    }

    setSaving(true);
    try {
      let categoryId = form.categoryId;
      if (categoryMode === 'custom') {
        const name = customCategory.trim();
        if (name) {
          const existing = categoryOptions.find(
            (c) => c.name.toLowerCase() === name.toLowerCase()
          );
          if (existing) {
            categoryId = existing.id;
          } else {
            const createdRes = await axiosAuth.post('/api/service-categories', { name });
            const created = createdRes?.data;
            if (created?.id && created?.name) {
              setCategories((prev) => {
                const next = Array.isArray(prev) ? [...prev] : [];
                next.push(created);
                return next;
              });
              categoryId = String(created.id);
            }
          }
        } else {
          categoryId = '';
        }
      }

      const payload = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        duration: parseInt(form.duration, 10),
        category_id: categoryId || null,
        enabled: form.enabled ? 1 : 0,
        mechanic_id: mechanic.id
      };

      if (editingService) {
        await axiosAuth.put(`/api/services/${editingService.id}`, payload);
      } else {
        await axiosAuth.post('/api/services', payload);
      }

      setModalVisible(false);
      loadMechanicAndServices();
    } catch (error) {
      console.error('Save service error:', error);
      Alert.alert(t('common.error'), t('common.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (service) => {
    try {
      const newStatus = service.enabled ? 0 : 1;
      await axiosAuth.put(`/api/services/${service.id}`, {
        ...service,
        enabled: newStatus
      });
      // Optimistic update
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, enabled: newStatus } : s));
    } catch (error) {
      Alert.alert(t('common.error'), t('common.save_error'));
    }
  };

  const groupServicesByCategory = () => {
    const groups = {};
    services.forEach(service => {
      const cat = resolveCategoryTitle(service);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(service);
    });
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .map(key => ({
        title: key,
        data: groups[key]
      }));
  };

  const renderServiceItem = ({ item }) => {
    const isEnabled = item.enabled !== 0 && item.enabled !== false;
    
    return (
      <TouchableOpacity style={[styles.item, !isEnabled && styles.disabledItem]} onPress={() => handleEdit(item)}>
        <View style={styles.iconContainer}>
          <Ionicons name="build-outline" size={24} color={isEnabled ? "#1976d2" : "#ccc"} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, !isEnabled && styles.disabledText]}>{item.name || t('services.unnamed', 'Послуга без назви')}</Text>
          {!!item.description && <Text style={styles.description} numberOfLines={1}>{item.description}</Text>}
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{item.price} грн</Text>
            <Text style={styles.meta}>{item.duration} {t('common.minutes', 'хв')}</Text>
          </View>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={() => handleToggleStatus(item)}
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={isEnabled ? "#1976d2" : "#f4f3f4"}
        />
      </TouchableOpacity>
    );
  };

  if (!isMaster) return <View style={styles.center}><Text>{t('services.only_for_masters', 'Розділ доступний лише для майстрів')}</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1976d2" /></View>;
  if (!mechanic) return <View style={styles.center}><Text>{t('errors.mechanicProfileNotFound')}</Text></View>;

  const sections = groupServicesByCategory();

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderServiceItem}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.message}>{t('services.no_services', 'Послуг немає')}</Text>
          </View>
        }
      />
      
      <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingService ? t('services.edit', 'Редагувати послугу') : t('services.add', 'Додати послугу')}
            </Text>
            
            <ScrollView>
              <Text style={styles.label}>{t('common.name')}</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={t => setForm(prev => ({ ...prev, name: t }))}
                placeholder={t('common.name')}
              />

              <Text style={styles.label}>{t('common.category', 'Категорія')}</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={categoryMode === 'custom' ? '__custom__' : form.categoryId}
                  onValueChange={(value) => {
                    if (value === '__custom__') {
                      setCategoryMode('custom');
                      setForm(prev => ({ ...prev, categoryId: '' }));
                      return;
                    }
                    setCategoryMode('select');
                    setCustomCategory('');
                    setForm(prev => ({ ...prev, categoryId: value }));
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label={t('services.select_category', 'Оберіть категорію')} value="" />
                  {categoryOptions.map((option) => (
                    <Picker.Item key={option.id} label={option.name} value={option.id} />
                  ))}
                  <Picker.Item label={t('services.add_category', 'Додати нову категорію')} value="__custom__" />
                </Picker>
              </View>
              {categoryMode === 'custom' && (
                <TextInput
                  style={styles.input}
                  value={customCategory}
                  onChangeText={(value) => setCustomCategory(value)}
                  placeholder={t('services.new_category_placeholder', 'Введіть нову категорію')}
                />
              )}

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>{t('common.price', 'Ціна (грн)')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.price}
                    onChangeText={t => setForm(prev => ({ ...prev, price: t }))}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>{t('common.duration', 'Тривалість (хв)')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.duration}
                    onChangeText={t => setForm(prev => ({ ...prev, duration: t }))}
                    keyboardType="numeric"
                    placeholder="60"
                  />
                </View>
              </View>

              <Text style={styles.label}>{t('common.description', 'Опис')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={t => setForm(prev => ({ ...prev, description: t }))}
                multiline
                numberOfLines={3}
                placeholder={t('common.description')}
              />

              <View style={styles.switchRow}>
                <Text style={styles.label}>{t('common.active', 'Активна')}</Text>
                <Switch
                  value={form.enabled}
                  onValueChange={v => setForm(prev => ({ ...prev, enabled: v }))}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <CustomButton
                title={t('common.cancel')}
                onPress={() => setModalVisible(false)}
                type="secondary"
                style={styles.modalButton}
              />
              <CustomButton
                title={t('common.save')}
                onPress={handleSave}
                loading={saving}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  list: { paddingBottom: 80 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: '#f5f5f7',
    padding: 16,
    color: '#333'
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2
  },
  disabledItem: { opacity: 0.6 },
  iconContainer: { marginRight: 16 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#212121' },
  disabledText: { textDecorationLine: 'line-through', color: '#757575' },
  description: { fontSize: 14, color: '#757575', marginTop: 4 },
  metaRow: { flexDirection: 'row', marginTop: 4, gap: 16 },
  meta: { fontSize: 14, color: '#1976d2', fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  message: { fontSize: 16, color: '#666', marginTop: 16 },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%'
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
  label: { fontSize: 14, color: '#666', marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: '#f5f5f7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333'
  },
  pickerContainer: { backgroundColor: '#f5f5f7', borderRadius: 8 },
  picker: { color: '#333' },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalButton: { flex: 1 }
});
