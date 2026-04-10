import { Platform } from 'react-native';
import { optimizeImage } from './imageUtils';
import axiosAuth from '../api/axiosConfig';

const isMobile = Platform.OS !== 'web';

const normalizeLicensePlate = (plate) => {
  if (!plate) return null;
  const normalized = String(plate).replace(/[\s\-_.]/g, '').toUpperCase();
  const map = {
    '\u0410': 'A',
    '\u0412': 'B',
    '\u0415': 'E',
    '\u0406': 'I',
    '\u041A': 'K',
    '\u041C': 'M',
    '\u041D': 'H',
    '\u041E': 'O',
    '\u0420': 'P',
    '\u0421': 'C',
    '\u0422': 'T',
    '\u0425': 'X',
    '\u0423': 'Y',
  };
  return normalized.replace(/[\u0410\u0412\u0415\u0406\u041A\u041C\u041D\u041E\u0420\u0421\u0422\u0425\u0423]/g, (char) => map[char] || char);
};

// РљР»Р°СЃ РґР»СЏ СЂРѕР±РѕС‚Рё Р· OCR
export class OCRManager {
  constructor() {
    this.worker = null;
    this.useMock = false;
    this.initialized = false;
    this.tesseractLoaded = false;
    this.nativeTextRecognition = null;
    this.useNative = false;
    console.log(`OCRManager СЃС‚РІРѕСЂРµРЅРѕ. РџР»Р°С‚С„РѕСЂРјР°: ${Platform.OS}`);
  }

