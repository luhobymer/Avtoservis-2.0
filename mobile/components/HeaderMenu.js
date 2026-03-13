import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useLocalization } from './TranslationProvider';

export default function HeaderMenu() {
  const [visible, setVisible] = useState(false);
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { setLanguage } = useLocalization();

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const role = String(user?.role || 'client').toLowerCase();
  const isMaster = role === 'master';

  const goHome = () => {
    navigation.navigate('Main', {
      screen: isMaster ? 'MasterDashboard' : 'Dashboard',
    });
  };

  const goVehicles = () => {
    navigation.navigate('Main', { screen: 'Vehicles' });
  };

  const goAppointments = () => {
    navigation.navigate('Main', { screen: 'Appointments' });
  };

  const goClients = () => {
    navigation.navigate('MyClients');
  };

  const goMechanics = () => {
    navigation.navigate('MyMechanics');
  };

  const goServices = () => {
    navigation.navigate('MyServices');
  };

  const goChats = () => {
    navigation.navigate('Interactions');
  };

  const goParts = () => {
    navigation.navigate('MyParts');
  };

  const goProfile = () => {
    navigation.navigate('Main', { screen: 'Profile' });
  };

  const goNotifications = () => {
    navigation.navigate('Notifications');
  };

  const handleLogout = async () => {
    await logout();
  };

  const items = isMaster
    ? [
        { key: 'home', title: 'Головна', icon: 'view-dashboard', action: goHome },
        { key: 'vehicles', title: 'Мої автомобілі', icon: 'car', action: goVehicles },
        { key: 'appointments', title: 'Мої записи', icon: 'calendar', action: goAppointments },
        { key: 'clients', title: 'Мої Клієнти', icon: 'account-multiple', action: goClients },
        { key: 'services', title: 'Мої послуги', icon: 'file-document-edit', action: goServices },
        { key: 'chats', title: 'Мої чати', icon: 'chat', action: goChats },
        { key: 'parts', title: 'Мої запчастини', icon: 'wrench', action: goParts },
        { key: 'reminders', title: 'Нагадування', icon: 'timer', action: goNotifications },
        { key: 'profile', title: 'Профіль', icon: 'account', action: goProfile },
        { key: 'logout', title: 'Вийти', icon: 'logout', action: handleLogout },
      ]
    : [
        { key: 'home', title: 'Головна', icon: 'view-dashboard', action: goHome },
        { key: 'vehicles', title: 'Мої автомобілі', icon: 'car', action: goVehicles },
        {
          key: 'appointments',
          title: 'Записи на обслуговування',
          icon: 'calendar',
          action: goAppointments,
        },
        { key: 'mechanics', title: 'Мої майстри', icon: 'account-wrench', action: goMechanics },
        { key: 'chats', title: 'Мої чати', icon: 'chat', action: goChats },
        { key: 'parts', title: 'Мої запчастини', icon: 'wrench', action: goParts },
        { key: 'reminders', title: 'Нагадування', icon: 'timer', action: goNotifications },
        { key: 'profile', title: 'Профіль', icon: 'account', action: goProfile },
        { key: 'logout', title: 'Вийти', icon: 'logout', action: handleLogout },
      ];

  return (
    <View style={styles.container}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={
          <IconButton
            icon="menu"
            size={24}
            onPress={openMenu}
            iconColor="#000000"
          />
        }
        contentStyle={styles.menuContent}
        anchorPosition="top"
      >
        {items.map((item) => (
          <Menu.Item
            key={item.key}
            onPress={() => {
              closeMenu();
              item.action();
            }}
            title={item.title}
            leadingIcon={item.icon}
            titleStyle={styles.menuItemTitle}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingLeft: 8,
  },
  menuContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    minWidth: 260,
  },
  menuItemTitle: {
    fontSize: 15,
    color: '#212121',
    fontWeight: '500',
  },
});
