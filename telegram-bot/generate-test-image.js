/**
 * Скрипт для генерації тестового зображення з номерним знаком
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

/**
 * Генерує тестове зображення з номерним знаком
 * @param {string} licensePlate - Текст номерного знаку
 * @param {string} outputPath - Шлях для збереження
 * @returns {Promise<boolean>} - Результат збереження
 */
async function generateLicensePlateImage(licensePlate, outputPath) {
  try {
    console.log(`Генерація тестового зображення з номерним знаком: ${licensePlate}`);
    
    // Створюємо канвас
    const width = 400;
    const height = 100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Фон (білий)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    
    // Рамка номерного знаку (чорна)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, width - 10, height - 10);
    
    // Синя смуга зліва (прапор України)
    ctx.fillStyle = '#0057B8';
    ctx.fillRect(10, 10, 30, 40);
    
    // Жовта смуга зліва (прапор України)
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(10, 50, 30, 40);
    
    // Текст "UA"
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('UA', 15, 80);
    
    // Текст номерного знаку
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(licensePlate, width / 2 + 15, height / 2 + 15);
    
    // Зберігаємо зображення у файл
    const buffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`Зображення збережено у файл: ${outputPath}`);
    console.log(`Розмір файлу: ${fs.statSync(outputPath).size} байт`);
    
    return true;
  } catch (error) {
    console.error('Помилка генерації зображення:', error.message);
    return false;
  }
}

// Якщо скрипт запущено напряму, виконуємо тестування
if (require.main === module) {
  // Перевіряємо аргументи командного рядка
  const args = process.argv.slice(2);
  const licensePlate = args[0] || 'BA 5825 ET';
  const outputPath = args[1] || path.join(__dirname, 'test-image-new.jpg');
  
  // Генеруємо зображення
  generateLicensePlateImage(licensePlate, outputPath)
    .then(success => {
      if (success) {
        console.log('Зображення успішно згенеровано');
      } else {
        console.log('Не вдалося згенерувати зображення');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Помилка під час генерації зображення:', error);
      process.exit(1);
    });
}

module.exports = { generateLicensePlateImage };