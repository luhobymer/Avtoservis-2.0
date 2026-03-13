import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

// Функція для оптимізації розміру зображення
export const optimizeImage = async (uri, options = {}) => {
  return uri;
};

// Backward compatible wrapper used by some screens
export const compressImage = async (uri, quality = 0.8) => {
  return optimizeImage(uri, { quality, forceOptimize: true });
};

const defaultPickerOptions = {
  mediaType: 'photo',
  quality: 0.8,
  includeBase64: false,
  selectionLimit: 1,
};

// Функція для вибору зображення з галереї
export const pickImage = async (options = {}) => {
  const result = await launchImageLibrary({ ...defaultPickerOptions, ...options });

  if (result.didCancel) {
    return { canceled: true };
  }

  if (result.errorCode) {
    console.error('[ImageUtils] launchImageLibrary error:', result.errorCode, result.errorMessage);
    throw new Error(result.errorMessage || 'Image picker error');
  }

  const asset = Array.isArray(result.assets) && result.assets.length > 0 ? result.assets[0] : null;
  if (!asset || !asset.uri) {
    return { canceled: true };
  }

  return {
    canceled: false,
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName,
    type: asset.type,
  };
};

// Функція для зйомки фото камерою
export const takePhoto = async (options = {}) => {
  const result = await launchCamera({ ...defaultPickerOptions, ...options });

  if (result.didCancel) {
    return { canceled: true };
  }

  if (result.errorCode) {
    console.error('[ImageUtils] launchCamera error:', result.errorCode, result.errorMessage);
    throw new Error(result.errorMessage || 'Camera error');
  }

  const asset = Array.isArray(result.assets) && result.assets.length > 0 ? result.assets[0] : null;
  if (!asset || !asset.uri) {
    return { canceled: true };
  }

  return {
    canceled: false,
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName,
    type: asset.type,
  };
};

// Функція для створення FormData з зображенням
export const createImageFormData = (uri, fieldName = 'photo') => {
  const formData = new FormData();
  const filename = uri.split('/').pop();
  const match = /\.([\w\d]+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append(fieldName, {
    uri,
    name: filename,
    type
  });

  return formData;
};

// Функція для перевірки дозволів на доступ до галереї
export const checkGalleryPermissions = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }
  const permission =
    Platform.Version >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  const status = await PermissionsAndroid.request(permission);
  return status === PermissionsAndroid.RESULTS.GRANTED;
};

// Функція для перевірки дозволів на доступ до камери
export const checkCameraPermissions = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }
  const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return status === PermissionsAndroid.RESULTS.GRANTED;
};
