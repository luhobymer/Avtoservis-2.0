import { Platform } from 'react-native';
import { optimizeImage } from './imageUtils';
import * as FileSystem from 'expo-file-system';

// Перевіряємо, чи це мобільна платформа
const isMobile = Platform.OS !== 'web';

// Клас для роботи з OCR
export class OCRManager {
  constructor() {
    this.worker = null;
    this.useMock = false;
    this.initialized = false;
    this.tesseractLoaded = false;
    console.log(`OCRManager створено. Платформа: ${Platform.OS}`);
  }

  // Ініціалізація OCR системи
  async initialize() {
    if (this.worker !== null) {
      return; // Вже ініціалізовано
    }
    
    try {
      console.log('Initializing OCR system...');
      
      // В мобільній версії завжди використовуємо мок
      if (isMobile) {
        console.log('Mobile platform detected, using mock OCR');
        this.worker = this.createMockWorker();
        this.useMock = true;
        this.initialized = true;
        console.log('Mock OCR initialized successfully');
        return;
      }
      
      // Спробуємо ініціалізувати Tesseract тільки для веб-версії
      try {
        // Динамічно імпортуємо Tesseract.js
        const { createWorker } = await import('tesseract.js');
        
        // Створюємо worker з базовими опціями
        this.worker = await createWorker({
          lang: 'ukr+eng',
          logger: m => console.debug(m)
        });
        
        console.log('Tesseract worker initialized successfully');
        this.initialized = true;
        this.tesseractLoaded = true;
        this.useMock = false;
      } catch (error) {
        console.error('Failed to initialize Tesseract worker:', error);
        this.worker = this.createMockWorker();
        this.useMock = true;
        this.initialized = true;
      }
    } catch (error) {
      console.error('All initialization methods failed:', error);
      this.worker = this.createMockWorker();
      this.useMock = true;
      this.initialized = true;
    }
  }
  
  // Створення мокового воркера
  createMockWorker() {
    console.log('Creating mock OCR worker');
    return {
      recognize: async (imageUri) => {
        // Імітуємо затримку розпізнавання
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Перевіряємо, чи це зображення номерного знаку (за назвою файлу або шляхом)
        const isLicensePlate = imageUri.toLowerCase().includes('plate') || 
                              imageUri.toLowerCase().includes('номер') || 
                              imageUri.toLowerCase().includes('license');
        
        // Повертаємо різні мокові дані залежно від типу зображення
        if (isLicensePlate) {
          return { 
            data: { 
              text: "AA1234BB\nУкраїна" 
            } 
          };
        } else {
          return { 
            data: { 
              text: "СВІДОЦТВО ПРО РЕЄСТРАЦІЮ ТРАНСПОРТНОГО ЗАСОБУ\nVIN: ABC12345678901234\nМарка: Toyota\nМодель: Camry\nРік: 2020\nКолір: Чорний\nНомерний знак: AA1234BB" 
            } 
          };
        }
      },
      terminate: async () => {
        console.log('Mock worker terminated');
      }
    };
  }

