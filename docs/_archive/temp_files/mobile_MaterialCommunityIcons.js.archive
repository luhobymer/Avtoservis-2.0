// Заглушка для Material Community Icons
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Створюємо заглушку для вирішення проблем з іконками
const MaterialDesignIcons = {
  ...MaterialCommunityIcons,
  hasIcon: () => true,
  getImageSource: () => Promise.resolve({ uri: '' }),
  getImageSourceSync: () => ({ uri: '' }),
  loadFont: () => Promise.resolve(),
  getFontFamily: () => '',
  getRawGlyphMap: () => ({}),
  default: MaterialCommunityIcons
};

export default MaterialDesignIcons;
