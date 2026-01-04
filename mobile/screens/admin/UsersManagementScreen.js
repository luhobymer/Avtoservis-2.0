import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as usersDao from '../../api/dao/usersDao';

export default function UsersManagementScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sortOption, setSortOption] = useState('name_asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(h);
  }, [searchQuery]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const list = await usersDao.listAll();
      setUsers(list);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      Alert.alert(t('common.error'), t('admin.users.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  

  const handleUserPress = (user) => {
    navigation.navigate('UserDetails', { userId: user.id });
  };

  const handleToggleStatus = async (user) => {
    const next = user.status === 'active' ? 'inactive' : 'active';
    const title = t('admin.users.toggle_status_title');
    const message = next === 'inactive' ? t('admin.users.toggle_status_confirm_deactivate') : t('admin.users.toggle_status_confirm_activate');
    Alert.alert(
      title,
      message,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: async () => {
            try {
              setUpdating(true);
              await usersDao.updateStatus(user.id, next);
              await fetchUsers();
            } catch (error) {
              console.error('Failed to update user status:', error);
              Alert.alert(t('common.error'), t('admin.users.update_error'));
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleChangeRole = async (user) => {
    Alert.alert(
      t('admin.users.change_role'),
      t('admin.users.change_role_confirm'),
      [
        { text: t('admin.users.roles.admin'), onPress: async () => { try { setUpdating(true); await usersDao.updateRole(user.id, 'admin'); await fetchUsers(); } catch (e) { console.error(e); Alert.alert(t('common.error'), t('admin.users.update_error')); } finally { setUpdating(false); } } },
        { text: t('admin.users.roles.master'), onPress: async () => { try { setUpdating(true); await usersDao.updateRole(user.id, 'master'); await fetchUsers(); } catch (e) { console.error(e); Alert.alert(t('common.error'), t('admin.users.update_error')); } finally { setUpdating(false); } } },
        { text: t('admin.users.roles.master_admin') || 'Майстер+адміністратор', onPress: async () => { try { setUpdating(true); await usersDao.updateRole(user.id, 'master_admin'); await fetchUsers(); } catch (e) { console.error(e); Alert.alert(t('common.error'), t('admin.users.update_error')); } finally { setUpdating(false); } } },
        { text: t('admin.users.roles.client'), onPress: async () => { try { setUpdating(true); await usersDao.updateRole(user.id, 'client'); await fetchUsers(); } catch (e) { console.error(e); Alert.alert(t('common.error'), t('admin.users.update_error')); } finally { setUpdating(false); } } },
        { text: t('common.cancel'), style: 'cancel' }
      ]
    );
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserPress(item)}
    >
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Ionicons name="person-circle-outline" size={24} color="#1976d2" />
          <Text style={styles.userName}>{item.name}</Text>
        </View>
        
        <Text style={styles.userEmail}>{item.email}</Text>
        <View style={styles.userDetails}>
          <Text style={styles.userRole}>
            {t(`admin.users.roles.${item.role}`)}
          </Text>
          <Text style={[styles.userStatus, { color: (item.status === 'active') ? '#4caf50' : '#f44336' }]}>
            {item.status === 'active' ? t('admin.users.active') : t('admin.users.inactive')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginLeft: 36, marginTop: 8 }}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4caf50', opacity: updating ? 0.6 : 1 }]} disabled={updating} onPress={() => handleToggleStatus(item)}>
            <Text style={styles.actionText}>{item.status === 'active' ? t('admin.users.deactivate') : t('admin.users.activate')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1976d2', opacity: updating ? 0.6 : 1 }]} disabled={updating} onPress={() => handleChangeRole(item)}>
            <Text style={styles.actionText}>{t('admin.users.change_role')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  const filteredUsers = users.filter(u => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  const statusFiltered = filteredUsers.filter(u => {
    if (statusFilter === 'all') return true;
    return (u.status || '') === statusFilter;
  });

  const roleFiltered = statusFiltered.filter(u => {
    if (roleFilter === 'all') return true;
    return (u.role || '') === roleFilter;
  });

  const sortedUsers = [...roleFiltered].sort((a, b) => {
    switch (sortOption) {
      case 'name_asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name_desc':
        return (b.name || '').localeCompare(a.name || '');
      case 'role_asc':
        return (a.role || '').localeCompare(b.role || '');
      case 'role_desc':
        return (b.role || '').localeCompare(a.role || '');
      case 'status_active_first':
        return (b.status === 'active') - (a.status === 'active');
      case 'status_inactive_first':
        return (a.status === 'active') - (b.status === 'active');
      default:
        return 0;
    }
  });

  return (
    <View style={styles.container}>
      
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
        <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{t('common.sort')}</Text>
        <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
          <Picker selectedValue={sortOption} onValueChange={(v) => setSortOption(v)}>
            <Picker.Item label={t('admin.sort.name_asc')} value="name_asc" />
            <Picker.Item label={t('admin.sort.name_desc')} value="name_desc" />
            <Picker.Item label={t('admin.sort.role_asc')} value="role_asc" />
            <Picker.Item label={t('admin.sort.role_desc')} value="role_desc" />
            <Picker.Item label={t('admin.sort.status_active_first')} value="status_active_first" />
            <Picker.Item label={t('admin.sort.status_inactive_first')} value="status_inactive_first" />
          </Picker>
        </View>
        <TextInput
          style={{ backgroundColor: '#f5f5f7', borderRadius: 8, padding: 12, marginTop: 12, fontSize: 16 }}
          placeholder={t('common.search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{t('admin.filters.status')}</Text>
          <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
            <Picker selectedValue={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <Picker.Item label={t('admin.filters.all')} value="all" />
              <Picker.Item label={t('admin.users.active')} value="active" />
              <Picker.Item label={t('admin.users.inactive')} value="inactive" />
            </Picker>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{t('admin.filters.role')}</Text>
          <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
            <Picker selectedValue={roleFilter} onValueChange={(v) => setRoleFilter(v)}>
              <Picker.Item label={t('admin.filters.all')} value="all" />
              <Picker.Item label={t('admin.users.roles.admin')} value="admin" />
              <Picker.Item label={t('admin.users.roles.master')} value="master" />
              <Picker.Item label={t('admin.users.roles.master_admin') || 'Майстер+адміністратор'} value="master_admin" />
              <Picker.Item label={t('admin.users.roles.client')} value="client" />
            </Picker>
          </View>
        </View>
      </View>
      <FlatList
        data={sortedUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>{t('admin.users.no_users')}</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddUser')}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
  },
  userDetails: {
    flexDirection: 'row',
    marginLeft: 36,
    marginTop: 8,
  },
  userRole: {
    fontSize: 14,
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  userStatus: {
    fontSize: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  unsyncedTag: {
    marginLeft: 36,
    marginBottom: 6,
    fontSize: 12,
    color: '#ad8b00',
    backgroundColor: '#fffbe6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
});