  // Розпізнавання тексту з зображення
  async recognizeText(imageUri) {
    try {
      // Перевіряємо, чи ініціалізовано worker
      if (!this.worker) {
        await this.initialize();
      }
      
      // Перевіряємо, чи успішно ініціалізовано
      if (!this.initialized) {
        console.warn('УВАГА: OCR не ініціалізовано належним чином');
        throw new Error('OCR недоступний. Використовується заглушка.');
      }
      
      // Якщо використовується заглушка, попереджаємо про це
      if (this.useMock) {
        console.warn('УВАГА: Використовується заглушка для OCR. Реальне розпізнавання неможливе.');
      }
      
      // Оптимізуємо зображення перед розпізнаванням
      const optimizedImageUri = await optimizeImage(imageUri, {
        quality: 0.9,
        maxWidth: 1200,
        maxHeight: 1200
      });
      
      console.log('Розпізнавання тексту з оптимізованого зображення...');
      
      // Розпізнаємо текст
      const result = await this.worker.recognize(optimizedImageUri);
      
      // Перевіряємо результат
      if (!result || !result.data || !result.data.text) {
        console.warn('Розпізнавання тексту не повернуло результатів');
        return null;
      }
      
      const recognizedText = result.data.text;
      
      // Перевіряємо, чи текст не порожній
      if (!recognizedText || recognizedText.trim().length === 0) {
        console.warn('Розпізнаний текст порожній');
        return null;
      }
      
      console.log('Текст успішно розпізнано');
      return recognizedText;
    } catch (error) {
      console.error('Error recognizing text:', error);
      
      // Спробуємо ще раз з нижчою якістю, якщо помилка не критична
      try {
        if (this.worker && this.initialized) {
          console.log('Спроба розпізнавання з нижчою якістю...');
          
          // Оптимізуємо зображення з нижчою якістю
          const lowQualityImageUri = await optimizeImage(imageUri, {
            quality: 0.7,
            maxWidth: 800,
            maxHeight: 800
          });
          
          // Розпізнаємо текст
          const result = await this.worker.recognize(lowQualityImageUri);
          
          if (result && result.data && result.data.text) {
            console.log('Текст успішно розпізнано з нижчою якістю');
            return result.data.text;
          }
        }
      } catch (retryError) {
        console.error('Error during retry with lower quality:', retryError);
      }
      
      // Якщо все невдало і це мобільна платформа, повертаємо мокові дані
      if (isMobile) {
        console.log('Повертаємо мокові дані для мобільної платформи');
        
        // Перевіряємо, чи це зображення номерного знаку (за назвою файлу або шляхом)
        const isLicensePlate = imageUri.toLowerCase().includes('plate') || 
                              imageUri.toLowerCase().includes('номер') || 
                              imageUri.toLowerCase().includes('license');
        
        // Повертаємо різні мокові дані залежно від типу зображення
        if (isLicensePlate) {
          return "AA1234BB\nУкраїна";
        } else {
          return "СВІДОЦТВО ПРО РЕЄСТРАЦІЮ ТРАНСПОРТНОГО ЗАСОБУ\nVIN: ABC12345678901234\nМарка: Toyota\nМодель: Camry\nРік: 2020\nКолір: Чорний\nНомерний знак: AA1234BB";
        }
      }
      
      return null;
    }
  }