  // Р†РЅС–С†С–Р°Р»С–Р·Р°С†С–СЏ OCR СЃРёСЃС‚РµРјРё
  async initialize() {
    if (this.worker !== null) {
      return; // Р’Р¶Рµ С–РЅС–С†С–Р°Р»С–Р·РѕРІР°РЅРѕ
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
        // On mobile we intentionally rely on ML Kit only.
        this.worker = null;
        this.useMock = false;
        this.useNative = false;
        this.initialized = false;
        throw new Error('ML Kit text recognition is unavailable on this device');
      }
      
      // РЎРїСЂРѕР±СѓС”РјРѕ С–РЅС–С†С–Р°Р»С–Р·СѓРІР°С‚Рё Tesseract С‚С–Р»СЊРєРё РґР»СЏ РІРµР±-РІРµСЂСЃС–С—
      try {
        // Р”РёРЅР°РјС–С‡РЅРѕ С–РјРїРѕСЂС‚СѓС”РјРѕ Tesseract.js
        const { createWorker } = await import('tesseract.js');
        
        // РЎС‚РІРѕСЂСЋС”РјРѕ worker Р· Р±Р°Р·РѕРІРёРјРё РѕРїС†С–СЏРјРё
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
  
  // РЎС‚РІРѕСЂРµРЅРЅСЏ РјРѕРєРѕРІРѕРіРѕ РІРѕСЂРєРµСЂР°
  createMockWorker() {
    console.log('Creating mock OCR worker');
    return {
      recognize: async (imageUri) => {
        // Р†РјС–С‚СѓС”РјРѕ Р·Р°С‚СЂРёРјРєСѓ СЂРѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // РџРµСЂРµРІС–СЂСЏС”РјРѕ, С‡Рё С†Рµ Р·РѕР±СЂР°Р¶РµРЅРЅСЏ РЅРѕРјРµСЂРЅРѕРіРѕ Р·РЅР°РєСѓ (Р·Р° РЅР°Р·РІРѕСЋ С„Р°Р№Р»Сѓ Р°Р±Рѕ С€Р»СЏС…РѕРј)
        const isLicensePlate = imageUri.toLowerCase().includes('plate') || 
                              imageUri.toLowerCase().includes('РЅРѕРјРµСЂ') || 
                              imageUri.toLowerCase().includes('license');
        
        // РџРѕРІРµСЂС‚Р°С”РјРѕ СЂС–Р·РЅС– РјРѕРєРѕРІС– РґР°РЅС– Р·Р°Р»РµР¶РЅРѕ РІС–Рґ С‚РёРїСѓ Р·РѕР±СЂР°Р¶РµРЅРЅСЏ
        if (isLicensePlate) {
          return { 
            data: { 
              text: "AA1234BB\nРЈРєСЂР°С—РЅР°" 
            } 
          };
        } else {
          return { 
            data: { 
              text: "РЎР’Р†Р”РћР¦РўР’Рћ РџР Рћ Р Р•Р„РЎРўР РђР¦Р†Р® РўР РђРќРЎРџРћР РўРќРћР“Рћ Р—РђРЎРћР‘РЈ\nVIN: ABC12345678901234\nРњР°СЂРєР°: Toyota\nРњРѕРґРµР»СЊ: Camry\nР С–Рє: 2020\nРљРѕР»С–СЂ: Р§РѕСЂРЅРёР№\nРќРѕРјРµСЂРЅРёР№ Р·РЅР°Рє: AA1234BB" 
            } 
          };
        }
      },
      terminate: async () => {
        console.log('Mock worker terminated');
      }
    };
  }

  // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ С‚РµРєСЃС‚Сѓ Р· Р·РѕР±СЂР°Р¶РµРЅРЅСЏ
  async recognizeText(imageUri) {
    try {
      // РџРµСЂРµРІС–СЂСЏС”РјРѕ, С‡Рё С–РЅС–С†С–Р°Р»С–Р·РѕРІР°РЅРѕ worker
      if (!this.worker) {
        await this.initialize();
      }
      
      // РџРµСЂРµРІС–СЂСЏС”РјРѕ, С‡Рё СѓСЃРїС–С€РЅРѕ С–РЅС–С†С–Р°Р»С–Р·РѕРІР°РЅРѕ
      if (!this.initialized) {
        console.warn('РЈР’РђР“Рђ: OCR РЅРµ С–РЅС–С†С–Р°Р»С–Р·РѕРІР°РЅРѕ РЅР°Р»РµР¶РЅРёРј С‡РёРЅРѕРј');
        throw new Error('OCR РЅРµРґРѕСЃС‚СѓРїРЅРёР№. Р’РёРєРѕСЂРёСЃС‚РѕРІСѓС”С‚СЊСЃСЏ Р·Р°РіР»СѓС€РєР°.');
      }
      
      // РЇРєС‰Рѕ РІРёРєРѕСЂРёСЃС‚РѕРІСѓС”С‚СЊСЃСЏ Р·Р°РіР»СѓС€РєР°, РїРѕРїРµСЂРµРґР¶Р°С”РјРѕ РїСЂРѕ С†Рµ
      if (this.useMock) {
        console.warn('РЈР’РђР“Рђ: Р’РёРєРѕСЂРёСЃС‚РѕРІСѓС”С‚СЊСЃСЏ Р·Р°РіР»СѓС€РєР° РґР»СЏ OCR. Р РµР°Р»СЊРЅРµ СЂРѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ РЅРµРјРѕР¶Р»РёРІРµ.');
      }
      
      const optimizedImageUri = await optimizeImage(imageUri, {
        quality: 0.9,
        maxWidth: 1200,
        maxHeight: 1200
      });
      
      console.log('Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ С‚РµРєСЃС‚Сѓ Р· РѕРїС‚РёРјС–Р·РѕРІР°РЅРѕРіРѕ Р·РѕР±СЂР°Р¶РµРЅРЅСЏ...');
      
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
          console.warn('Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ С‚РµРєСЃС‚Сѓ РЅРµ РїРѕРІРµСЂРЅСѓР»Рѕ СЂРµР·СѓР»СЊС‚Р°С‚С–РІ');
          return null;
        }
        recognizedText = result.data.text;
      }
      
      // РџРµСЂРµРІС–СЂСЏС”РјРѕ, С‡Рё С‚РµРєСЃС‚ РЅРµ РїРѕСЂРѕР¶РЅС–Р№
      if (!recognizedText || recognizedText.trim().length === 0) {
        console.warn('Р РѕР·РїС–Р·РЅР°РЅРёР№ С‚РµРєСЃС‚ РїРѕСЂРѕР¶РЅС–Р№');
        return null;
      }
      
      console.log('РўРµРєСЃС‚ СѓСЃРїС–С€РЅРѕ СЂРѕР·РїС–Р·РЅР°РЅРѕ');
      return recognizedText;
    } catch (error) {
      console.error('Error recognizing text:', error);
      
      // РЎРїСЂРѕР±СѓС”РјРѕ С‰Рµ СЂР°Р· Р· РЅРёР¶С‡РѕСЋ СЏРєС–СЃС‚СЋ, СЏРєС‰Рѕ РїРѕРјРёР»РєР° РЅРµ РєСЂРёС‚РёС‡РЅР°
      try {
        if (this.worker && this.initialized) {
          console.log('РЎРїСЂРѕР±Р° СЂРѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ Р· РЅРёР¶С‡РѕСЋ СЏРєС–СЃС‚СЋ...');
          
          // РћРїС‚РёРјС–Р·СѓС”РјРѕ Р·РѕР±СЂР°Р¶РµРЅРЅСЏ Р· РЅРёР¶С‡РѕСЋ СЏРєС–СЃС‚СЋ
          const lowQualityImageUri = await optimizeImage(imageUri, {
            quality: 0.7,
            maxWidth: 800,
            maxHeight: 800
          });
          
          // Р РѕР·РїС–Р·РЅР°С”РјРѕ С‚РµРєСЃС‚
          const result = await this.worker.recognize(lowQualityImageUri);
          
          if (result && result.data && result.data.text) {
            console.log('РўРµРєСЃС‚ СѓСЃРїС–С€РЅРѕ СЂРѕР·РїС–Р·РЅР°РЅРѕ Р· РЅРёР¶С‡РѕСЋ СЏРєС–СЃС‚СЋ');
            return result.data.text;
          }
        }
      } catch (retryError) {
        console.error('Error during retry with lower quality:', retryError);
      }
      
      return null;
    }
  }

  // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ РґРѕРєСѓРјРµРЅС‚С–РІ С‚СЂР°РЅСЃРїРѕСЂС‚РЅРѕРіРѕ Р·Р°СЃРѕР±Сѓ
  async recognizeVehicleDocument(imageUri) {
    try {
      // Р РѕР·РїС–Р·РЅР°С”РјРѕ С‚РµРєСЃС‚ Р· Р·РѕР±СЂР°Р¶РµРЅРЅСЏ
      const text = await this.recognizeText(imageUri);
      
      // РџРµСЂРµРІС–СЂСЏС”РјРѕ, С‡Рё РІРґР°Р»РѕСЃСЏ СЂРѕР·РїС–Р·РЅР°С‚Рё С‚РµРєСЃС‚
      if (!text || text.trim().length === 0) {
        console.warn('РќРµ РІРґР°Р»РѕСЃСЏ СЂРѕР·РїС–Р·РЅР°С‚Рё С‚РµРєСЃС‚ Р· РґРѕРєСѓРјРµРЅС‚Р°');
        return null;
      }
      
      console.log('Р РѕР·РїС–Р·РЅР°РЅРёР№ С‚РµРєСЃС‚ Р· РґРѕРєСѓРјРµРЅС‚Р°:', text.substring(0, 100) + '...');
      
      // Р†РЅС–С†С–Р°Р»С–Р·СѓС”РјРѕ РѕР±'С”РєС‚ РґР»СЏ РґР°РЅРёС… Р°РІС‚РѕРјРѕР±С–Р»СЏ
      const vehicleData = {
        vin: null,
        licensePlate: null,
        make: null,
        model: null,
        year: null,
        color: null,
        // Р”РѕРґР°С‚РєРѕРІС– РїРѕР»СЏ, СЏРєС– РјРѕР¶РЅР° СЂРѕР·РїС–Р·РЅР°С‚Рё
        engineNumber: null,
        chassisNumber: null,
        registrationNumber: null,
        ownerName: null,
        registrationDate: null,
        // РџСЂР°РїРѕСЂРµС†СЊ, С‰Рѕ РІРєР°Р·СѓС”, С‡Рё РґР°РЅС– СЂРѕР·РїС–Р·РЅР°РЅС– С‡Р°СЃС‚РєРѕРІРѕ
        isPartialData: false
      };
      
      // РЇРєС‰Рѕ РІРёРєРѕСЂРёСЃС‚РѕРІСѓС”С‚СЊСЃСЏ РјРѕРє, РїРѕР·РЅР°С‡Р°С”РјРѕ С†Рµ
      if (this.useMock) {
        vehicleData.isMockData = true;
      }
      
      // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ VIN-РєРѕРґСѓ (17 СЃРёРјРІРѕР»С–РІ, Р±СѓРєРІРё С‚Р° С†РёС„СЂРё)
      const vinRegex = /[A-HJ-NPR-Z0-9]{17}/gi;
      const vinMatches = text.match(vinRegex);
      if (vinMatches && vinMatches.length > 0) {
        vehicleData.vin = vinMatches[0].toUpperCase();
        console.log('Р РѕР·РїС–Р·РЅР°РЅРѕ VIN:', vehicleData.vin);
      }
      
      const plateRegex = /[A-ZРђ-РЇР†Р‡Р„]{2}[ ]?[0-9]{4}[ ]?[A-ZРђ-РЇР†Р‡Р„]{2}/gi;
      const plateMatches = text.match(plateRegex);
      if (plateMatches && plateMatches.length > 0) {
        vehicleData.licensePlate = normalizeLicensePlate(plateMatches[0]);
        console.log('Р РѕР·РїС–Р·РЅР°РЅРѕ РЅРѕРјРµСЂРЅРёР№ Р·РЅР°Рє:', vehicleData.licensePlate);
      }
      
      // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ РјР°СЂРєРё Р°РІС‚РѕРјРѕР±С–Р»СЏ
      // РЎРїРёСЃРѕРє РїРѕРїСѓР»СЏСЂРЅРёС… РјР°СЂРѕРє
      const popularMakes = [
        'TOYOTA', 'HONDA', 'FORD', 'CHEVROLET', 'VOLKSWAGEN', 'BMW', 'MERCEDES', 'AUDI', 
        'HYUNDAI', 'KIA', 'NISSAN', 'MAZDA', 'SUBARU', 'LEXUS', 'MITSUBISHI', 'VOLVO', 
        'SKODA', 'RENAULT', 'PEUGEOT', 'CITROEN', 'FIAT', 'OPEL', 'SEAT', 'PORSCHE',
        'JEEP', 'LAND ROVER', 'JAGUAR', 'MINI', 'SUZUKI', 'DACIA', 'LADA', 'Р’РђР—', 'Р—РђР—'
      ];
      
      for (const make of popularMakes) {
        if (text.toUpperCase().includes(make)) {
          vehicleData.make = make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
          console.log('Р РѕР·РїС–Р·РЅР°РЅРѕ РјР°СЂРєСѓ:', vehicleData.make);
          break;
        }
      }
      
      // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ РјРѕРґРµР»С– Р°РІС‚РѕРјРѕР±С–Р»СЏ
      // Р¦Рµ СЃРєР»Р°РґРЅС–С€Рµ, С‚РѕРјСѓ С‰Рѕ РјРѕРґРµР»С– РјРѕР¶СѓС‚СЊ РјР°С‚Рё СЂС–Р·РЅС– РЅР°Р·РІРё
      // РЎРїСЂРѕР±СѓС”РјРѕ Р·РЅР°Р№С‚Рё РјРѕРґРµР»СЊ РїС–СЃР»СЏ СЃР»РѕРІР° "РјРѕРґРµР»СЊ" Р°Р±Рѕ "model"
      const modelRegex = /(?:РјРѕРґРµР»СЊ|model)[:\s]+([A-Za-zРђ-РЇР°-СЏР†С–Р‡С—Р„С”ТђТ‘0-9\s\-]+)/i;
      const modelMatch = text.match(modelRegex);
      if (modelMatch && modelMatch[1]) {
        vehicleData.model = modelMatch[1].trim();
        console.log('Р РѕР·РїС–Р·РЅР°РЅРѕ РјРѕРґРµР»СЊ:', vehicleData.model);
      }
      
      // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ СЂРѕРєСѓ РІРёРїСѓСЃРєСѓ (4 С†РёС„СЂРё РјС–Р¶ 1900 С– РїРѕС‚РѕС‡РЅРёРј СЂРѕРєРѕРј)
      const currentYear = new Date().getFullYear();
      const yearRegex = /\b(19[5-9][0-9]|20[0-2][0-9])\b/g;
      const yearMatches = text.match(yearRegex);
      if (yearMatches && yearMatches.length > 0) {
        // РџРµСЂРµРІС–СЂСЏС”РјРѕ, С‰Рѕ СЂС–Рє РЅРµ Р±С–Р»СЊС€РёР№ Р·Р° РїРѕС‚РѕС‡РЅРёР№
        const parsedYear = parseInt(yearMatches[0], 10);
        if (parsedYear <= currentYear) {
          vehicleData.year = parsedYear;
          console.log('Р РѕР·РїС–Р·РЅР°РЅРѕ СЂС–Рє:', vehicleData.year);
        }
      }
      
      // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ РєРѕР»СЊРѕСЂСѓ
      const colors = [
        'Р±С–Р»РёР№', 'С‡РѕСЂРЅРёР№', 'С‡РµСЂРІРѕРЅРёР№', 'СЃРёРЅС–Р№', 'Р·РµР»РµРЅРёР№', 'Р¶РѕРІС‚РёР№', 'СЃС–СЂРёР№', 'РєРѕСЂРёС‡РЅРµРІРёР№',
        'СЃСЂС–Р±РЅРёР№', 'Р·РѕР»РѕС‚РёР№', 'Р±РµР¶РµРІРёР№', 'С„С–РѕР»РµС‚РѕРІРёР№', 'РїРѕРјР°СЂР°РЅС‡РµРІРёР№', 'Р±Р»Р°РєРёС‚РЅРёР№',
        'Р±РµР»С‹Р№', 'С‡РµСЂРЅС‹Р№', 'РєСЂР°СЃРЅС‹Р№', 'СЃРёРЅРёР№', 'Р·РµР»РµРЅС‹Р№', 'Р¶РµР»С‚С‹Р№', 'СЃРµСЂС‹Р№', 'РєРѕСЂРёС‡РЅРµРІС‹Р№',
        'СЃРµСЂРµР±СЂСЏРЅС‹Р№', 'Р·РѕР»РѕС‚РѕР№', 'Р±РµР¶РµРІС‹Р№', 'С„РёРѕР»РµС‚РѕРІС‹Р№', 'РѕСЂР°РЅР¶РµРІС‹Р№', 'РіРѕР»СѓР±РѕР№',
        'white', 'black', 'red', 'blue', 'green', 'yellow', 'gray', 'brown',
        'silver', 'gold', 'beige', 'purple', 'orange', 'light blue'
      ];
      
      for (const color of colors) {
        if (text.toLowerCase().includes(color.toLowerCase())) {
          vehicleData.color = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
          console.log('Р РѕР·РїС–Р·РЅР°РЅРѕ РєРѕР»С–СЂ:', vehicleData.color);
          break;
        }
      }
      
      // РџРµСЂРµРІС–СЂСЏС”РјРѕ, С‡Рё СЂРѕР·РїС–Р·РЅР°РЅРѕ С…РѕС‡Р° Р± РѕРґРЅРµ РїРѕР»Рµ
      const hasAnyData = Object.keys(vehicleData).some(key => 
        key !== 'isPartialData' && key !== 'isMockData' && vehicleData[key] !== null
      );
      
      if (!hasAnyData) {
        console.warn('РќРµ РІРґР°Р»РѕСЃСЏ СЂРѕР·РїС–Р·РЅР°С‚Рё Р¶РѕРґРЅРёС… РґР°РЅРёС… Р· РґРѕРєСѓРјРµРЅС‚Р°');
        return null;
      }
      
      // РџРµСЂРµРІС–СЂСЏС”РјРѕ, С‡Рё РґР°РЅС– СЂРѕР·РїС–Р·РЅР°РЅС– С‡Р°СЃС‚РєРѕРІРѕ
      const requiredFields = ['vin', 'make', 'model', 'year'];
      const hasAllRequiredData = requiredFields.every(field => vehicleData[field] !== null);
      
      if (!hasAllRequiredData) {
        vehicleData.isPartialData = true;
        console.log('Р РѕР·РїС–Р·РЅР°РЅРѕ Р»РёС€Рµ С‡Р°СЃС‚РёРЅСѓ РґР°РЅРёС…');
      }
      
      console.log('Р РµР·СѓР»СЊС‚Р°С‚ СЂРѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ РґРѕРєСѓРјРµРЅС‚Сѓ:', vehicleData);
      return vehicleData;
    } catch (error) {
      console.error('Error recognizing vehicle document:', error);
      return null;
    }
  }

