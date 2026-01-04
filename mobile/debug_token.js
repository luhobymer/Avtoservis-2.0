// Імітуємо функцію isTokenValid
const isTokenValid = (token) => {
  if (!token) return false;
  
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) return false;
    
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const currentTime = Date.now() / 1000;
    
    return payload.exp && payload.exp > currentTime;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
};

// Імітуємо btoa для Node.js
const btoa = (str) => Buffer.from(str).toString('base64');

const payloadWithoutExp = {
  sub: 'user123',
  iat: Math.floor(Date.now() / 1000)
};

const tokenWithoutExp = `header.${btoa(JSON.stringify(payloadWithoutExp))}.signature`;

console.log('Token:', tokenWithoutExp);
console.log('Payload:', JSON.stringify(payloadWithoutExp));
console.log('Has exp field:', 'exp' in payloadWithoutExp);
console.log('payload.exp:', payloadWithoutExp.exp);
console.log('payload.exp && payload.exp > currentTime:', payloadWithoutExp.exp && payloadWithoutExp.exp > Date.now() / 1000);
console.log('Result:', isTokenValid(tokenWithoutExp));
console.log('Expected: false');

// Тестуємо з exp полем
const payloadWithExp = {
  sub: 'user123',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600 // +1 година
};

const tokenWithExp = `header.${btoa(JSON.stringify(payloadWithExp))}.signature`;
console.log('\nWith exp field:');
console.log('Result:', isTokenValid(tokenWithExp));
console.log('Expected: true');