  // Розпізнавання документів транспортного засобу
  async recognizeVehicleDocument(imageUri) {
    try {
      // Розпізнаємо текст з зображення
      const text = await this.recognizeText(imageUri);
      
      // Перевіряємо, чи вдалося розпізнати текст
      if (!text || text.trim().length === 0) {
        console.warn('Не вдалося розпізнати текст з документа');
        return null;
      }
      
      console.log('Розпізнаний текст з документа:', text.substring(0, 100) + '...');
      
      // Ініціалізуємо об'єкт для даних автомобіля
      const vehicleData = {
        vin: null,
        licensePlate: null,
        make: null,
        model: null,
        year: null,
        color: null,
        // Додаткові поля, які можна розпізнати
        engineNumber: null,
        chassisNumber: null,
        registrationNumber: null,
        ownerName: null,
        registrationDate: null,
        // Прапорець, що вказує, чи дані розпізнані частково
        isPartialData: false
      };
      
      // Якщо використовується мок, позначаємо це
      if (this.useMock) {
        vehicleData.isMockData = true;
      }
      
      // Розпізнавання VIN-коду (17 символів, букви та цифри)
      const vinRegex = /[A-HJ-NPR-Z0-9]{17}/gi;
      const vinMatches = text.match(vinRegex);
      if (vinMatches && vinMatches.length > 0) {
        vehicleData.vin = vinMatches[0].toUpperCase();
        console.log('Розпізнано VIN:', vehicleData.vin);
      }
      
      // Розпізнавання номерного знаку (українські номери)
      // Формат: AA1234BB, AA 1234 BB, АА1234ВВ, АА 1234 ВВ
      const plateRegex = /[A-ZА-ЯІЇЄ]{2}[ ]?[0-9]{4}[ ]?[A-ZА-ЯІЇЄ]{2}/gi;
      const plateMatches = text.match(plateRegex);
      if (plateMatches && plateMatches.length > 0) {
        vehicleData.licensePlate = plateMatches[0].replace(/\s/g, '').toUpperCase();
        console.log('Розпізнано номерний знак:', vehicleData.licensePlate);
      }
      
      // Розпізнавання марки автомобіля
      // Список популярних марок
      const popularMakes = [
        'TOYOTA', 'HONDA', 'FORD', 'CHEVROLET', 'VOLKSWAGEN', 'BMW', 'MERCEDES', 'AUDI', 
        'HYUNDAI', 'KIA', 'NISSAN', 'MAZDA', 'SUBARU', 'LEXUS', 'MITSUBISHI', 'VOLVO', 
        'SKODA', 'RENAULT', 'PEUGEOT', 'CITROEN', 'FIAT', 'OPEL', 'SEAT', 'PORSCHE',
        'JEEP', 'LAND ROVER', 'JAGUAR', 'MINI', 'SUZUKI', 'DACIA', 'LADA', 'ВАЗ', 'ЗАЗ'
      ];
      
      for (const make of popularMakes) {
        if (text.toUpperCase().includes(make)) {
          vehicleData.make = make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
          console.log('Розпізнано марку:', vehicleData.make);
          break;
        }
      }
      
      // Розпізнавання моделі автомобіля
      // Це складніше, тому що моделі можуть мати різні назви
      // Спробуємо знайти модель після слова "модель" або "model"
      const modelRegex = /(?:модель|model)[:\s]+([A-Za-zА-Яа-яІіЇїЄєҐґ0-9\s\-]+)/i;
      const modelMatch = text.match(modelRegex);
      if (modelMatch && modelMatch[1]) {
        vehicleData.model = modelMatch[1].trim();
        console.log('Розпізнано модель:', vehicleData.model);
      }
      
      // Розпізнавання року випуску (4 цифри між 1900 і поточним роком)
      const currentYear = new Date().getFullYear();
      const yearRegex = /\b(19[5-9][0-9]|20[0-2][0-9])\b/g;
      const yearMatches = text.match(yearRegex);
      if (yearMatches && yearMatches.length > 0) {
        // Перевіряємо, що рік не більший за поточний
        const parsedYear = parseInt(yearMatches[0], 10);
        if (parsedYear <= currentYear) {
          vehicleData.year = parsedYear;
          console.log('Розпізнано рік:', vehicleData.year);
        }
      }
      
      // Розпізнавання кольору
      const colors = [
        'білий', 'чорний', 'червоний', 'синій', 'зелений', 'жовтий', 'сірий', 'коричневий',
        'срібний', 'золотий', 'бежевий', 'фіолетовий', 'помаранчевий', 'блакитний',
        'белый', 'черный', 'красный', 'синий', 'зеленый', 'желтый', 'серый', 'коричневый',
        'серебряный', 'золотой', 'бежевый', 'фиолетовый', 'оранжевый', 'голубой',
        'white', 'black', 'red', 'blue', 'green', 'yellow', 'gray', 'brown',
        'silver', 'gold', 'beige', 'purple', 'orange', 'light blue'
      ];
      
      for (const color of colors) {
        if (text.toLowerCase().includes(color.toLowerCase())) {
          vehicleData.color = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
          console.log('Розпізнано колір:', vehicleData.color);
          break;
        }
      }
      
      // Перевіряємо, чи розпізнано хоча б одне поле
      const hasAnyData = Object.keys(vehicleData).some(key => 
        key !== 'isPartialData' && key !== 'isMockData' && vehicleData[key] !== null
      );
      
      if (!hasAnyData) {
        console.warn('Не вдалося розпізнати жодних даних з документа');
        return null;
      }
      
      // Перевіряємо, чи дані розпізнані частково
      const requiredFields = ['vin', 'make', 'model', 'year'];
      const hasAllRequiredData = requiredFields.every(field => vehicleData[field] !== null);
      
      if (!hasAllRequiredData) {
        vehicleData.isPartialData = true;
        console.log('Розпізнано лише частину даних');
      }
      
      console.log('Результат розпізнавання документу:', vehicleData);
      return vehicleData;
    } catch (error) {
      console.error('Error recognizing vehicle document:', error);
      return null;
    }
  }

  // Розпізнавання номерного знаку та отримання даних про автомобіль
  async recognizeLicensePlateAndGetVehicleData(imageUri) {
    try {
      // Розпізнаємо текст з зображення
      const text = await this.recognizeText(imageUri);
      
      // Перевіряємо, чи вдалося розпізнати текст
      if (!text || text.trim().length === 0) {
        console.warn('Не вдалося розпізнати текст з зображення');
        return null;
      }
      
      console.log('Розпізнаний текст з зображення:', text);
      
      // Розпізнавання номерного знаку (українські номери)
      // Формат: AA1234BB, AA 1234 BB, АА1234ВВ, АА 1234 ВВ
      const plateRegex = /[A-ZА-ЯІЇЄ]{2}[ ]?[0-9]{4}[ ]?[A-ZА-ЯІЇЄ]{2}/gi;
      const plateMatches = text.match(plateRegex);
      
      if (!plateMatches || plateMatches.length === 0) {
        console.warn('Не вдалося розпізнати номерний знак');
        return null;
      }
      
      const licensePlate = plateMatches[0].replace(/\s/g, '').toUpperCase();
      console.log('Розпізнано номерний знак:', licensePlate);
      
      // Тут можна додати запит до API для отримання даних про автомобіль за номерним знаком
      // Наприклад, використовуючи сервіс OpenDataBot або інший API
      
      try {
        // Приклад запиту до API (замініть на реальний API)
        const apiUrl = `https://api.example.com/vehicle?plate=${encodeURIComponent(licensePlate)}`;
        const response = await fetch(apiUrl);
        
        if (response.ok) {
          const data = await response.json();
          return {
            licensePlate: licensePlate,
            make: data.make,
            model: data.model,
            year: data.year,
            color: data.color,
            vin: data.vin,
            isPartialData: false
          };
        }
      } catch (apiError) {
        console.error('Error fetching vehicle data from API:', apiError);
      }
      
      // Якщо API недоступний або повернув помилку, повертаємо базові дані
      return {
        licensePlate: licensePlate,
        // Якщо це мок, додаємо додаткові дані
        ...(this.useMock ? {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          color: 'Чорний',
          vin: 'ABC12345678901234',
          isMockData: true,
          isPartialData: false
        } : {
          isPartialData: true
        })
      };
    } catch (error) {
      console.error('Error recognizing license plate:', error);
      return null;
    }
  }