  // Р”РѕРїРѕРјС–Р¶РЅР° С„СѓРЅРєС†С–СЏ РґР»СЏ РІРёРґС–Р»РµРЅРЅСЏ РЅРѕРјРµСЂРЅРѕРіРѕ Р·РЅР°РєСѓ Р· С‚РµРєСЃС‚Сѓ
  extractLicensePlateFromText(text) {
    const raw = String(text || '').toUpperCase();
    if (!raw) return null;

    const rawForLines = raw
      .replace(/\\R\\N/g, '\n')
      .replace(/\\N/g, '\n')
      .replace(/\\R/g, '\n')
      .replace(/\\T/g, ' ');

    const preNormalized = raw
      .replace(/\\R\\N/g, ' ')
      .replace(/\\N/g, ' ')
      .replace(/\\R/g, ' ')
      .replace(/\\T/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/R\s*N/g, 'K')
      .replace(/RN/g, 'K');

    const map = {
      '\u0410': 'A',
      '\u0412': 'B',
      '\u0415': 'E',
      '\u0418': 'I',
      '\u0406': 'I',
      '\u041A': 'K',
      '\u041C': 'M',
      '\u041D': 'H',
      '\u041E': 'O',
      '\u0420': 'P',
      '\u0421': 'C',
      '\u0422': 'T',
      '\u0425': 'X',
      '\u0423': 'Y',
      '\u0419': 'I',
      '\u0417': '3',
      '\u0427': '4',
      '\u0407': 'I',
      '\u0404': 'E',
      '\u0490': 'G',
    };

    const normalizeChunk = (value) =>
      String(value || '')
        .replace(/[\u0410\u0412\u0415\u0418\u0406\u041A\u041C\u041D\u041E\u0420\u0421\u0422\u0425\u0423\u0419\u0417\u0427\u0407\u0404\u0490]/g, (ch) => map[ch] || ch)
        .replace(/[^A-Z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const normalized = normalizeChunk(preNormalized);
    const normalizedLines = rawForLines
      .split(/\r?\n/)
      .map((line) =>
        normalizeChunk(
          String(line || '')
            .replace(/R\s*N/g, 'K')
            .replace(/RN/g, 'K')
        )
      )
      .filter(Boolean);

    const exactSources = Array.from(
      new Set(
        [
          normalized,
          ...normalizedLines,
          ...normalizedLines.flatMap((line, idx) => {
            if (idx >= normalizedLines.length - 1) return [];
            return [`${line} ${normalizedLines[idx + 1]}`, `${line}${normalizedLines[idx + 1]}`];
          }),
        ].filter(Boolean)
      )
    );

    // Fast-path: exact line hit like "KA 2878 IA"
    for (const line of normalizedLines) {
      const lineMatch = String(line).match(/\b([A-Z]{2})\s*(\d{4})\s*([A-Z]{2})\b/);
      if (lineMatch) {
        return `${lineMatch[1]}${lineMatch[2]}${lineMatch[3]}`;
      }
    }

    for (const source of exactSources) {
      const exactMatch = String(source).match(/\b[A-Z]{2}\s?\d{4}\s?[A-Z]{2}\b/);
      if (exactMatch && exactMatch[0]) {
        return exactMatch[0].replace(/\s+/g, '');
      }
    }

    const fragments = [];
    const seenFragments = new Set();
    const pushFragment = (value, kind = 'token') => {
      const compact = String(value || '').replace(/[^A-Z0-9]/g, '');
      if (!compact || compact.length < 8 || compact.length > 10) return;
      const key = `${kind}:${compact}`;
      if (seenFragments.has(key)) return;
      seenFragments.add(key);
      fragments.push({ compact, kind });
    };

    for (const line of normalizedLines) {
      pushFragment(line, 'line');
      const tokens = String(line).split(/\s+/).filter(Boolean);
      tokens.forEach((token) => pushFragment(token, 'token'));
      for (let i = 0; i < tokens.length - 1; i += 1) {
        pushFragment(`${tokens[i]}${tokens[i + 1]}`, 'pair');
        if (i < tokens.length - 2) {
          pushFragment(`${tokens[i]}${tokens[i + 1]}${tokens[i + 2]}`, 'triple');
        }
      }
    }

    if (!fragments.length) return null;

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
      if (ch === '4') return { ch: 'A', cost: 2 };
      if (ch === '7') return { ch: 'T', cost: 2 };
      if (ch === '9') return { ch: 'P', cost: 2 };
      if (ch === '3') return { ch: 'E', cost: 2 };
      if (ch === '5') return { ch: 'C', cost: 3 };
      if (ch === 'L' || ch === 'J') return { ch: 'I', cost: 2 };
      if (ch === 'V' || ch === 'U') return { ch: 'Y', cost: 2 };
      if (ch === 'N') return { ch: 'H', cost: 2 };
      if (ch === 'R') return { ch: 'P', cost: 2 };
      if (ch === 'D' || ch === 'Q') return { ch: 'O', cost: 2 };
      if (ch === 'G') return { ch: 'C', cost: 3 };
      if (ch === 'F') return { ch: 'E', cost: 3 };
      return { ch, cost: 99 };
    };

    const fixDigit = (ch) => {
      if (isDigit(ch)) return { ch, cost: 0 };
      if (ch === 'O') return { ch: '0', cost: 1 };
      if (ch === 'I') return { ch: '1', cost: 1 };
      if (ch === 'L') return { ch: '1', cost: 2 };
      if (ch === 'Z') return { ch: '2', cost: 1 };
      if (ch === 'S') return { ch: '5', cost: 1 };
      if (ch === 'B') return { ch: '8', cost: 1 };
      if (ch === 'E') return { ch: '3', cost: 2 };
      if (ch === 'A') return { ch: '4', cost: 2 };
      if (ch === 'T') return { ch: '7', cost: 2 };
      if (ch === 'W') return { ch: '7', cost: 3 };
      if (ch === 'P') return { ch: '9', cost: 3 };
      if (ch === 'G') return { ch: '6', cost: 2 };
      if (ch === 'C') return { ch: '6', cost: 3 };
      if (ch === 'Q') return { ch: '0', cost: 2 };
      if (ch === 'D') return { ch: '0', cost: 2 };
      if (ch === 'U') return { ch: '0', cost: 3 };
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

      const cost =
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
      const exactHits = fixed.split('').reduce((sum, ch, idx) => sum + (candidate[idx] === ch ? 1 : 0), 0);
      return { fixed, cost, exactHits };
    };

    let best = null;
    const considerCandidate = (candidate, kind, penalty = 0) => {
      const scored = scoreCandidate(candidate);
      if (!scored) return false;
      const totalCost = scored.cost + penalty;
      const minExactHits = penalty > 0 ? 7 : kind === 'line' || kind === 'pair' || kind === 'triple' ? 6 : 7;
      if (totalCost > 3) return false;
      if (scored.exactHits < minExactHits) return false;
      const withPenalty = { fixed: scored.fixed, cost: totalCost, exactHits: scored.exactHits };
      if (!best || withPenalty.cost < best.cost) {
        best = withPenalty;
      }
      return withPenalty.cost === 0 && withPenalty.exactHits === 8;
    };

    const trySource = ({ compact, kind }) => {
      if (!compact) return;

      if (compact.length === 8) {
        considerCandidate(compact, kind);
        return;
      }

      if (compact.length === 9) {
        for (let drop = 0; drop < 9; drop += 1) {
          const s8 = compact.slice(0, drop) + compact.slice(drop + 1);
          considerCandidate(s8, kind, 2);
        }
        return;
      }

      if (compact.length === 10) {
        for (let dropA = 0; dropA < 10; dropA += 1) {
          for (let dropB = dropA + 1; dropB < 10; dropB += 1) {
            const s8 = compact.slice(0, dropA) + compact.slice(dropA + 1, dropB) + compact.slice(dropB + 1);
            if (s8.length === 8) {
              considerCandidate(s8, kind, 3);
            }
          }
        }
      }
    };

    for (const source of fragments) {
      trySource(source);
      if (best?.cost === 0 && best?.exactHits === 8) break;
    }

    if (best?.fixed) return best.fixed;
    return null;
  }

  // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ РЅРѕРјРµСЂРЅРѕРіРѕ Р·РЅР°РєСѓ С‚Р° РѕС‚СЂРёРјР°РЅРЅСЏ РґР°РЅРёС… РїСЂРѕ Р°РІС‚РѕРјРѕР±С–Р»СЊ
  async recognizeLicensePlateAndGetVehicleData(imageUri) {
    try {
      let extractedPlate = null;
      let recognizedText = '';

      // 1) First try backend OCR (more stable for plate recognition)
      try {
        const filename = String(imageUri || '').split(/[\\/]/).pop() || 'plate.jpg';
        const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : 'jpg';
        const type = ext === 'png' ? 'image/png' : 'image/jpeg';
        const formData = new FormData();
        formData.append('image', {
          uri: imageUri,
          name: filename,
          type,
        });

        const plateResponse = await axiosAuth.post('/api/ocr/plate', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        extractedPlate = plateResponse?.data?.licensePlate || null;
        recognizedText = plateResponse?.data?.rawText || '';
      } catch (serverOcrError) {
        console.warn('Backend plate OCR failed, fallback to local OCR:', serverOcrError?.message || serverOcrError);
      }

      // 2) Fallback: local OCR + local parser
      if (!extractedPlate) {
        const text = await this.recognizeText(imageUri);
        if (!text || text.trim().length === 0) {
          console.warn('РќРµ РІРґР°Р»РѕСЃСЏ СЂРѕР·РїС–Р·РЅР°С‚Рё С‚РµРєСЃС‚ Р· Р·РѕР±СЂР°Р¶РµРЅРЅСЏ');
          return null;
        }
        recognizedText = text;
        console.log('Р РѕР·РїС–Р·РЅР°РЅРёР№ С‚РµРєСЃС‚ Р· Р·РѕР±СЂР°Р¶РµРЅРЅСЏ:', text);
        extractedPlate = this.extractLicensePlateFromText(text);
      }

      if (!extractedPlate) {
        console.warn('РќРµ РІРґР°Р»РѕСЃСЏ СЂРѕР·РїС–Р·РЅР°С‚Рё РЅРѕРјРµСЂРЅРёР№ Р·РЅР°Рє');
        return null;
      }

      const licensePlate = normalizeLicensePlate(extractedPlate);
      console.log('Р РѕР·РїС–Р·РЅР°РЅРѕ РЅРѕРјРµСЂРЅРёР№ Р·РЅР°Рє:', licensePlate);

      let dbData = null;
      let registryData = null;
      const normalizedPlate = normalizeLicensePlate(licensePlate);

      try {
        if (normalizedPlate) {
          // Prefer own DB first
          try {
            const dbResponse = await axiosAuth.get(`/api/vehicles/license/${encodeURIComponent(normalizedPlate)}`);
            if (dbResponse?.data) {
              dbData = dbResponse.data;
            }
          } catch (_) {
            void _;
          }

          // Then registry fallback
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

      if (dbData) {
        const rawEngine = String(dbData.engineType || dbData.engine_type || '').toUpperCase();
        let engineType = 'petrol';
        if (rawEngine.includes('BENZINE') || rawEngine.includes('PETROL')) engineType = 'petrol';
        else if (rawEngine.includes('DIESEL')) engineType = 'diesel';
        else if (rawEngine.includes('GAS')) engineType = 'gas';
        else if (rawEngine.includes('ELECTRO') || rawEngine.includes('ELECTRIC')) engineType = 'electric';
        else if (rawEngine.includes('HYBRID')) engineType = 'hybrid';

        return {
          licensePlate,
          make: dbData.make || dbData.brand || null,
          model: dbData.model || null,
          year: dbData.year || null,
          color: dbData.color || null,
          vin: dbData.vin || null,
          engineType,
          engineVolume: dbData.engineCapacity || dbData.engine_capacity || null,
          mileage: dbData.mileage || null,
          rawText: recognizedText || null,
          isPartialData: false,
        };
      }

      if (registryData) {
        // РњР°РїРїС–РЅРі С‚РёРїСѓ РїР°Р»РёРІР°
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
          rawText: recognizedText || null,
          isPartialData: false
        };
      }

      return {
        licensePlate: licensePlate,
        rawText: recognizedText || null,
        ...(this.useMock ? {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          color: 'Р§РѕСЂРЅРёР№',
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

  // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ VIN-РєРѕРґСѓ
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

  // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ РЅРѕРјРµСЂРЅРѕРіРѕ Р·РЅР°РєСѓ
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

  // Р РѕР·РїС–Р·РЅР°РІР°РЅРЅСЏ С…Р°СЂР°РєС‚РµСЂРёСЃС‚РёРє Р·Р°РїС‡Р°СЃС‚РёРЅРё
  async recognizePartDetails(imageUri) {
    try {
      const text = await this.recognizeText(imageUri);
      if (!text) return null;
      
      // РћР±'С”РєС‚ РґР»СЏ Р·Р±РµСЂС–РіР°РЅРЅСЏ СЂРѕР·РїС–Р·РЅР°РЅРёС… РґР°РЅРёС…
      const partDetails = {};
      
      // РџРѕС€СѓРє Р°СЂС‚РёРєСѓР»Сѓ (РЅРѕРјРµСЂСѓ Р·Р°РїС‡Р°СЃС‚РёРЅРё)
      const partNumberPatterns = [
        /Р°СЂС‚РёРєСѓР»[:\s]+([A-Z0-9-]+)/i,
        /РЅРѕРјРµСЂ[:\s]+([A-Z0-9-]+)/i,
        /part[.\s]+no[.:\s]+([A-Z0-9-]+)/i,
        /part[.\s]+number[:\s]+([A-Z0-9-]+)/i,
        /в„–([A-Z0-9-]+)/i
      ];
      
      for (const pattern of partNumberPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          partDetails.partNumber = match[1].trim();
          break;
        }
      }
      
      // РџРѕС€СѓРє РІРёСЂРѕР±РЅРёРєР°
      const manufacturerPatterns = [
        /РІРёСЂРѕР±РЅРёРє[:\s]+([A-Za-zРђ-РЇР°-СЏР†С–Р‡С—Р„С”ТђТ‘]+)/i,
        /manufacturer[:\s]+([A-Za-z]+)/i,
        /made by[:\s]+([A-Za-z]+)/i,
        /Р±СЂРµРЅРґ[:\s]+([A-Za-zРђ-РЇР°-СЏР†С–Р‡С—Р„С”ТђТ‘]+)/i
      ];
      
      for (const pattern of manufacturerPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          partDetails.manufacturer = match[1].trim();
          break;
        }
      }
      
      // РџРѕС€СѓРє РЅР°Р·РІРё Р·Р°РїС‡Р°СЃС‚РёРЅРё
      const namePatterns = [
        /РЅР°Р·РІР°[:\s]+([A-Za-zРђ-РЇР°-СЏР†С–Р‡С—Р„С”ТђТ‘\s]+)/i,
        /name[:\s]+([A-Za-z\s]+)/i,
        /РґРµС‚Р°Р»СЊ[:\s]+([A-Za-zРђ-РЇР°-СЏР†С–Р‡С—Р„С”ТђТ‘\s]+)/i,
        /part[:\s]+([A-Za-z\s]+)/i
      ];
      
      for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          partDetails.name = match[1].trim();
          break;
        }
      }
      
      // РЇРєС‰Рѕ РІРёРєРѕСЂРёСЃС‚РѕРІСѓС”С‚СЊСЃСЏ РјРѕРє С– РЅС–С‡РѕРіРѕ РЅРµ СЂРѕР·РїС–Р·РЅР°РЅРѕ, РґРѕРґР°С”РјРѕ РјРѕРєРѕРІС– РґР°РЅС–
      if (this.useMock && Object.keys(partDetails).length === 0) {
        partDetails.partNumber = 'ABC-12345';
        partDetails.manufacturer = 'Toyota';
        partDetails.name = 'Р¤С–Р»СЊС‚СЂ РјР°СЃР»СЏРЅРёР№';
        partDetails.isMockData = true;
      }
      
      return partDetails;
    } catch (error) {
      console.error('Error recognizing part details:', error);
      return null;
    }
  }
}

// РЎС‚РІРѕСЂСЋС”РјРѕ РµРєР·РµРјРїР»СЏСЂ РєР»Р°СЃСѓ
const ocrManagerInstance = new OCRManager();

// РџРµСЂРµРІС–СЂСЏС”РјРѕ РЅР°СЏРІРЅС–СЃС‚СЊ РјРµС‚РѕРґС–РІ РІ РµРєР·РµРјРїР»СЏСЂС–
console.log('РњРµС‚РѕРґРё ocrManagerInstance:', Object.getOwnPropertyNames(Object.getPrototypeOf(ocrManagerInstance)));

// Р•РєСЃРїРѕСЂС‚СѓС”РјРѕ С‚С–Р»СЊРєРё РµРєР·РµРјРїР»СЏСЂ РєР»Р°СЃСѓ, Р° РЅРµ СЃР°Рј РєР»Р°СЃ
export const ocrManager = ocrManagerInstance;

