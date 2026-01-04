const bcrypt = require('bcrypt');

async function generateHash() {
  try {
    const password = 'test123';
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Password:', password);
    console.log('Bcrypt hash:', hash);
    
    // Перевіряємо хеш
    const isValid = await bcrypt.compare(password, hash);
    console.log('Hash validation:', isValid);
  } catch (error) {
    console.error('Error:', error);
  }
}

generateHash();