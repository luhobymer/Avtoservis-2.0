const { createWorker } = require('tesseract.js');
const fs = require('fs');

exports.parsePartsFromImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Зображення не знайдено' });
    }

    const imagePath = req.file.path;

    // Initialize Tesseract worker
    const worker = await createWorker('ukr+eng');
    const {
      data: { text },
    } = await worker.recognize(imagePath);
    await worker.terminate();

    // Clean up uploaded file
    fs.unlink(imagePath, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    // Parse the text
    // The parsing logic needs to be robust to handle the format described
    const parts = parseOcrText(text);

    res.json(parts);
  } catch (err) {
    console.error('OCR Error:', err);
    res.status(500).json({ message: 'Помилка розпізнавання тексту', error: err.message });
  }
};

function parseOcrText(text) {
  const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim();
  const lines = text.replace(/\r/g, '\n').split('\n').map(normalizeLine).filter(Boolean);

  const parts = [];
  const seen = new Set();
  const buffer = [];

  const numberPattern = /(\d{1,3}(?:[ \u00A0]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
  const priceKeywords = /(ціна|цiна|цена|price)/i;
  const qtyKeywords = /(кількість|количество|qty|шт\.?|pcs|x)/i;
  const currencyKeywords = /(грн|uah|₴)/i;
  const noiseKeywords =
    /(сума|сумма|всього|разом|итого|підсумок|оплата|знижка|накладна|рахунок|invoice|замовлення|термін поставки|термин поставки|постачальник|покупець|iban|edrpou|єдрпоу|код|тел|телефон|адреса)/i;
  const deleteKeywords = /(удалить|видалити|delete)/i;

  const parseNumber = (value) => {
    if (!value) return null;
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const extractNumber = (value) => {
    const match = value.match(numberPattern);
    if (!match || match.length === 0) return null;
    return parseNumber(match[0]);
  };

  const extractQty = (value) => {
    const match = value.match(/(?:кількість|количество|qty|шт\.?|pcs|x)\s*[:x]?\s*(\d+)/i);
    if (match) {
      const num = Number(match[1]);
      return Number.isFinite(num) && num > 0 ? num : null;
    }
    return null;
  };

  const isNoiseLine = (line) => {
    if (!line) return true;
    if (noiseKeywords.test(line)) return true;
    if (deleteKeywords.test(line)) return true;
    const noLetters = !/[A-Za-zА-Яа-яІіЇїЄє]/.test(line);
    const hasNumber = numberPattern.test(line);
    if (noLetters && !hasNumber) return true;
    return false;
  };

  const isPriceLine = (line) => {
    if (!line) return false;
    if (!(priceKeywords.test(line) || currencyKeywords.test(line))) return false;
    const num = extractNumber(line);
    return Number.isFinite(num);
  };

  const parseRowLine = (line) => {
    if (!/[A-Za-zА-Яа-яІіЇїЄє]/.test(line)) return null;
    const numbers = Array.from(line.matchAll(numberPattern))
      .map((m) => parseNumber(m[0]))
      .filter((n) => Number.isFinite(n));
    if (numbers.length < 2) return null;
    let qty = 1;
    let price = null;
    if (numbers.length >= 3) {
      const last = numbers[numbers.length - 1];
      const secondLast = numbers[numbers.length - 2];
      const thirdLast = numbers[numbers.length - 3];
      if (Number.isInteger(thirdLast) && thirdLast > 0 && thirdLast <= 1000) {
        qty = thirdLast;
        price = secondLast;
      } else if (Number.isInteger(secondLast) && secondLast > 0 && secondLast <= 1000) {
        qty = secondLast;
        price = thirdLast;
      } else {
        price = secondLast;
      }
      if (!price && Number.isFinite(last)) {
        price = last;
      }
    } else if (numbers.length === 2) {
      const [a, b] = numbers;
      if (Number.isInteger(b) && b > 0 && b <= 1000) {
        qty = b;
        price = a;
      } else {
        price = b;
      }
    }
    if (!Number.isFinite(price) || price <= 0) return null;
    const name = line.replace(numberPattern, ' ').replace(/[₴]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || isNoiseLine(name)) return null;
    return { name, price, quantity: qty };
  };

  const pushPart = (name, price, quantity, lineForPartNumber) => {
    const cleanedName = normalizeLine(name);
    if (!cleanedName || isNoiseLine(cleanedName)) return;
    if (!Number.isFinite(price) || price <= 0) return;
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const partNumberMatch = (lineForPartNumber || cleanedName).match(
      /([A-Z0-9]{3,}-[A-Z0-9]{2,}|[A-Z0-9]{5,})/
    );
    const partNumber = partNumberMatch ? partNumberMatch[1] : '';
    const key = `${cleanedName.toLowerCase()}|${price}|${qty}`;
    if (seen.has(key)) return;
    seen.add(key);
    parts.push({
      name: cleanedName,
      price,
      quantity: qty,
      part_number: partNumber,
      purchased_by: 'owner',
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const rowCandidate = parseRowLine(line);
    if (rowCandidate) {
      pushPart(rowCandidate.name, rowCandidate.price, rowCandidate.quantity, line);
      buffer.length = 0;
      continue;
    }

    if (isPriceLine(line)) {
      const price = extractNumber(line);
      let qty = extractQty(line);
      if (!qty) {
        for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
          const nextLine = lines[j];
          qty = extractQty(nextLine);
          if (qty) break;
        }
      }
      if (!qty) qty = 1;

      const nameLines = buffer.filter(
        (l) => !isNoiseLine(l) && !isPriceLine(l) && !qtyKeywords.test(l)
      );
      const name = nameLines.join(' ').trim();
      pushPart(name, price, qty, nameLines.join(' '));
      buffer.length = 0;
      continue;
    }

    if (!isNoiseLine(line)) {
      buffer.push(line);
      if (buffer.length > 4) buffer.shift();
    }
  }

  return parts;
}
