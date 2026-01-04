import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Максимальний розмір файлу в байтах (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Функція для оптимізації розміру зображення
export const optimizeImage = async (uri, options = {}) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    
    // Значення за замовчуванням
    const defaultOptions = {
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      format: SaveFormat.JPEG
    };
    
    // Об'єднуємо передані опції з опціями за замовчуванням
    const finalOptions = { ...defaultOptions, ...options };
    
    // Якщо розмір файлу менший за максимальний і не вказано примусове стиснення,
    // повертаємо оригінальний URI
    if (fileInfo.size <= MAX_FILE_SIZE && !options.forceOptimize) {
      // Якщо розмір в межах норми, але потрібно змінити розміри зображення
      if (options.maxWidth || options.maxHeight) {
        const result = await manipulateAsync(
          uri,
          [{ resize: { 
            width: finalOptions.maxWidth, 
            height: finalOptions.maxHeight 
          }}],
          { 
            compress: finalOptions.quality, 
            format: finalOptions.format 
          }
        );
        return result.uri;
      }
      return uri;
    }

    // Розрахунок коефіцієнту стиснення, якщо розмір перевищує максимальний
    let quality = finalOptions.quality;
    if (fileInfo.size > MAX_FILE_SIZE) {
      const compressionRatio = MAX_FILE_SIZE / fileInfo.size;
      quality = Math.max(0.1, Math.min(finalOptions.quality, compressionRatio));
    }

    // Виконуємо оптимізацію зображення
    const result = await manipulateAsync(
      uri,
      [{ resize: { 
        width: finalOptions.maxWidth, 
        height: finalOptions.maxHeight 
      }}],
      { 
        compress: quality, 
        format: finalOptions.format 
      }
    );

    console.log(`Зображення оптимізовано: ${fileInfo.size} -> ${(await FileSystem.getInfoAsync(result.uri)).size} байт`);
    return result.uri;
  } catch (error) {
    console.error('Error optimizing image:', error);
    // У випадку помилки повертаємо оригінальний URI
    return uri;
  }
};

// Backward compatible wrapper used by some screens
export const compressImage = async (uri, quality = 0.8) => {
  return optimizeImage(uri, { quality, forceOptimize: true });
};

// Функція для вибору зображення з галереї
export const pickImage = async (options = {}) => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      ...options
    });

    if (!result.canceled) {
      const optimizedUri = await optimizeImage(result.assets[0].uri);
      return { uri: optimizedUri, canceled: false };
    }

    return result;
  } catch (error) {
    console.error('Error picking image:', error);
    throw error;
  }
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
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
};

// Функція для перевірки дозволів на доступ до камери
export const checkCameraPermissions = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
};
