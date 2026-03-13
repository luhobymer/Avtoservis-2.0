import { PermissionsAndroid, Platform } from 'react-native';
import Contacts from 'react-native-contacts';

export const requestContactsPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    {
      title: 'Доступ до контактів',
      message: 'Додатку потрібен доступ до контактів, щоб обрати клієнта з телефонної книги.',
      buttonPositive: 'OK',
    }
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

export const getPhoneContacts = async () => {
  const hasPermission = await requestContactsPermission();
  if (!hasPermission) return [];
  const contacts = await Contacts.getAll();
  const withPhones = contacts
    .map((c) => {
      const phoneNumber =
        Array.isArray(c.phoneNumbers) && c.phoneNumbers.length
          ? c.phoneNumbers[0].number
          : null;
      return {
        id: c.recordID,
        name: c.displayName || [c.givenName, c.familyName].filter(Boolean).join(' '),
        phone: phoneNumber,
      };
    })
    .filter((c) => c.phone);
  return withPhones;
};

