import { Platform } from 'react-native';
import { optimizeImage } from './imageUtils';
import axiosAuth from '../api/axiosConfig';

const isMobile = Platform.OS !== 'web';

const normalizeLicensePlate = (plate) => {
  if (!plate) return null;
  const normalized = String(plate).replace(/[\s\-_.]/g, '').toUpperCase();
  const map = {
    А: 'A',
    В: 'B',
    Е: 'E',
    І: 'I',
    К: 'K',
    М: 'M',
    Н: 'H',
    О: 'O',
    Р: 'P',
    С: 'C',
    Т: 'T',
    Х: 'X',
    У: 'Y',
  };
  return normalized.replace(/[АВЕІКМНОРСТХУ]/g, (char) => map[char] || char);
};

// Клас для роботи з OCR
export class OCRManager {
  constructor() {
    this.worker = null;
    this.useMock = false;
    this.initialized = false;
    this.tesseractLoaded = false;
    this.nativeTextRecognition = null;
    this.useNative = false;
    console.log(`OCRManager створено. Платформа: ${Platform.OS}`);
  }

  // Ініціалізація OCR системи
  async initialize() {
    if (this.worker !== null) {
      return; // Вже ініціалізовано
    }
    
    try {
      console.log('Initializing OCR system...');
      
      if (isMobile) {
        try {
          const nativeModule = require('@react-native-ml-kit/text-recognition');
          const TextRecognition = nativeModule.default || nativeModule;
          if (TextRecognition && typeof TextRecognition.recognize === 'function') {
            this.nativeTextRecognition = TextRecognition;
            this.useNative = true;
            this.useMock = false;
            this.initialized = true;
            console.log('Native OCR initialized successfully');
            return;
          }
        } catch (nativeError) {
          console.error('Failed to initialize native OCR:', nativeError);
        }
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
      
      const optimizedImageUri = await optimizeImage(imageUri, {
        quality: 0.9,
        maxWidth: 1200,
        maxHeight: 1200
      });
      
      console.log('Розпізнавання тексту з оптимізованого зображення...');
      
      let recognizedText = null;
      
      if (this.useNative && this.nativeTextRecognition) {
        const nativeResult = await this.nativeTextRecognition.recognize(optimizedImageUri);
        if (nativeResult) {
          if (typeof nativeResult.text === 'string') {
            recognizedText = nativeResult.text;
          } else if (Array.isArray(nativeResult)) {
            recognizedText = nativeResult.join('\n');
          } else if (typeof nativeResult === 'string') {
            recognizedText = nativeResult;
          }
        }
      } else if (this.worker) {
        const result = await this.worker.recognize(optimizedImageUri);
        if (!result || !result.data || !result.data.text) {
          console.warn('Розпізнавання тексту не повернуло результатів');
          return null;
        }
        recognizedText = result.data.text;
      }
      
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
      
      const plateRegex = /[A-ZА-ЯІЇЄ]{2}[ ]?[0-9]{4}[ ]?[A-ZА-ЯІЇЄ]{2}/gi;
      const plateMatches = text.match(plateRegex);
      if (plateMatches && plateMatches.length > 0) {
        vehicleData.licensePlate = normalizeLicensePlate(plateMatches[0]);
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

  // Допоміжна функція для виділення номерного знаку з тексту
  extractLicensePlateFromText(text) {
    const raw = String(text || '').toUpperCase();
    if (!raw) return null;

    const simpleRegex = /[A-ZА-ЯІЇЄҐ]{2}[ ]?[0-9]{4}[ ]?[A-ZА-ЯІЇЄҐ]{2}/i;
    const simpleMatch = raw.match(simpleRegex);
    if (simpleMatch && simpleMatch[0]) {
      return simpleMatch[0];
    }

    const map = {
      А: 'A',
      В: 'B',
      Е: 'E',
      І: 'I',
      К: 'K',
      М: 'M',
      Н: 'H',
      О: 'O',
      Р: 'P',
      С: 'C',
      Т: 'T',
      Х: 'X',
      У: 'Y',
      Ї: 'I',
      Є: 'E',
      Ґ: 'G',
    };

    const normalized = raw
      .replace(/[АВЕІКМНОРСТХУЇЄҐ]/g, (ch) => map[ch] || ch)
      .replace(/[^A-Z0-9 ]/g, '');

    const stripped = normalized.replace(/[^A-Z0-9]/g, '');
    if (stripped.length < 8) return null;

    const allowedLetters = new Set(['A', 'B', 'C', 'E', 'H', 'I', 'K', 'M', 'O', 'P', 'T', 'X', 'Y']);
    const uaPrefixes = new Set([
      'AA','AB','AC','AE','AH','AI','AK','AM','AO','AP','AT','AX',
      'BA','BB','BC','BE','BH','BI','BK','BM','BO','BP','BT','BX',
      'CA','CB','CC','CE','CH','CI','CK','CM','CO','CP','CT','CX',
      'EA','EB','EC','EE','EH','EI','EK','EM','EO','EP','ET','EX',
      'HA','HB','HC','HE','HH','HI','HK','HM','HO','HP','HT','HX',
      'IA','IB','IC','IE','IH','II','IK','IM','IO','IP','IT','IX',
      'KA','KB','KC','KE','KH','KI','KK','KM','KO','KP','KT','KX',
      'MA','MB','MC','ME','MH','MI','MK','MM','MO','MP','MT','MX',
      'OA','OB','OC','OE','OH','OI','OK','OM','OO','OP','OT','OX',
      'PA','PB','PC','PE','PH','PI','PK','PM','PO','PP','PT','PX',
    ]);
    const isAllowedLetter = (ch) => allowedLetters.has(ch);
    const isDigit = (ch) => ch >= '0' && ch <= '9';

    const fixLetter = (ch) => {
      if (allowedLetters.has(ch)) return { ch, cost: 0 };
      if (ch === '0') return { ch: 'O', cost: 1 };
      if (ch === '1') return { ch: 'I', cost: 1 };
      if (ch === '8') return { ch: 'B', cost: 1 };
      if (ch === '6') return { ch: 'B', cost: 2 };
      if (ch === '2') return { ch: 'Z', cost: 3 };
      return { ch, cost: 99 };
    };

    const fixDigit = (ch) => {
      if (isDigit(ch)) return { ch, cost: 0 };
      if (ch === 'O') return { ch: '0', cost: 1 };
      if (ch === 'I') return { ch: '1', cost: 1 };
      if (ch === 'Z') return { ch: '2', cost: 1 };
      if (ch === 'S') return { ch: '5', cost: 1 };
      if (ch === 'B') return { ch: '8', cost: 1 };
      if (ch === 'G') return { ch: '6', cost: 2 };
      if (ch === 'Q') return { ch: '0', cost: 2 };
      if (ch === 'D') return { ch: '0', cost: 2 };
      return { ch, cost: 99 };
    };

    const fixPrefix = (a, b) => {
      const direct = `${a}${b}`;
      if (uaPrefixes.has(direct)) return { a, b, cost: 0 };

      const variants = [
        { a, b },
        { a: a === 'P' ? 'B' : a === 'B' ? 'P' : a, b },
        { a, b: b === 'P' ? 'B' : b === 'B' ? 'P' : b },
        { a: a === 'P' ? 'B' : a === 'B' ? 'P' : a, b: b === 'P' ? 'B' : b === 'B' ? 'P' : b },
      ];

      for (const v of variants) {
        const p = `${v.a}${v.b}`;
        if (uaPrefixes.has(p)) {
          const cost = (v.a !== a ? 1 : 0) + (v.b !== b ? 1 : 0);
          return { a: v.a, b: v.b, cost };
        }
      }
      return null;
    };

    const scoreCandidate = (candidate) => {
      let cost = 0;
      const s = candidate.split('');

      const a0 = fixLetter(s[0]);
      const a1 = fixLetter(s[1]);
      const a6 = fixLetter(s[6]);
      const a7 = fixLetter(s[7]);
      if (a0.cost >= 99 || a1.cost >= 99 || a6.cost >= 99 || a7.cost >= 99) return null;

      const d2 = fixDigit(s[2]);
      const d3 = fixDigit(s[3]);
      const d4 = fixDigit(s[4]);
      const d5 = fixDigit(s[5]);
      if (d2.cost >= 99 || d3.cost >= 99 || d4.cost >= 99 || d5.cost >= 99) return null;

      const prefixFix = fixPrefix(a0.ch, a1.ch);
      if (!prefixFix) return null;

      cost +=
        a0.cost +
        a1.cost +
        d2.cost +
        d3.cost +
        d4.cost +
        d5.cost +
        a6.cost +
        a7.cost +
        prefixFix.cost;

      const fixed = `${prefixFix.a}${prefixFix.b}${d2.ch}${d3.ch}${d4.ch}${d5.ch}${a6.ch}${a7.ch}`;
      if (!/^[A-Z]{2}\d{4}[A-Z]{2}$/.test(fixed)) return null;
      if (!isAllowedLetter(fixed[0]) || !isAllowedLetter(fixed[1])) return null;
      if (!isAllowedLetter(fixed[6]) || !isAllowedLetter(fixed[7])) return null;
      return { fixed, cost };
    };

    let best = null;

    for (let i = 0; i <= normalized.length - 8; i += 1) {
      const s = normalized.slice(i, i + 8);
      const scored = scoreCandidate(s);
      if (!scored) continue;
      if (!best || scored.cost < best.cost) {
        best = scored;
        if (best.cost === 0) break;
      }
    }

    if (!best) {
      for (let i = 0; i <= stripped.length - 8; i += 1) {
        const s = stripped.slice(i, i + 8);
        const scored = scoreCandidate(s);
        if (!scored) continue;
        if (!best || scored.cost < best.cost) {
          best = scored;
          if (best.cost === 0) break;
        }
      }
    }

    if (!best && stripped.length >= 9) {
      const deletionPenalty = 2;
      for (let i = 0; i <= stripped.length - 9; i += 1) {
        const s9 = stripped.slice(i, i + 9);
        for (let drop = 0; drop < 9; drop += 1) {
          const s8 = s9.slice(0, drop) + s9.slice(drop + 1);
          const scored = scoreCandidate(s8);
          if (!scored) continue;
          const withPenalty = { fixed: scored.fixed, cost: scored.cost + deletionPenalty };
          if (!best || withPenalty.cost < best.cost) {
            best = withPenalty;
          }
        }
      }
    }

    if (!best && stripped.length >= 10) {
      const deletionPenalty = 4;
      for (let i = 0; i <= stripped.length - 10; i += 1) {
        const s10 = stripped.slice(i, i + 10);
        for (let dropA = 0; dropA < 10; dropA += 1) {
          for (let dropB = dropA + 1; dropB < 10; dropB += 1) {
            const s8 = s10.slice(0, dropA) + s10.slice(dropA + 1, dropB) + s10.slice(dropB + 1);
            if (s8.length !== 8) continue;
            const scored = scoreCandidate(s8);
            if (!scored) continue;
            const withPenalty = { fixed: scored.fixed, cost: scored.cost + deletionPenalty };
            if (!best || withPenalty.cost < best.cost) {
              best = withPenalty;
            }
          }
        }
      }
    }

    if (best?.fixed) return best.fixed;
    return null;
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
      
      const extractedPlate = this.extractLicensePlateFromText(text);
      if (!extractedPlate) {
        console.warn('Не вдалося розпізнати номерний знак');
        return null;
      }

      const licensePlate = normalizeLicensePlate(extractedPlate);
      console.log('Розпізнано номерний знак:', licensePlate);

      let registryData = null;

      try {
        const normalizedPlate = normalizeLicensePlate(licensePlate);

        if (normalizedPlate) {
          const response = await axiosAuth.get('/api/vehicle-registry', {
            params: {
              license_plate: normalizedPlate,
            },
          });

          if (response && response.data) {
            registryData = response.data;
          }
        }
      } catch (apiError) {
        console.error('Error fetching vehicle data from registry:', apiError);
      }

      if (registryData) {
        // Маппінг типу палива
        let engineType = 'petrol'; // default
        const fuelRaw = String(registryData.fuel_type || '').toUpperCase();
        if (fuelRaw.includes('BENZINE') || fuelRaw.includes('PETROL')) engineType = 'petrol';
        else if (fuelRaw.includes('DIESEL')) engineType = 'diesel';
        else if (fuelRaw.includes('GAS')) engineType = 'gas';
        else if (fuelRaw.includes('ELECTRO') || fuelRaw.includes('ELECTRIC')) engineType = 'electric';
        else if (fuelRaw.includes('HYBRID')) engineType = 'hybrid';

        return {
          licensePlate: licensePlate,
          make: registryData.brand || null,
          model: registryData.model || null,
          year: registryData.make_year || null,
          color: registryData.color || null,
          vin: registryData.vin || null,
          engineType: engineType,
          engineVolume: registryData.engine_volume || null,
          isPartialData: false
        };
      }

      return {
        licensePlate: licensePlate,
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

      const extractedPlate = this.extractLicensePlateFromText(text);
      return extractedPlate ? normalizeLicensePlate(extractedPlate) : null;
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
