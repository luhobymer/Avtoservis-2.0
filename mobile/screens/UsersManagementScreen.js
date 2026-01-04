import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import * as usersDao from '../api/dao/usersDao';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '../components/CustomButton';

export default function UsersManagementScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    try {
      const list = await usersDao.listAll();
      setUsers(list);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      Alert.alert(t('common.error'), t('admin.users.fetch_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUsers();
    });

    return unsubscribe;
  }, [navigation]);

  const handleUserStatusChange = async (userId, newStatus) => {
    try {
      await usersDao.updateStatus(userId, newStatus);
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user status:', error);
      Alert.alert(t('common.error'), t('admin.users.update_error'));
    }
  };

  const handleUserRoleChange = async (userId, newRole) => {
    try {
      await usersDao.updateRole(userId, newRole);
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user role:', error);
      Alert.alert(t('common.error'), t('admin.users.update_error'));
    }
  };

  const renderUserItem = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={[styles.userStatus, { backgroundColor: item.status === 'active' ? '#4caf50' : '#f44336' }]}>
          <Text style={styles.userStatusText}>
            {item.status === 'active' ? t('admin.users.active') : t('admin.users.inactive')}
          </Text>
        </View>
      </View>

      <View style={styles.userRole}>
        <Ionicons name="person-outline" size={16} color="#666" />
        <Text style={styles.userRoleText}>{t(`admin.users.roles.${item.role}`)}</Text>
      </View>

      <View style={styles.actionButtons}>
        <CustomButton
          title={item.status === 'active' ? t('admin.users.deactivate') : t('admin.users.activate')}
          onPress={() => handleUserStatusChange(item.id, item.status === 'active' ? 'inactive' : 'active')}
          style={[styles.actionButton, { backgroundColor: item.status === 'active' ? '#f44336' : '#4caf50' }]}
        />
        <CustomButton
          title={t('admin.users.change_role')}
          onPress={() => {
            Alert.alert(
              t('admin.users.change_role'),
              t('admin.users.change_role_confirm'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('admin.users.role_master'),
                  onPress: () => handleUserRoleChange(item.id, 'master')
                },
                {
                  text: t('admin.users.role_client'),
                  onPress: () => handleUserRoleChange(item.id, 'client')
                }
              ]
            );
          }}
          style={styles.actionButton}
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('admin.users.management')}</Text>
        <CustomButton
          title={t('admin.users.add_user')}
          onPress={() => navigation.navigate('AddUser')}
          style={styles.addButton}
        />
      </View>

      <FlatList
        data={users}
        renderItem={renderUserItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchUsers();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    paddingHorizontal: 16,
  },
  list: {
    padding: 16,
  },
  userCard: {
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
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  userStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  userStatusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  userRole: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userRoleText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});
