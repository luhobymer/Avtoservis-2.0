import { PermissionsAndroid, Platform } from 'react-native';
import Contacts from 'react-native-contacts';

export const requestContactsPermission = async () => {
  try {
    if (Contacts.checkPermission) {
      const status = await Contacts.checkPermission();
      if (status === 'authorized') return true;
      if (Contacts.requestPermission) {
        const requested = await Contacts.requestPermission();
        return requested === 'authorized';
      }
    }
  } catch (_) {}
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
  let contacts = [];
  try {
    if (Contacts.getAllWithoutPhotos) {
      contacts = await Contacts.getAllWithoutPhotos();
    } else {
      contacts = await Contacts.getAll();
    }
  } catch (_) {
    try {
      contacts = await Contacts.getAll();
    } catch (_) {
      return [];
    }
  }
  const withPhones = contacts
    .map((c) => {
      const phoneNumbers = Array.isArray(c.phoneNumbers) ? c.phoneNumbers : [];
      const rawNumber = phoneNumbers
        .map((p) => p?.number)
        .find((num) => {
          const cleaned = String(num || '').replace(/[^\d+]/g, '');
          return cleaned.length > 0;
        });
      const cleanedNumber = rawNumber ? String(rawNumber).replace(/[^\d+]/g, '') : null;
      return {
        id: c.recordID,
        name: c.displayName || [c.givenName, c.familyName].filter(Boolean).join(' '),
        phone: cleanedNumber,
      };
    })
    .filter((c) => c.phone);
  return withPhones;
};