  // Розпізнавання VIN-коду
  async recognizeVIN(imageUri) {
    try {
      const text = await this.recognizeText(imageUri);
      if (!text) return null;
      
      const vinRegex = /[A-HJ-NPR-Z0-9]{17}/;
      const match = text.match(vinRegex);
      return match ? match[0] : null;
    } catch (error) {
      console.error('Error recognizing VIN:', error);
      return null;
    }
  }

  // Розпізнавання номерного знаку
  async recognizeLicensePlate(imageUri) {
    try {
      const text = await this.recognizeText(imageUri);
      if (!text) return null;
      
      // Регулярний вираз для українських номерних знаків
      const plateRegex = /[A-ZА-ЯІЇЄ]{2}[ ]?[0-9]{4}[ ]?[A-ZА-ЯІЇЄ]{2}/i;
      const match = text.match(plateRegex);
      return match ? match[0].replace(/\s/g, '').toUpperCase() : null;
    } catch (error) {
      console.error('Error recognizing license plate:', error);
      return null;
    }
  }

  // Розпізнавання характеристик запчастини
  async recognizePartDetails(imageUri) {
    try {
      const text = await this.recognizeText(imageUri);
      if (!text) return null;
      
      // Об'єкт для зберігання розпізнаних даних
      const partDetails = {};
      
      // Пошук артикулу (номеру запчастини)
      const partNumberPatterns = [
        /артикул[:\s]+([A-Z0-9-]+)/i,
        /номер[:\s]+([A-Z0-9-]+)/i,
        /part[.\s]+no[.:\s]+([A-Z0-9-]+)/i,
        /part[.\s]+number[:\s]+([A-Z0-9-]+)/i,
        /№([A-Z0-9-]+)/i
      ];
      
      for (const pattern of partNumberPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          partDetails.partNumber = match[1].trim();
          break;
        }
      }
      
      // Пошук виробника
      const manufacturerPatterns = [
        /виробник[:\s]+([A-Za-zА-Яа-яІіЇїЄєҐґ]+)/i,
        /manufacturer[:\s]+([A-Za-z]+)/i,
        /made by[:\s]+([A-Za-z]+)/i,
        /бренд[:\s]+([A-Za-zА-Яа-яІіЇїЄєҐґ]+)/i
      ];
      
      for (const pattern of manufacturerPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          partDetails.manufacturer = match[1].trim();
          break;
        }
      }
      
      // Пошук назви запчастини
      const namePatterns = [
        /назва[:\s]+([A-Za-zА-Яа-яІіЇїЄєҐґ\s]+)/i,
        /name[:\s]+([A-Za-z\s]+)/i,
        /деталь[:\s]+([A-Za-zА-Яа-яІіЇїЄєҐґ\s]+)/i,
        /part[:\s]+([A-Za-z\s]+)/i
      ];
      
      for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          partDetails.name = match[1].trim();
          break;
        }
      }
      
      // Якщо використовується мок і нічого не розпізнано, додаємо мокові дані
      if (this.useMock && Object.keys(partDetails).length === 0) {
        partDetails.partNumber = 'ABC-12345';
        partDetails.manufacturer = 'Toyota';
        partDetails.name = 'Фільтр масляний';
        partDetails.isMockData = true;
      }
      
      return partDetails;
    } catch (error) {
      console.error('Error recognizing part details:', error);
      return null;
    }
  }
}

// Створюємо екземпляр класу
const ocrManagerInstance = new OCRManager();

// Перевіряємо наявність методів в екземплярі
console.log('Методи ocrManagerInstance:', Object.getOwnPropertyNames(Object.getPrototypeOf(ocrManagerInstance)));

// Експортуємо тільки екземпляр класу, а не сам клас
export const ocrManager = ocrManagerInstance;